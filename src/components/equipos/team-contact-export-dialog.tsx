"use client";

import { useState } from "react";
import {
  ContactIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  PrinterIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  contactPrintHref,
  useContactExport,
} from "@/components/personas/contact-export";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDialogParam } from "@/hooks/use-dialog-param";

export type ContactExportCandidate = {
  personId: string;
  name: string;
  role: "player" | "coach" | "staff";
  jerseyNumber: number | null;
};

/**
 * "Necesito los datos de estos cuatro jugadores" resuelto donde nace la
 * pregunta, sin pasar por el listado de personas a filtrar por equipo.
 *
 * La plantilla llega ya cargada por la página del equipo: este diálogo no
 * dispara ninguna consulta propia (esa página ya lanza varias a la vez).
 * Tampoco toca `MembershipTable`, que está compartida con la ficha de persona
 * y no tiene por qué llevar casillas allí.
 */
export function TeamContactExportDialog({
  teamId,
  roster,
}: {
  teamId: string;
  roster: ContactExportCandidate[];
}) {
  const t = useTranslations("Equipos");
  const [open, setOpen] = useDialogParam(`exportar-contacto:${teamId}`);

  /**
   * Se guarda a quién se ha **quitado**, no a quién se ha marcado.
   *
   * El caso frecuente es "el equipo entero", así que todo empieza marcado y de
   * ahí se descarta. Y guardarlo por exclusión hace que la lista no se quede
   * rancia: la plantilla se recarga en sitio al añadir o borrar una membresía,
   * y el componente no se desmonta. Con un conjunto de marcados, el jugador
   * recién añadido saldría sin marcar aunque la casilla de "todos" diga lo
   * contrario, y uno ya borrado se seguiría exportando.
   */
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());

  const selectedIds = roster
    .filter((m) => !excluded.has(m.personId))
    .map((m) => m.personId);

  const scope = { ids: selectedIds };
  const { running, pending, exportCsv, exportXlsx } = useContactExport(() => scope);

  if (roster.length === 0) return null;

  function toggle(personId: string, checked: boolean) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  /** Deja marcados justo a quienes cumplen el criterio. */
  function keepOnly(matches: (member: ContactExportCandidate) => boolean) {
    setExcluded(new Set(roster.filter((m) => !matches(m)).map((m) => m.personId)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ContactIcon data-icon="inline-start" />
        {t("contactExportAction")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("contactExportTitle")}</DialogTitle>
          <DialogDescription>{t("contactExportDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => keepOnly(() => true)}>
            {t("contactExportSelectAll")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => keepOnly((m) => m.role === "player")}
          >
            {t("contactExportPlayersOnly")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => keepOnly(() => false)}>
            {t("contactExportNone")}
          </Button>
        </div>

        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
          {roster.map((member) => (
            <li key={member.personId}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <Checkbox
                  checked={!excluded.has(member.personId)}
                  onCheckedChange={(checked) => toggle(member.personId, checked === true)}
                  aria-label={t("contactExportSelectRowSr", { name: member.name })}
                />
                <span className="flex-1">{member.name}</span>
                {member.jerseyNumber !== null ? (
                  <span className="text-muted-foreground tabular-nums">
                    {member.jerseyNumber}
                  </span>
                ) : null}
                <span className="text-muted-foreground">{t(`roleOption.${member.role}`)}</span>
              </label>
            </li>
          ))}
        </ul>

        <DialogFooter className="sm:justify-between">
          <span className="text-muted-foreground text-sm">
            {t("contactExportSelectedCount", { count: selectedIds.length })}
          </span>
          {/* `flex-nowrap`: los tres van en una línea, que es lo que el ancho
              del diálogo permite ahora. */}
          <div className="flex flex-nowrap gap-2">
            <Button
              variant="outline"
              render={<Link href={contactPrintHref(scope)} />}
              nativeButton={false}
              aria-disabled={selectedIds.length === 0}
              className={selectedIds.length === 0 ? "pointer-events-none opacity-50" : undefined}
            >
              <PrinterIcon data-icon="inline-start" />
              {t("contactExportPrint")}
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={pending || selectedIds.length === 0}
            >
              {/* El spinner solo en el botón que se ha pulsado. */}
              {running === "csv" ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <FileTextIcon data-icon="inline-start" />
              )}
              {t("contactExportCsv")}
            </Button>
            <Button onClick={exportXlsx} disabled={pending || selectedIds.length === 0}>
              {running === "xlsx" ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <FileSpreadsheetIcon data-icon="inline-start" />
              )}
              {t("contactExportXlsx")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
