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

export type IssuedInvoiceStatus = "issued" | "rectified" | "cancelled";

/** Tono por estado de factura emitida. Una anulada se apaga, no alarma. */
export const ISSUED_INVOICE_STATUS_TONE: Record<IssuedInvoiceStatus, StatusTone> = {
  issued: "positive",
  rectified: "warning",
  cancelled: "neutral",
};

/**
 * Bucket del adjunto de una factura según su libro: uno por libro, porque
 * `BUCKET_READ_PERMISSION` mapea cada bucket a un solo permiso (decisión 2 del
 * plan). Emitidas y recibidas comparten los dos buckets y se separan por
 * prefijo de ruta.
 */
export function invoiceFileBucket(value: Ledger): string {
  return value === "internal" ? "invoice-files-internal" : "invoice-files";
}

export type ReconciliationState = "pending" | "partial" | "settled";

/**
 * Estado de conciliación DERIVADO de la suma de enlaces frente al importe del
 * documento — nunca almacenado, para no desincronizarse al borrar un enlace
 * (decisión 5 del plan). Compara en valor absoluto: un ingreso y un gasto
 * llevan signos opuestos en el extracto.
 */
export function reconciliationState(linkedCents: number, totalCents: number): ReconciliationState {
  const linked = Math.abs(linkedCents);
  const total = Math.abs(totalCents);
  if (linked <= 0) return "pending";
  return linked >= total ? "settled" : "partial";
}

export const RECONCILIATION_TONE: Record<ReconciliationState, StatusTone> = {
  pending: "neutral",
  partial: "warning",
  settled: "positive",
};

/** Una categoría en la tabla de presupuesto, con su ejecución al lado. */
export type BudgetRow = {
  categoryId: string;
  name: string;
  kind: "income" | "expense";
  isActive: boolean;
  /** `null` = categoría sin presupuestar, que no es lo mismo que cero. */
  plannedCents: number | null;
  /** Facturas emitidas (ingreso) o recibidas (gasto) de la temporada. */
  accruedCents: number;
  /** Apuntes bancarios, ya con el signo puesto del lado de la categoría. */
  cashCents: number;
};

type BudgetSide = { planned: number; accrued: number; cash: number };

/**
 * Totales del presupuesto por lado y el resultado (ingresos − gastos) en las
 * tres magnitudes. Vive aquí porque lo necesitan tanto la página —las casillas
 * de cabecera— como la tabla, y las dos cifras tienen que cuadrar.
 */
export function budgetTotals(rows: readonly BudgetRow[]): {
  income: BudgetSide;
  expense: BudgetSide;
  result: BudgetSide;
} {
  const side = (kind: BudgetRow["kind"]): BudgetSide =>
    rows
      .filter((row) => row.kind === kind)
      .reduce(
        (acc, row) => ({
          planned: acc.planned + (row.plannedCents ?? 0),
          accrued: acc.accrued + row.accruedCents,
          cash: acc.cash + row.cashCents,
        }),
        { planned: 0, accrued: 0, cash: 0 },
      );

  const income = side("income");
  const expense = side("expense");

  return {
    income,
    expense,
    result: {
      planned: income.planned - expense.planned,
      accrued: income.accrued - expense.accrued,
      cash: income.cash - expense.cash,
    },
  };
}

/**
 * Porcentaje ejecutado sobre lo presupuestado, o `null` si la categoría no
 * tiene línea: sin presupuesto no hay nada contra lo que medir.
 */
export function executionPct(row: BudgetRow): number | null {
  if (!row.plannedCents) return null;
  return (row.accruedCents / row.plannedCents) * 100;
}
