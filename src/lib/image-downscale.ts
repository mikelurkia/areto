/**
 * Reducción de fotos EN EL NAVEGADOR, antes de enviarlas.
 *
 * No es una optimización: es lo que hace que el formulario público de
 * inscripción funcione. Las funciones de Vercel rechazan cualquier petición
 * con más de **4,5 MB** de cuerpo (413 `FUNCTION_PAYLOAD_TOO_LARGE`), y ese
 * límite es de la plataforma: `serverActions.bodySizeLimit` de
 * `next.config.ts` solo levanta el de Next, no el de Vercel. El formulario
 * envía tres fotos (retrato + DNI por las dos caras) y un móvil actual saca
 * cada una a 5-15 MB, así que sin reducirlas antes la petición no llega nunca
 * al servidor: se corta en la plataforma, con lo que la Server Action no se
 * ejecuta, no puede devolver un error amable y salta el error boundary.
 *
 * Ojo: `src/lib/image-resize.ts` hace algo parecido pero es `server-only`
 * (sharp), y se ejecuta DESPUÉS de la subida — demasiado tarde para esto.
 */

/**
 * Lado largo máximo y calidad. Medido sobre imágenes de 4032x3024 (12 Mpx, lo
 * que saca un móvil normal), reduciendo a JPEG:
 *
 *   |            | 1800px q0.85 | 1600px q0.8 | 1400px q0.8 |
 *   | foto / DNI |       601 KB |      408 KB |      336 KB |
 *   | ruido puro |      1306 KB |      875 KB |      669 KB |
 *
 * («ruido puro» es el peor caso absoluto para JPEG, que ninguna foto real
 * alcanza; está para acotar el techo.) Con 1600px/q0.8 las tres fotos del
 * formulario suman ~1,2 MB en la práctica y menos de 2,6 MB ni en el peor
 * caso: sobra margen bajo los 4,5 MB de la plataforma.
 *
 * Un DNI a 1600 px se lee de sobra: el carné mide 86 mm, así que salen unos
 * 19 px/mm (~470 ppp), y `uploadRegistrationPhoto` exige que el documento siga
 * siendo legible.
 */
const MAX_EDGE_PX = 1600;

const JPEG_QUALITY = 0.8;

/**
 * Por debajo de esto no se toca el fichero: ya cabe de sobra y reencodear solo
 * le quitaría calidad. Cubre el caso de quien adjunta un escaneo ya pequeño.
 */
const SKIP_BELOW_BYTES = 600 * 1024;

/**
 * Techo por fichero. NO es "lo que debería ocupar una foto reducida" (eso es
 * medio mega): está puesto muy por encima del peor caso de la tabla de arriba
 * para que solo salte cuando la reducción NO ha ocurrido —un navegador sin
 * canvas, una imagen que no decodifica— y el fichero sigue pesando los megas
 * originales. Ajustarlo a la baja rebotaría fotos perfectamente válidas.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Techo para las tres juntas, que es el límite que de verdad importa: la
 * plataforma corta la petición ENTERA en 4,5 MB. Se deja un mega largo para
 * los campos del formulario y el sobrecoste del multipart.
 */
export const MAX_UPLOAD_TOTAL_BYTES = 3.5 * 1024 * 1024;

type ImageSource = {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

/**
 * Decodifica el fichero respetando la orientación EXIF. Sin `imageOrientation`
 * las fotos hechas en vertical con el móvil se dibujan giradas 90º en el
 * canvas (el visor las endereza por EXIF, pero `drawImage` no).
 */
async function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Navegador sin soporte de `imageOrientation`: se sigue con <img>, que
      // aplica la orientación por CSS (`image-orientation: from-image`).
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}

/** `foto.HEIC` → `foto.jpg`: la salida es siempre JPEG. */
function jpegName(name: string): string {
  return `${name.replace(/\.[^.]+$/, "") || "foto"}.jpg`;
}

/**
 * Devuelve una versión reducida del fichero, o **el original tal cual** si no
 * se puede reducir o si reducirlo no lo mejora. Nunca lanza: quien llama
 * comprueba el tamaño del resultado (ver `MAX_UPLOAD_BYTES`) y decide, así que
 * un navegador que no sepa hacer esto degrada a un mensaje claro y no a un
 * fallo opaco.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (file.size <= SKIP_BELOW_BYTES) return file;

  let source: ImageSource | null = null;
  try {
    source = await loadImageSource(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(source.image, 0, 0, width, height);

    const blob = await toBlob(canvas);
    // Un JPEG de origen ya bien comprimido puede salir más gordo al
    // reencodearlo: en ese caso el original es la mejor opción.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], jpegName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    source?.release();
  }
}
