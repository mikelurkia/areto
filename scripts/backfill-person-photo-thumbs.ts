import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

/**
 * Backfill puntual (2026-08-21): genera la miniatura (`photo-thumb.webp`) de
 * cada foto de persona ya subida, para las personas dadas de alta antes de
 * que la subida empezara a generar también esa miniatura. Sin esto, los
 * avatares (plantilla, panel de familia, carné...), que ya piden la
 * miniatura, mostrarían la foto rota hasta que alguien la volviera a subir.
 *
 * Ejecutar con: npx tsx scripts/backfill-person-photo-thumbs.ts
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
}

const PHOTO_BUCKET = "person-photos";
const THUMB_MAX_DIMENSION = 256;

function personPhotoThumbPath(photoPath: string): string {
  return photoPath.replace(/\/photo\.[^/]+$/, "/photo-thumb.webp");
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: people, error } = await supabase
    .from("persons")
    .select("id, first_name, last_name, photo_path")
    .not("photo_path", "is", null);
  if (error) throw error;

  console.log(`${people.length} personas con foto.`);

  for (const person of people) {
    const photoPath = person.photo_path as string;
    const thumbPath = personPhotoThumbPath(photoPath);
    const label = `${person.first_name} ${person.last_name}`;

    const { data: original, error: downloadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .download(photoPath);
    if (downloadError || !original) {
      console.error(`x ${label}: no se pudo descargar ${photoPath}`, downloadError);
      continue;
    }

    const buffer = Buffer.from(await original.arrayBuffer());
    const thumb = await sharp(buffer)
      .rotate()
      .resize({
        width: THUMB_MAX_DIMENSION,
        height: THUMB_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(thumbPath, thumb, { upsert: true, contentType: "image/webp" });
    if (uploadError) {
      console.error(`x ${label}: no se pudo subir la miniatura`, uploadError);
      continue;
    }
    console.log(`ok ${label} -> ${thumbPath}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
