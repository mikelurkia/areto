import type { ReactNode } from "react";
import { PaperclipIcon } from "lucide-react";

import { DeleteMembershipDialog } from "@/components/equipos/delete-membership-dialog";
import { MembershipDialog } from "@/components/equipos/membership-dialog";
import { MembershipFederationCardDialog } from "@/components/equipos/membership-federation-card-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MembershipRow = {
  id: string;
  role: "player" | "coach" | "staff";
  position: string | null;
  jerseyNumber: number | null;
  positions: string[];
  isCaptain: boolean;
  federationCardUrl: string | null;
};

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Tabla de membresías (persona ↔ equipo), compartida por la pestaña
 * "Plantilla" del equipo (equipo→personas) y la pestaña "Equipos" de la
 * persona (persona→equipos): mismas columnas de rol/dorsal/puestos.
 * Solo cambia la columna "sujeto" (persona o equipo, vía `renderSubject`).
 */
export function MembershipTable<T extends MembershipRow>({
  items,
  canManage,
  t,
  subjectHeader,
  renderSubject,
  nameFor,
}: {
  items: readonly T[];
  canManage: boolean;
  t: Translate;
  subjectHeader: ReactNode;
  renderSubject: (item: T) => ReactNode;
  nameFor: (item: T) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{subjectHeader}</TableHead>
          <TableHead priority="secondary">{t("roleLabel")}</TableHead>
          <TableHead>{t("colJersey")}</TableHead>
          <TableHead priority="tertiary">{t("colPositions")}</TableHead>
          <TableHead priority="secondary" className="print:hidden">
            {t("federationCardLabel")}
          </TableHead>
          {canManage ? (
            <TableHead className="text-right print:hidden">{t("colActions")}</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((m) => {
          const name = nameFor(m);
          return (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{renderSubject(m)}</TableCell>
              <TableCell priority="secondary">
                {t(`roleOption.${m.role}`)}
                {m.position ? (
                  <span className="text-muted-foreground"> · {m.position}</span>
                ) : null}
              </TableCell>
              <TableCell>{m.jerseyNumber ?? "—"}</TableCell>
              <TableCell priority="tertiary">
                {m.positions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {m.positions.map((pos) => (
                      <Badge key={pos} variant="secondary">
                        {t(`playerPositionOption.${pos}`)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="print:hidden">
                <div className="flex items-center gap-1">
                  {m.federationCardUrl ? (
                    <a
                      href={m.federationCardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <PaperclipIcon className="size-3.5" />
                      {t("documentViewFile")}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                  {canManage ? (
                    <MembershipFederationCardDialog
                      membershipId={m.id}
                      fileUrl={m.federationCardUrl}
                    />
                  ) : null}
                </div>
              </TableCell>
              {canManage ? (
                <TableCell className="flex justify-end gap-1 print:hidden">
                  <MembershipDialog
                    mode="edit"
                    membership={{
                      id: m.id,
                      personName: name,
                      role: m.role,
                      jerseyNumber: m.jerseyNumber,
                      positions: m.positions,
                      position: m.position,
                    }}
                  />
                  <DeleteMembershipDialog id={m.id} name={name} />
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
