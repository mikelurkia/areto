"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { saveBudgetLines } from "@/app/[locale]/(app)/economia/presupuesto/actions";
import { FormError } from "@/components/form-error";
import { SectionHeading } from "@/components/page-header";
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
import { type Ledger } from "@/lib/economia";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

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

/**
 * Presupuesto de una temporada y su ejecución, en una sola tabla: presupuestar
 * es rellenar veinte casillas de una sentada, así que hay un único formulario
 * con un solo botón y no un diálogo por línea.
 *
 * Las tres columnas de la derecha son lectura siempre. "Devengado" y "Caja"
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

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="ledger" value={ledger} />
      <input type="hidden" name="seasonId" value={seasonId} />

      {(["income", "expense"] as const).map((kind) => (
        <BudgetBlock
          key={kind}
          kind={kind}
          rows={rows.filter((row) => row.kind === kind)}
          editable={editable}
          locale={locale}
        />
      ))}

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
  editable,
  locale,
}: {
  kind: "income" | "expense";
  rows: BudgetRow[];
  editable: boolean;
  locale: string;
}) {
  const t = useTranslations("Economia");

  if (rows.length === 0) return null;

  const totals = rows.reduce(
    (acc, row) => ({
      planned: acc.planned + (row.plannedCents ?? 0),
      accrued: acc.accrued + row.accruedCents,
      cash: acc.cash + row.cashCents,
    }),
    { planned: 0, accrued: 0, cash: 0 },
  );

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
                <TableHead className="text-right">{t("deviationLabel")}</TableHead>
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
                        name={`line_${row.categoryId}`}
                        inputMode="decimal"
                        aria-label={row.name}
                        defaultValue={
                          row.plannedCents === null ? "" : String(row.plannedCents / 100)
                        }
                        placeholder="0"
                        className="ml-auto w-28 text-right"
                      />
                    ) : row.plannedCents === null ? (
                      formatCents(0, locale)
                    ) : (
                      formatCents(row.plannedCents, locale)
                    )}
                  </TableCell>
                  <TableCell priority="secondary" nowrap className="text-right">
                    {formatCents(row.accruedCents, locale)}
                  </TableCell>
                  <TableCell priority="secondary" nowrap className="text-right">
                    {formatCents(row.cashCents, locale)}
                  </TableCell>
                  <TableCell nowrap className="text-right">
                    <Deviation
                      kind={kind}
                      cents={row.accruedCents - (row.plannedCents ?? 0)}
                      locale={locale}
                    />
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
                  {formatCents(totals.planned, locale)}
                </TableCell>
                <TableCell priority="secondary" nowrap className="text-right font-semibold">
                  {formatCents(totals.accrued, locale)}
                </TableCell>
                <TableCell priority="secondary" nowrap className="text-right font-semibold">
                  {formatCents(totals.cash, locale)}
                </TableCell>
                <TableCell nowrap className="text-right font-semibold">
                  <Deviation
                    kind={kind}
                    cents={totals.accrued - totals.planned}
                    locale={locale}
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
 * Desviación = devengado − presupuestado. Lo que es malo depende del signo y
 * del tipo: ingresar menos de lo previsto y gastar más son la misma noticia.
 */
function Deviation({
  kind,
  cents,
  locale,
}: {
  kind: "income" | "expense";
  cents: number;
  locale: string;
}) {
  const adverse = kind === "income" ? cents < 0 : cents > 0;
  const text = `${cents > 0 ? "+" : ""}${formatCents(cents, locale)}`;

  return <span className={cn(adverse && "text-destructive")}>{text}</span>;
}
