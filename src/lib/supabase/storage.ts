import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SignedUrlOptions = { client?: SupabaseClient; expiresIn?: number };

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

/** URL firmada temporal (1h por defecto) de un objeto de Storage, o null si no hay ruta. */
export async function getSignedUrl(
  bucket: string,
  path: string | null | undefined,
  options?: SignedUrlOptions,
): Promise<string | null> {
  if (!path) return null;
  const supabase = options?.client ?? (await createClient());
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, options?.expiresIn ?? 3600);
  return data?.signedUrl ?? null;
}

/**
 * Firma en lote las rutas de una colección de items, devolviendo un Map
 * clave → URL. `getPath`/`getKey` extraen la ruta de storage y la clave del
 * item (normalmente su id); los items sin ruta se omiten. Usa la API de lote
 * de Supabase (una sola petición por bucket).
 */
export async function getSignedUrls<T>(
  bucket: string,
  items: readonly T[],
  getPath: (item: T) => string | null | undefined,
  getKey: (item: T) => string,
  options?: SignedUrlOptions,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const withPath = items.filter((item) => !!getPath(item));
  if (withPath.length === 0) return urls;
  const supabase = options?.client ?? (await createClient());
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(withPath.map((item) => getPath(item) as string), options?.expiresIn ?? 3600);
  data?.forEach((entry, i) => {
    if (entry.signedUrl) urls.set(getKey(withPath[i]), entry.signedUrl);
  });
  return urls;
}
