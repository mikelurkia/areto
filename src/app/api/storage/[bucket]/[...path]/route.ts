import { NextResponse } from "next/server";

import { getCurrentUser, hasPermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * Buckets privados que este proxy sabe servir, y el permiso de lectura que
 * exige cada uno. `sponsorship-logos` no está porque es público y se sirve
 * directo desde Supabase (`getPublicUrl`), sin pasar por aquí.
 *
 * Debe coincidir con las políticas RLS de `storage.objects` en
 * `supabase/setup.sql`: esto es solo un atajo para devolver un 403 claro sin
 * gastar una llamada a Storage. La autorización real la hace RLS más abajo (la
 * descarga va con el cliente de sesión del usuario, no con la clave de
 * servicio), así que aunque este mapa se quede desactualizado, Supabase seguirá
 * rechazando lo que sus políticas no permitan.
 */
const BUCKET_READ_PERMISSION: Record<string, Permission> = {
  "person-photos": "personas.view",
  "person-documents": "personas.view",
  "person-qualifications": "personas.view",
  "person-medical-checkups": "personas.medical.view",
  "person-injury-reports": "personas.medical.view",
  "team-documents": "equipos.view",
  "membership-documents": "equipos.view",
  "sponsor-documents": "patrocinadores.view",
  "sponsorship-contracts": "patrocinadores.view",
  "registration-documents": "inscripciones.view",
  "document-templates": "club.view",
  "invoice-files": "economia.official.view",
  "invoice-files-internal": "economia.internal.view",
};

/** Tipos que el navegador puede mostrar inline sin riesgo; cualquier otro se fuerza a descarga. */
const SAFE_INLINE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const { bucket, path } = await params;
  // `Object.hasOwn` y no un acceso directo: `bucket` viene de la URL, y algo
  // como "toString" devolvería una función heredada del prototipo.
  if (!Object.hasOwn(BUCKET_READ_PERMISSION, bucket)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const requiredPermission = BUCKET_READ_PERMISSION[bucket];

  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!hasPermission(user, requiredPermission)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const objectPath = path.map(decodeURIComponent).join("/");
  // Cliente con la sesión del usuario (no la clave de servicio): la lectura
  // pasa por las mismas políticas RLS de `storage.objects` que protegían el
  // bucket antes de este proxy, así que la autorización real vive en un solo
  // sitio (Supabase), no duplicada aquí.
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  // El tipo de contenido viene de metadata que fijó quien subió el fichero
  // (incluye el formulario público de inscripción, sin sesión) y no es de
  // fiar: si no está en la lista segura se sirve como binario genérico y se
  // fuerza la descarga, para que un fichero disfrazado de imagen nunca se
  // interprete como HTML en el origen de la app.
  const rawType = data.type || "application/octet-stream";
  const contentType = SAFE_INLINE_TYPES.has(rawType) ? rawType : "application/octet-stream";
  const disposition = SAFE_INLINE_TYPES.has(rawType) ? "inline" : "attachment";
  // El propio call site conoce el objeto (p. ej. el nombre de la persona) y
  // puede pedir un nombre más útil que el interno de Storage (`photo.jpg`)
  // vía `?filename=`; si no lo pide, se cae al último segmento de la ruta.
  const requestedFilename = new URL(request.url).searchParams.get("filename");
  const filename = (
    requestedFilename ?? (path[path.length - 1] ? decodeURIComponent(path[path.length - 1]) : "file")
  ).replace(/["\r\n]/g, "");

  return new NextResponse(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      // Privado (solo el navegador del usuario cachea, ninguna CDN
      // intermedia) y de una hora: acota cuánto puede tardar en verse un
      // fichero reemplazado (los uploads sobreescriben la misma ruta), a
      // cambio de que visitas repetidas no vuelvan a descargarlo de Supabase.
      "Cache-Control": "private, max-age=3600, must-revalidate",
    },
  });
}
