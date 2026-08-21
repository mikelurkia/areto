/**
 * Ruta de la miniatura de la foto de una persona, junto al original en el
 * mismo bucket (`person-photos`, o `registration-documents` antes de que la
 * inscripción se apruebe). Mismo patrón que `logoThumbPath` para logos de
 * patrocinador: la foto se ve casi siempre como avatar pequeño (listados,
 * plantilla de equipo, panel de familia, carné...), así que solo la ficha de
 * la persona enlaza al original a tamaño completo.
 */
export function personPhotoThumbPath(photoPath: string): string {
  return photoPath.replace(/\/photo\.[^/]+$/, "/photo-thumb.webp");
}

/**
 * Nombre de archivo sugerido al abrir/descargar la foto original de una
 * persona, en vez del nombre interno de Storage (`photo.jpg`). Misma
 * limpieza de acentos que `normalizeName` en `person-matching.ts`, pero
 * orientada a nombre de fichero (minúsculas, `_` en vez de espacios/símbolos).
 */
export function personPhotoDownloadName(fullName: string, photoPath: string): string {
  const extension = photoPath.split(".").pop() || "jpg";
  const slug = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${slug || "foto"}_photo.${extension}`;
}
