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
