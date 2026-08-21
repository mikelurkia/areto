import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

/**
 * Backfill puntual (2026-08-21): genera la miniatura (`logo-thumb.webp`) de
 * cada logo de patrocinador ya subido, para los patrocinadores dados de alta
 * antes de que la subida empezara a generar también esa miniatura. Sin esto,
 * el listado y el muro público (que ya piden la miniatura) mostrarían el
 * logo roto hasta que alguien lo volviera a subir.
 *
 * Ejecutar con: npx tsx scripts/backfill-sponsor-logo-thumbs.ts
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
}

const LOGO_BUCKET = "sponsorship-logos";
const THUMB_MAX_DIMENSION = 256;

function logoThumbPath(logoPath: string): string {
  return logoPath.replace(/\/logo\.[^/]+$/, "/logo-thumb.webp");
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sponsors, error } = await supabase
    .from("sponsors")
    .select("id, name, logo_path")
    .not("logo_path", "is", null);
  if (error) throw error;

  console.log(`${sponsors.length} patrocinadores con logo.`);

  for (const sponsor of sponsors) {
    const logoPath = sponsor.logo_path as string;
    const thumbPath = logoThumbPath(logoPath);

    const { data: original, error: downloadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .download(logoPath);
    if (downloadError || !original) {
      console.error(`x ${sponsor.name}: no se pudo descargar ${logoPath}`, downloadError);
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
      .from(LOGO_BUCKET)
      .upload(thumbPath, thumb, { upsert: true, contentType: "image/webp" });
    if (uploadError) {
      console.error(`x ${sponsor.name}: no se pudo subir la miniatura`, uploadError);
      continue;
    }
    console.log(`ok ${sponsor.name} -> ${thumbPath}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
