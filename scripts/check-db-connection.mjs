// Comprueba que DATABASE_URL conecta, y explica en claro por qué no si falla.
//
// Existe porque `drizzle-kit migrate` se traga los errores: ante una cadena
// mal formada muere en un segundo con `exit code 1` y sin una sola línea de
// diagnóstico. Eso costó tres rondas de prueba y error en el despliegue de la
// gestión de usuarios, con producción a medias mientras tanto.
//
// Se usa el mismo driver que la aplicación (postgres-js) a propósito: un
// cliente distinto podría conectar donde drizzle no, y entonces la
// comprobación no valdría de nada.

import postgres from "postgres";

const url = process.env.DATABASE_URL;

function fallar(mensaje, detalle) {
  console.error(`::error::${mensaje}`);
  if (detalle) console.error(detalle);
  process.exit(1);
}

if (!url) {
  fallar(
    "DATABASE_URL no está definida. Si el job declara un `environment`, " +
      "comprueba que el secret esté en ese environment y no solo en los del repositorio.",
  );
}

let partes;
try {
  partes = new URL(url);
} catch {
  fallar("DATABASE_URL no es una URL válida. Revisa que la contraseña tenga codificados los caracteres especiales (@ → %40, # → %23, / → %2F, : → %3A).");
}

// Nunca la contraseña: esto acaba en un log público.
const usuario = decodeURIComponent(partes.username);
const donde = `usuario '${usuario}' @ ${partes.hostname}:${partes.port || "5432"}${partes.pathname}`;
console.log(`Cadena: ${donde}`);

// Errores de forma que Postgres solo sabe contar como "password authentication
// failed", que despista durante un buen rato.
if (/pooler\.supabase\.com$/.test(partes.hostname) && !usuario.includes(".")) {
  fallar(
    `La cadena apunta al pooler de Supabase con el usuario '${usuario}'. ` +
      "Contra el pooler el usuario debe ser 'postgres.<project-ref>'. " +
      "Cópiala del dashboard: Settings → Database → Connection string.",
  );
}

if (/^db\..*\.supabase\.co$/.test(partes.hostname)) {
  fallar(
    `La cadena apunta a la conexión directa (${partes.hostname}), que en el plan ` +
      "Free solo resuelve por IPv6 y no funciona desde los runners de GitHub. " +
      "Usa el pooler: aws-N-<region>.pooler.supabase.com.",
  );
}

if (/\[YOUR-PASSWORD\]|\[TU-PASSWORD\]|\[password\]/i.test(url)) {
  fallar("La cadena conserva el hueco de la contraseña sin sustituir.");
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });

try {
  const [row] = await sql`
    select current_user as usuario,
           current_database() as base,
           current_setting('server_version') as version`;
  console.log(
    `Conexión correcta: ${row.usuario}@${row.base} (Postgres ${row.version})`,
  );
} catch (error) {
  const causa = error?.code ? ` [${error.code}]` : "";
  fallar(
    `No se puede conectar a la base de datos${causa}: ${error.message}`,
    `Se intentó con ${donde}`,
  );
} finally {
  await sql.end({ timeout: 5 });
}
