import "server-only";

import sharp from "sharp";

/**
 * Fotos de carné y logos son ilustrativos, no documentos: no hace falta
 * conservar la resolución original (a menudo varios MB si vienen directas de
 * un móvil). Achicarlos a este lado reduce tanto el espacio en Storage como,
 * sobre todo, el tráfico de salida cada vez que se sirven.
 */
const MAX_DIMENSION_PX = 1024;
const WEBP_QUALITY = 82;

/**
 * Redimensiona (sin recortar ni ampliar) y recomprime a WebP una foto/logo
 * antes de subirla a Storage. No usar con documentos que deban conservar su
 * calidad original (DNI, contratos, títulos, partes médicos).
 */
export async function resizeImageToWebp(
  file: File,
  maxDimension = MAX_DIMENSION_PX,
): Promise<File> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const resized = await sharp(buffer)
    .rotate() // aplica la orientación EXIF antes de que se pierda al recomprimir
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return new File([resized], file.name, { type: "image/webp" });
}
