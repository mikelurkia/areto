import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Extensión de archivo a partir de su MIME type, para nombrar objetos en Storage. */
export function extensionFromMimeType(type: string): string {
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "application/msword") return "doc";
  if (
    type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "jpg";
}

export async function uploadFile(bucket: string, path: string, file: File): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
}

/**
 * Sube un fichero con la clave de servicio (bypassa RLS). Solo para acciones
 * públicas sin sesión (formulario de inscripción): el bucket destino no tiene
 * política de `insert` para `anon`, así que subir con la sesión del visitante
 * fallaría; en su lugar el servidor sube en su nombre.
 */
export async function uploadFileAsAdmin(bucket: string, path: string, file: File): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
}

/**
 * Copia un objeto entre buckets (descarga + resube; Storage no tiene un
 * "copy" entre buckets distintos). Se usa al aprobar una inscripción: la foto
 * y el DNI viven en `registration-documents` y pasan a `person-photos`/
 * `person-documents` al integrarse en la ficha de la persona.
 */
export async function copyFileBetweenBuckets(
  fromBucket: string,
  fromPath: string,
  toBucket: string,
  toPath: string,
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(fromBucket).download(fromPath);
  if (error) throw error;
  const { error: uploadError } = await supabase.storage
    .from(toBucket)
    .upload(toPath, data, { upsert: true, contentType: data.type });
  if (uploadError) throw uploadError;
}

export async function removeFile(bucket: string, path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(bucket).remove([path]);
}

/** Descarga un objeto de Storage. Para regenerar una miniatura a partir del original ya subido. */
export async function downloadFile(bucket: string, path: string): Promise<Blob> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw error ?? new Error(`No se pudo descargar ${bucket}/${path}`);
  return data;
}

/**
 * Ruta estable (no firmada) a un objeto de un bucket privado, servida por el
 * proxy `/api/storage/[bucket]/[...path]` (ver ese route handler). Antes esta
 * función devolvía una URL firmada distinta en cada render, lo que impedía al
 * navegador cachear la imagen entre visitas: cada carga de página volvía a
 * descargar el fichero entero desde Supabase (coste de egress repetido). El
 * proxy comprueba la sesión en cada petición igual que antes, pero al ser una
 * URL estable el navegador sí puede cachear la respuesta (ver `Cache-Control`
 * en el route handler).
 */
function storageProxyPath(bucket: string, path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `/api/storage/${bucket}/${encodedPath}`;
}

/** Async por compatibilidad con los call sites existentes (`await`/`Promise.all`); no hace ninguna llamada de red. */
export async function getSignedUrl(
  bucket: string,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  return storageProxyPath(bucket, path);
}

/**
 * Variante en lote de `getSignedUrl`, devolviendo un Map clave → URL.
 * `getPath`/`getKey` extraen la ruta de storage y la clave del item
 * (normalmente su id); los items sin ruta se omiten.
 */
export async function getSignedUrls<T>(
  bucket: string,
  items: readonly T[],
  getPath: (item: T) => string | null | undefined,
  getKey: (item: T) => string,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const item of items) {
    const path = getPath(item);
    if (path) urls.set(getKey(item), storageProxyPath(bucket, path));
  }
  return urls;
}

/**
 * URL pública y estable de un objeto en un bucket público (p.ej. logos de
 * patrocinador, en `sponsorship-logos`). No expira y el navegador la cachea
 * entre visitas sin pasar por nuestro servidor.
 */
export function getPublicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  const supabase = createAdminClient();
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Variante en lote de `getPublicUrl`, devolviendo un Map clave → URL. */
export function getPublicUrls<T>(
  bucket: string,
  items: readonly T[],
  getPath: (item: T) => string | null | undefined,
  getKey: (item: T) => string,
): Map<string, string> {
  const urls = new Map<string, string>();
  for (const item of items) {
    const url = getPublicUrl(bucket, getPath(item));
    if (url) urls.set(getKey(item), url);
  }
  return urls;
}
