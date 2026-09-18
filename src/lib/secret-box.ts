import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado simétrico de los pocos datos del club que hay que poder recuperar en
 * claro (hoy: el número de tarjeta de `club_payment_methods`). AES-256-GCM, IV
 * aleatorio por registro, y el tag de autenticación guardado junto al texto
 * cifrado, todo en una sola columna `text`.
 *
 * Formato almacenado: `v1:<iv b64>:<tag b64>:<ciphertext b64>`. El prefijo de
 * versión cuesta tres caracteres y convierte un futuro cambio de algoritmo en
 * algo diagnosticable en vez de en una excepción opaca.
 *
 * Sin AAD a propósito: atarlo al `id` de la fila obligaría a cifrar en dos
 * pasos (el `id` lo genera el INSERT), y no hay aquí un escenario realista de
 * trasplante de un valor cifrado de una fila a otra.
 *
 * ROTACIÓN Y PÉRDIDA DE LA CLAVE: no hay ninguna. Si `CLUB_DATA_ENCRYPTION_KEY`
 * se pierde o se cambia, los valores ya guardados dejan de descifrarse y hay
 * que volver a introducirlos a mano — son dos o tres tarjetas, así que no
 * compensa un mecanismo de re-cifrado. Un fallo al descifrar nunca tumba una
 * página: solo lo llama la acción de revelado, que devuelve un error.
 *
 * La clave se lee de forma perezosa, NO al importar el módulo: este fichero
 * entra en el grafo de `/club`, y un `next build` en una máquina sin la
 * variable no debe romper la compilación de toda la ruta por una sección
 * secundaria.
 */

const PREFIX = "v1";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

/** ¿Está configurada la clave? La UI lo usa para avisar en vez de reventar. */
export function isEncryptionConfigured(): boolean {
  const raw = process.env.CLUB_DATA_ENCRYPTION_KEY;
  return Boolean(raw && Buffer.from(raw, "base64").length === 32);
}

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.CLUB_DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Falta CLUB_DATA_ENCRYPTION_KEY: no se pueden cifrar datos del club.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CLUB_DATA_ENCRYPTION_KEY debe medir 32 bytes en base64, mide ${key.length}.`,
    );
  }
  cachedKey = key;
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    PREFIX,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Lanza si el formato no cuadra, si la clave no es la que cifró, o si el
 * texto se ha manipulado (el tag de GCM lo detecta). */
export function decryptSecret(stored: string): string {
  const [version, iv, tag, ciphertext] = stored.split(":");
  if (version !== PREFIX || !iv || !tag || !ciphertext) {
    throw new Error("Valor cifrado con un formato que no se reconoce.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
