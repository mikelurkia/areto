/**
 * Etiqueta legible del tipo de archivo a partir de su nombre (o ruta). Devuelve
 * nombres de formato neutros (no requieren traducción): "PDF", "JPG", "Word"...
 * Si no reconoce la extensión, la devuelve en mayúsculas; si no hay extensión,
 * devuelve null.
 */
const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  jpg: "JPG",
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  doc: "Word",
  docx: "Word",
  odt: "ODT",
  xls: "Excel",
  xlsx: "Excel",
  csv: "CSV",
  txt: "TXT",
};

export function fileExtension(name: string | null | undefined): string | null {
  if (!name) return null;
  const clean = name.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  if (dot < 0 || dot === clean.length - 1) return null;
  return clean.slice(dot + 1).toLowerCase();
}

export function fileTypeLabel(name: string | null | undefined): string | null {
  const ext = fileExtension(name);
  if (!ext) return null;
  return TYPE_LABELS[ext] ?? ext.toUpperCase();
}
