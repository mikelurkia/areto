"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { saveBudgetLines } from "@/app/[locale]/(app)/economia/presupuesto/actions";
import { EmptyValue } from "@/components/empty-value";
import { FormError } from "@/components/form-error";
import { SectionHeading } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title={t(`categoryKind_${kind}`)} />
      <Card size="sm">
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("categoryNameLabel")}</TableHead>
                <TableHead className="text-right">{t("plannedLabel")}</TableHead>
                <TableHead priority="secondary" className="text-right">
                  {t("accruedLabel")}
                </TableHead>
                <TableHead priority="secondary" className="text-right">
                  {t("cashLabel")}
                </TableHead>
                <TableHead priority="secondary" className="text-right">
                  {t("deviationLabel")}
                </TableHead>
                <TableHead className="text-right">{t("executionLabel")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.categoryId}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {row.name}
                      {row.isActive ? null : (
                        <StatusBadge tone="neutral" label={t("inactiveBadge")} />
                      )}
                    </span>
                  </TableCell>
                  <TableCell nowrap className="text-right">
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
                        className="ml-auto w-28 text-right"
                      />
                    ) : (
                      formatCents(row.plannedCents ?? 0, locale)
                    )}
                  </TableCell>
                  <TableCell priority="secondary" nowrap className="text-right">
                    {formatCents(row.accruedCents, locale)}
                  </TableCell>
                  <TableCell priority="secondary" nowrap className="text-right">
                    {formatCents(row.cashCents, locale)}
                  </TableCell>
                  <TableCell priority="secondary" nowrap className="text-right">
                    <Signed cents={row.accruedCents - (row.plannedCents ?? 0)} locale={locale} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Execution kind={kind} pct={executionPct(row)} label={row.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              {/* Una celda por columna, sin `colSpan`: al ocultarse las de
                  prioridad el número de celdas debe seguir cuadrando. */}
              <TableRow>
                <TableCell className="font-medium">{t("totalLabel")}</TableCell>
                <TableCell nowrap className="text-right font-semibold">
                  {formatCents(total.planned, locale)}
                </TableCell>
                <TableCell priority="secondary" nowrap className="text-right font-semibold">
                  {formatCents(total.accrued, locale)}
                </TableCell>
                <TableCell priority="secondary" nowrap className="text-right font-semibold">
                  {formatCents(total.cash, locale)}
                </TableCell>
                <TableCell priority="secondary" nowrap className="text-right font-semibold">
                  <Signed cents={total.accrued - total.planned} locale={locale} />
                </TableCell>
                <TableCell className="text-right">
                  <Execution
                    kind={kind}
                    pct={total.planned ? (total.accrued / total.planned) * 100 : null}
                    label={t("totalLabel")}
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

/**
 * Ejecución sobre lo presupuestado. La barra se recorta al 100 % aunque el
 * porcentaje siga subiendo, que es lo que hace visible el exceso.
 *
 * Solo se colorea pasarse del presupuesto, nunca ir por debajo: en septiembre
 * no hay ni un ingreso cobrado todavía, y teñir de rojo la tabla entera no
 * dice nada de la salud del club.
 */
function Execution({
  kind,
  pct,
  label,
}: {
  kind: "income" | "expense";
  pct: number | null;
  label: string;
}) {
  if (pct === null) return <EmptyValue />;

  const over = pct > 100;
  const adverse = over && kind === "expense";
  const favourable = over && kind === "income";

  return (
    <Progress
      value={Math.min(pct, 100)}
      aria-label={label}
      className={cn(
        "ml-auto w-24 gap-1",
        adverse && "[&_[data-slot=progress-indicator]]:bg-destructive",
        favourable && "[&_[data-slot=progress-indicator]]:bg-success",
      )}
    >
      <span
        className={cn(
          "ml-auto text-xs tabular-nums",
          adverse ? "text-destructive" : favourable ? "text-success" : "text-muted-foreground",
        )}
      >
        {Math.round(pct)}%
      </span>
    </Progress>
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
