import type { CurrentUser } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import type { StatusTone } from "@/lib/status-tone";

/**
 * Ámbito contable ("libro") del módulo económico.
 *
 * La regla dura del módulo es que ningún total agrega los dos libros, y que el
 * filtro va SIEMPRE en servidor: estos helpers derivan de los permisos qué
 * libros entran en el `where` de una query y si una escritura está permitida.
 * Ocultar en cliente no vale — hay precedente de que eso falla (ver el apartado
 * "Aparte" de `docs/plan-modulo-economico.md`).
 *
 * Este fichero NO lleva `server-only` ni importa `@/db`: el tipo de usuario
 * entra por parámetro para que también pueda usarse desde un componente que se
 * renderice en cliente.
 */

export const LEDGERS = ["official", "internal"] as const;
export type Ledger = (typeof LEDGERS)[number];

/** Parámetro de la URL que fija el libro visible. */
export const LEDGER_PARAM = "libro";

/** Los dos `view`: basta uno para entrar en `/economia`. */
export const ECONOMIA_VIEW_PERMISSIONS: readonly Permission[] = [
  "economia.official.view",
  "economia.internal.view",
];

const VIEW_PERMISSION: Record<Ledger, Permission> = {
  official: "economia.official.view",
  internal: "economia.internal.view",
};

const MANAGE_PERMISSION: Record<Ledger, Permission> = {
  official: "economia.official.manage",
  internal: "economia.internal.manage",
};

type UserPermissions = Pick<CurrentUser, "permissions"> | null | undefined;

/**
 * Libros que este usuario puede ver, en orden fijo. Vacío = no entra al módulo.
 * De aquí sale el `where` de toda query del módulo, y el selector de libro solo
 * se pinta si devuelve los dos.
 */
export function visibleLedgers(user: UserPermissions): Ledger[] {
  if (!user) return [];
  return LEDGERS.filter((l) => user.permissions.has(VIEW_PERMISSION[l]));
}

export function canViewLedger(user: UserPermissions, value: Ledger): boolean {
  return user ? user.permissions.has(VIEW_PERMISSION[value]) : false;
}

/** Escribir se comprueba contra el libro de la fila, nunca contra un permiso global. */
export function canManageLedger(user: UserPermissions, value: Ledger): boolean {
  return user ? user.permissions.has(MANAGE_PERMISSION[value]) : false;
}

/**
 * Los proveedores son la dimensión COMPARTIDA por los dos libros, igual que
 * las categorías (ver `canManageCategories` en `cuentas/actions.ts`): basta
 * con poder gestionar uno de los dos para darlos de alta.
 */
export function canManageSuppliers(user: UserPermissions): boolean {
  return LEDGERS.some((value) => canManageLedger(user, value));
}

function isLedger(value: string): value is Ledger {
  return (LEDGERS as readonly string[]).includes(value);
}

/**
 * Libro activo a partir de `?libro=`. Un valor ausente, inválido o de un libro
 * que el usuario no ve cae al primero visible: escribir `?libro=internal` a
 * mano no enseña nada. `null` si no ve ninguno.
 */
export function resolveLedger(
  raw: string | string[] | undefined,
  visible: readonly Ledger[],
): Ledger | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && isLedger(value) && visible.includes(value)) return value;
  return visible[0] ?? null;
}

export type ReceivedInvoiceStatus = "pending" | "paid" | "disputed";

/** Tono por estado de factura recibida, igual en el listado y en la ficha. */
export const RECEIVED_INVOICE_STATUS_TONE: Record<ReceivedInvoiceStatus, StatusTone> = {
  pending: "warning",
  paid: "positive",
  disputed: "danger",
};
