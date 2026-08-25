import "./env";

import { db } from "./index";
import { seasons, teams } from "./schema";
import { seedRoles } from "./seed-roles";

/**
 * Datos iniciales mínimos para arrancar en desarrollo.
 * Ejecuta con: npm run db:seed
 *
 * Para un juego de datos completo (plantillas, socios, patrocinadores,
 * calendario, inscripciones) está `npm run db:seed:demo`.
 */
async function main() {
  console.log("🌱 Sembrando datos iniciales...");

  await seedRoles();

  const [season] = await db
    .insert(seasons)
    .values({ name: "2025/26", isCurrent: true })
    .onConflictDoNothing()
    .returning();

  if (season) {
    await db
      .insert(teams)
      .values([
        { seasonId: season.id, name: "Senior A", category: "senior" },
        { seasonId: season.id, name: "Cadete", category: "cadete" },
      ])
      .onConflictDoNothing();
  }

  console.log("✅ Datos iniciales listos.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error en el seed:", err);
  process.exit(1);
});
