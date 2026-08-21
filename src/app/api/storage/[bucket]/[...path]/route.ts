import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Buckets privados que este proxy sabe servir. `sponsorship-logos` no está
 * porque es público y se sirve directo desde Supabase (`getPublicUrl`), sin
 * pasar por aquí.
 */
const PRIVATE_BUCKETS = new Set([
  "person-photos",
  "person-documents",
  "person-qualifications",
  "person-medical-checkups",
  "person-injury-reports",
  "team-documents",
  "sponsor-documents",
  "sponsorship-contracts",
  "registration-documents",
]);

/**
 * Mismo criterio que las políticas RLS de `storage.objects` en
 * `supabase/setup.sql`: solo un atajo para devolver un 403 claro sin gastar
 * una llamada a Storage. La autorización real la hace RLS más abajo: la
 * descarga va con el cliente de sesión del usuario (no la clave de servicio),
 * así que aunque este set se quede desactualizado, Supabase seguirá
 * rechazando lo que sus políticas no permitan.
 */
const STAFF_ONLY_BUCKETS = new Set(["registration-documents"]);

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
  if (!PRIVATE_BUCKETS.has(bucket)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (STAFF_ONLY_BUCKETS.has(bucket) && !["admin", "staff"].includes(user.role)) {
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
