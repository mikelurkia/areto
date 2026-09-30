import "server-only";

import { generateRandomString } from "better-auth/crypto";

import { auth } from "@/lib/better-auth";
import { getSiteUrl } from "@/lib/site-url";

/** Una invitación dura una semana; un enlace de recuperación, una hora. */
const EXPIRES_IN_SECONDS = { invite: 60 * 60 * 24 * 7, recovery: 60 * 60 } as const;

export type PasswordLinkKind = keyof typeof EXPIRES_IN_SECONDS;

/**
 * Enlace de un solo uso para poner contraseña: invitación o recuperación.
 *
 * El token se guarda igual que los de reset de Better Auth (`reset-password:<token>`
 * → id de usuario), así que la página /contrasena lo canjea con su
 * `resetPassword`, que además crea la cuenta `credential` si todavía no existe:
 * justo el caso de una invitación.
 *
 * Se genera aquí y no con `requestPasswordReset` de Better Auth porque ese solo
 * sabe enviarlo por correo, y sin dominio propio el camino normal es que un
 * administrador copie el enlace y lo pase.
 */
export async function createPasswordLink(
  userId: string,
  kind: PasswordLinkKind,
): Promise<string> {
  const token = generateRandomString(32);
  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: userId,
    expiresAt: new Date(Date.now() + EXPIRES_IN_SECONDS[kind] * 1000),
  });

  const motivo = kind === "invite" ? "invitacion" : "recuperacion";
  return `${getSiteUrl()}/contrasena?token=${token}&motivo=${motivo}`;
}
