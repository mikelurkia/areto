import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida. Copia .env.example a .env.local.");
}

// Reutilizamos la conexión en desarrollo para no agotar el pool con el HMR.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.client ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Comprobado en `pg_stat_activity`: cuando el dashboard se queda colgado,
    // la query en cuestión ya ha terminado en Postgres (`wait_event:
    // ClientRead`, ejecutada instantánea al repetirla a mano) — el cuelgue es
    // del lado del cliente (postgres-js/Supavisor), no una query lenta. Este
    // `statement_timeout` (y el de rol, `ALTER ROLE postgres SET
    // statement_timeout = '30s'`) no ataca ese cuelgue; se deja como red de
    // seguridad para queries que sí tarden de verdad.
    connection: { statement_timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });
