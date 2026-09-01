import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { getTranslations } from "next-intl/server";

import { DeleteChargeDialog } from "@/components/cuotas/delete-charge-dialog";
import { DeletePendingChargesDialog } from "@/components/cuotas/delete-pending-charges-dialog";
import { StopPropagation } from "@/components/stop-propagation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCents } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PendingChargeRow = { id: string; personName: string; amountCents: number };

/**
 * Grupo de cargos pendientes sueltos (mismo sujeto/periodo). Colapsado por
 * defecto: la cabecera es la fila resumen de siempre, el desglose por
 * persona vive dentro — sin esto, todos los cargos de socio de un mismo
 * periodo se veían fundidos en una sola fila ("Socios"), sin forma de saber
 * a quién correspondía el importe.
 */
export function PendingChargeGroupCard({
  subject,
  periodKey,
  amountCents,
  rows,
  canManage,
  locale,
  t,
}: {
  subject: string;
  periodKey: string;
  amountCents: number;
  rows: PendingChargeRow[];
  canManage: boolean;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"Cuotas">>>;
}) {
  const ids = rows.map((row) => row.id);

  return (
    <Collapsible className="overflow-hidden rounded-lg border">
      <CollapsibleTrigger
        render={<div />}
        nativeButton={false}
        className="group/pending-trigger flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 bg-muted/20 px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="flex items-center gap-2">
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground group-aria-expanded/pending-trigger:hidden" />
          <ChevronUpIcon className="hidden size-4 shrink-0 text-muted-foreground group-aria-expanded/pending-trigger:block" />
          <span className="font-medium">{subject}</span>
          <span className="text-xs text-muted-foreground">{periodKey}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{rows.length}</span>
          <span className="font-semibold">{formatCents(amountCents, locale)}</span>
          {canManage ? (
            <StopPropagation>
              <DeletePendingChargesDialog ids={ids} subject={subject} periodKey={periodKey} />
            </StopPropagation>
          ) : null}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colSubject")}</TableHead>
              <TableHead className="text-right">{t("colAmount")}</TableHead>
              {canManage ? <TableHead className="text-right">{t("colActions")}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.personName}</TableCell>
                <TableCell nowrap className="text-right">
                  {formatCents(row.amountCents, locale)}
                </TableCell>
                {canManage ? (
                  <TableCell className="flex justify-end">
                    <DeleteChargeDialog id={row.id} subject={row.personName} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}
