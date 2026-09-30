import "server-only";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { verifyPassword } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import {
  authAccounts,
  authRateLimits,
  authSessions,
  authVerifications,
  users,
} from "@/db/schema";
import { isSmtpConfigured, sendAuthEmail } from "@/lib/auth-email";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Autenticación con Better Auth, sobre nuestra propia Postgres.
 *
 * El modelo de usuario es la tabla `users` de siempre: así no hay dos tablas de
 * cuentas que mantener sincronizadas. Las altas solo entran por invitación
 * (`disableSignUp`), desde /administracion/usuarios.
 */
export const auth = betterAuth({
  baseURL: getSiteUrl(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    // Las claves son los nombres de modelo de Better Auth.
    schema: {
      users,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
      rateLimit: authRateLimits,
    },
  }),
  user: {
    modelName: "users",
    fields: { name: "fullName" },
    // Solo con SMTP: el cambio se confirma con un enlace al correo nuevo, y sin
    // correo no hay cómo hacérselo llegar.
    changeEmail: { enabled: isSmtpConfigured },
  },
  emailVerification: isSmtpConfigured
    ? {
        sendVerificationEmail: async ({ user, url }) => {
          await sendAuthEmail("changeEmail", user.email, url);
        },
      }
    : undefined,
  session: {
    // Supabase no hacía caducar la sesión de quien la usa a diario; 30 días
    // renovados cada día se le parecen.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    password: {
      // Las contraseñas de Supabase Auth llegaron como hash bcrypt (migración
      // 0097). Se siguen aceptando; al cambiarlas, pasan al scrypt de Better Auth.
      verify: ({ hash, password }) =>
        hash.startsWith("$2")
          ? bcrypt.compare(password, hash)
          : verifyPassword({ hash, password }),
    },
  },
  // Cubre las peticiones HTTP a /api/auth/*. El login va por Server Action, que
  // no pasa por aquí: ese lleva su propio límite (`src/lib/login-rate-limit.ts`).
  rateLimit: { storage: "database" },
  advanced: {
    database: { generateId: "uuid" },
  },
  databaseHooks: {
    session: {
      create: {
        // Una cuenta desactivada no abre sesión, ni con la contraseña correcta.
        before: async (session) => {
          const profile = await db.query.users.findFirst({
            where: eq(users.id, session.userId),
            columns: { status: true },
          });
          if (profile?.status === "disabled") return false;
        },
        after: async (session) => {
          await db
            .update(users)
            .set({ lastSignInAt: new Date() })
            .where(eq(users.id, session.userId));
        },
      },
    },
  },
  // Siempre el último: escribe las cookies desde Server Actions.
  plugins: [nextCookies()],
});
