import type { StatusTone } from "@/lib/status-tone";

/** Longitudes admitidas por ISO/IEC 7812 (Maestro corto a UnionPay largo). */
const MIN_LENGTH = 13;
const MAX_LENGTH = 19;

/** Meses de antelación con los que se avisa de que una tarjeta va a caducar. */
const EXPIRY_WARNING_MONTHS = 2;

/** Deja solo los dígitos. */
export function normalizeCardNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Agrupa de cuatro en cuatro para el tecleo y la visualización. */
export function groupCardNumber(value: string): string {
  return value.replace(/(.{4})/g, "$1 ").trim();
}

/** Formato "XXXX XXXX XXXX XXXX" sobre un valor tal cual se teclea, para el
 * `onChange` del campo. */
export function formatCardNumberInput(raw: string): string {
  return groupCardNumber(normalizeCardNumber(raw).slice(0, MAX_LENGTH));
}

/**
 * Longitud admitida + dígito de control de Luhn (ISO/IEC 7812-1). No comprueba
 * la marca ni el emisor: un número que pasa Luhn puede no existir, pero uno que
 * no lo pasa es con seguridad un error de tecleo, que es lo que interesa cazar.
 */
export function isValidCardNumber(raw: string): boolean {
  const value = normalizeCardNumber(raw);
  if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) return false;
  let sum = 0;
  let double = false;
  for (let i = value.length - 1; i >= 0; i--) {
    let digit = value.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Los cuatro últimos dígitos, lo único del número que se guarda en claro. */
export function cardLast4(raw: string): string {
  return normalizeCardNumber(raw).slice(-4);
}

export type CardExpiryStatus = "ok" | "expiring" | "expired";

/** Caducada, a punto de caducar o vigente. Una tarjeta caduca al final de su
 * mes de caducidad, no al principio. */
export function cardExpiryStatus(
  month: number,
  year: number,
  today: Date = new Date(),
): CardExpiryStatus {
  const expiry = year * 12 + (month - 1);
  const now = today.getFullYear() * 12 + today.getMonth();
  if (expiry < now) return "expired";
  if (expiry - now <= EXPIRY_WARNING_MONTHS) return "expiring";
  return "ok";
}

export const CARD_EXPIRY_TONE: Record<CardExpiryStatus, StatusTone> = {
  ok: "positive",
  expiring: "warning",
  expired: "danger",
};
