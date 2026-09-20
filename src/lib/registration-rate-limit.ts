import "server-only";

import { headers } from "next/headers";
import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { registrationAttempts } from "@/db/schema";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 5;

async function clientIp(): Promise<string> {
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

/**
 * Antes de procesar un envío del formulario público de inscripción: cuenta
 * los intentos de esta IP en los últimos 10 minutos y registra este intento.
 * Sin infraestructura de Redis/Upstash en el proyecto, y con despliegue
 * serverless en Vercel (una `Map` en memoria no sobrevive entre invocaciones),
 * la ventana se cuenta contra Postgres.
 */
export async function checkRegistrationRateLimit(): Promise<{ blocked: boolean }> {
  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MS);

  const [row] = await db
    .select({ value: count() })
    .from(registrationAttempts)
    .where(and(eq(registrationAttempts.ip, ip), gte(registrationAttempts.createdAt, since)));

  const attempts = Number(row?.value ?? 0);
  if (attempts >= MAX_ATTEMPTS_PER_WINDOW) return { blocked: true };

  await db.insert(registrationAttempts).values({ ip });
  return { blocked: false };
}
