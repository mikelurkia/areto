"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { saveBudgetLines } from "@/app/[locale]/(app)/economia/presupuesto/actions";
import { EmptyValue } from "@/components/empty-value";
import { ExecutionBar } from "@/components/economia/execution-bar";
import { FormError } from "@/components/form-error";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActionToast } from "@/hooks/use-action-toast";
import { budgetTotals, executionPct, type BudgetRow, type Ledger } from "@/lib/economia";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Presupuesto de una temporada y su ejecución, en una sola tabla: presupuestar
 * es rellenar veinte casillas de una sentada, así que hay un único formulario
 * con un solo botón y no un diálogo por línea.
 *
 * Las columnas de la derecha son lectura siempre. "Devengado" y "Caja"
 * responden a preguntas distintas —lo comprometido en facturas frente a lo que
 * ha salido del banco— y por eso no se suman ni se cruzan.
 */
export function BudgetEditor({
  rows,
  ledger,
  seasonId,
  editable,
  locale,
}: {
  rows: BudgetRow[];
  ledger: Ledger;
  seasonId: string;
  editable: boolean;
  locale: string;
}) {
  const t = useTranslations("Economia");
  const [state, formAction] = useActionState(saveBudgetLines, {});
  useActionToast(state);

  const totals = budgetTotals(rows);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="ledger" value={ledger} />
      <input type="hidden" name="seasonId" value={seasonId} />

      {(["income", "expense"] as const).map((kind) => (
        <BudgetBlock
          key={kind}
          kind={kind}
          rows={rows.filter((row) => row.kind === kind)}
          total={totals[kind]}
          editable={editable}
          locale={locale}
        />
      ))}

      {/* El resultado repite la cifra de la cabecera a propósito: la página son
          dos tablas largas y un presupuesto se termina de leer por abajo. */}
      <Card size="sm">
        <CardContent className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <p className="text-sm font-medium">{t("resultHeading")}</p>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <ResultFigure label={t("plannedLabel")} cents={totals.result.planned} locale={locale} />
            <ResultFigure label={t("accruedLabel")} cents={totals.result.accrued} locale={locale} />
            <ResultFigure label={t("cashLabel")} cents={totals.result.cash} locale={locale} />
          </div>
        </CardContent>
      </Card>

      <FormError message={state.error} />
      {editable ? (
        <div className="flex justify-end">
          <SubmitButton>{t("saveBudgetAction")}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

function BudgetBlock({
  kind,
  rows,
  total,
  editable,
  locale,
}: {
  kind: "income" | "expense";
  rows: BudgetRow[];
  total: { planned: number; accrued: number; cash: number };
  editable: boolean;
  locale: string;
}) {
  const t = useTranslations("Economia");

  if (rows.length === 0) return null;

  // Mismo tinte suave que ya usan el chip de icono de `StatTile` y la barra de
  // `Execution` de esta misma tabla — el color diferencia ingreso de gasto sin
  // introducir un bloque sólido ajeno al resto del módulo.
  const tone = kind === "income" ? "text-success" : "text-destructive";
  const rowTone = kind === "income" ? "bg-success/10" : "bg-destructive/10";
  const cellBorder = "border border-border";

  return (
    <div className="flex flex-col gap-4">
      <span
        className={cn(
          "w-fit rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide uppercase",
          rowTone,
          tone,
        )}
      >
        {t(`categoryKind_${kind}`)}
      </span>
      <Card size="sm">
        <CardContent>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className={cn(rowTone, "[&>th]:h-8", "[&>th]:py-1.5")}>
                <TableHead className={cn(cellBorder, "w-44")}>{t("categoryNameLabel")}</TableHead>
                <TableHead className={cn(cellBorder, "w-36 text-right")}>
                  {t("plannedLabel")}
                </TableHead>
                <TableHead priority="secondary" className={cn(cellBorder, "w-28 text-right")}>
                  {t("accruedLabel")}
                </TableHead>
                <TableHead priority="secondary" className={cn(cellBorder, "w-28 text-right")}>
                  {t("cashLabel")}
                </TableHead>
                <TableHead className={cn(cellBorder, "w-28 text-right")}>
                  {t("deviationLabel")}
                </TableHead>
                <TableHead priority="secondary" className={cn(cellBorder, "w-40")}>
                  {t("notesLabel")}
                </TableHead>
                <TableHead priority="secondary" className={cn(cellBorder, "w-28 text-right")}>
                  {t("executionLabel")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.categoryId} className="[&>td]:h-8 [&>td]:py-1">
                  <TableCell className={cn(cellBorder, "font-medium")}>
                    <span className="flex items-center gap-2">
                      {row.name}
                      {row.isActive ? null : (
                        <StatusBadge tone="neutral" label={t("inactiveBadge")} />
                      )}
                    </span>
                  </TableCell>
                  <TableCell nowrap className={cn(cellBorder, "text-right")}>
                    {editable ? (
                      <Input
                        // El campo no es controlado, así que su `defaultValue`
                        // no puede cambiar en caliente: al guardar, la ruta se
                        // revalida y el importe nuevo llega por props. Con el
                        // valor en la `key` el campo se remonta en vez de
                        // mutar su default, que es lo que avisa Base UI.
                        key={`${row.categoryId}:${row.plannedCents}`}
                        name={`line_${row.categoryId}`}
                        inputMode="decimal"
                        aria-label={row.name}
                        defaultValue={
                          row.plannedCents === null ? "" : String(row.plannedCents / 100)
                        }
                        placeholder="0"
                        className="ml-auto h-7 w-28 py-1 text-right"
                      />
                    ) : (
                      formatCents(row.plannedCents ?? 0, locale)
                    )}
                  </TableCell>
                  <TableCell priority="secondary" nowrap className={cn(cellBorder, "text-right")}>
                    {formatCents(row.accruedCents, locale)}
                  </TableCell>
                  <TableCell priority="secondary" nowrap className={cn(cellBorder, "text-right")}>
                    {formatCents(row.cashCents, locale)}
                  </TableCell>
                  <TableCell nowrap className={cn(cellBorder, "text-right")}>
                    <Signed cents={row.accruedCents - (row.plannedCents ?? 0)} locale={locale} />
                  </TableCell>
                  <TableCell priority="secondary" className={cellBorder}>
                    {editable ? (
                      <Input
                        key={`note:${row.categoryId}:${row.notes ?? ""}`}
                        name={`note_${row.categoryId}`}
                        aria-label={`${t("notesLabel")} — ${row.name}`}
                        defaultValue={row.notes ?? ""}
                        className="h-7 min-w-32 py-1"
                      />
                    ) : (
                      (row.notes ?? <EmptyValue />)
                    )}
                  </TableCell>
                  <TableCell priority="secondary" className={cn(cellBorder, "text-right")}>
                    <ExecutionBar
                      kind={kind}
                      pct={executionPct(row)}
                      label={row.name}
                      className="ml-auto w-24"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              {/* Una celda por columna, sin `colSpan`: al ocultarse las de
                  prioridad el número de celdas debe seguir cuadrando. */}
              <TableRow className={cn(rowTone, "[&>td]:h-8 [&>td]:py-1.5")}>
                <TableCell className={cn(cellBorder, "font-medium")}>{t("totalLabel")}</TableCell>
                <TableCell nowrap className={cn(cellBorder, "text-right font-semibold")}>
                  {formatCents(total.planned, locale)}
                </TableCell>
                <TableCell
                  priority="secondary"
                  nowrap
                  className={cn(cellBorder, "text-right font-semibold")}
                >
                  {formatCents(total.accrued, locale)}
                </TableCell>
                <TableCell
                  priority="secondary"
                  nowrap
                  className={cn(cellBorder, "text-right font-semibold")}
                >
                  {formatCents(total.cash, locale)}
                </TableCell>
                <TableCell nowrap className={cn(cellBorder, "text-right font-semibold")}>
                  <Signed cents={total.accrued - total.planned} locale={locale} />
                </TableCell>
                <TableCell priority="secondary" className={cellBorder} />
                <TableCell priority="secondary" className={cn(cellBorder, "text-right")}>
                  <ExecutionBar
                    kind={kind}
                    pct={total.planned ? (total.accrued / total.planned) * 100 : null}
                    label={t("totalLabel")}
                    className="ml-auto w-24"
                  />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/** Importe con signo explícito: sin el "+" no se lee como una diferencia. */
function Signed({ cents, locale }: { cents: number; locale: string }) {
  return (
    <span className="tabular-nums">
      {cents > 0 ? "+" : ""}
      {formatCents(cents, locale)}
    </span>
  );
}

function ResultFigure({
  label,
  cents,
  locale,
}: {
  label: string;
  cents: number;
  locale: string;
}) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", cents < 0 && "text-destructive")}>
        {cents > 0 ? "+" : ""}
        {formatCents(cents, locale)}
      </span>
    </p>
  );
}
