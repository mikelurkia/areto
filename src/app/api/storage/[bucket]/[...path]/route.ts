import { NextResponse } from "next/server";

import { getCurrentUser, hasPermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { downloadFile } from "@/lib/supabase/storage";

/**
 * Buckets privados que este proxy sabe servir, y el permiso de lectura que
 * exige cada uno. `sponsorship-logos` no está porque es público y se sirve
 * directo desde Supabase (`getPublicUrl`), sin pasar por aquí.
 *
 * Este mapa ES la autorización: la descarga va con la clave de servicio (ver
 * `src/lib/supabase/storage.ts`), que se salta las políticas RLS de
 * `storage.objects`. Un bucket nuevo sin entrada aquí devuelve 404.
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
  "payment-receipts": "economia.official.view",
  "payment-receipts-internal": "economia.internal.view",
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
  // Sin RLS detrás, un `..` (o `%2E%2E`, ya decodificado) se normalizaría en
  // la URL hacia Storage y saldría de `bucket`, saltándose el mapa de permisos.
  if (objectPath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return new NextResponse("Not found", { status: 404 });
  }
  let data: Blob;
  try {
    data = await downloadFile(bucket, objectPath);
  } catch {
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
