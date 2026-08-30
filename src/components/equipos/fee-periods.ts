/**
 * Espejo en TypeScript del enum `fee_period` de la base de datos, para poder
 * recorrerlo en el cliente sin importar el esquema de Drizzle. Mismo patrón
 * que `TEAM_CATEGORIES` y `TEAM_GENDERS`.
 */
export const FEE_PERIODS = ["monthly", "season", "oneoff", "installments"] as const;

export type FeePeriodValue = (typeof FEE_PERIODS)[number];
