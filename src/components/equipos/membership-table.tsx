import type { ReactNode } from "react";

import { DeleteMembershipDialog } from "@/components/equipos/delete-membership-dialog";
import { MembershipDialog } from "@/components/equipos/membership-dialog";
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
  kitShirtIssued: boolean;
  kitPantsIssued: boolean;
  kitBibIssued: boolean;
  active: boolean;
};

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Tabla de membresías (persona ↔ equipo), compartida por la pestaña
 * "Plantilla" del equipo (equipo→personas) y la pestaña "Equipos" de la
 * persona (persona→equipos): mismas columnas de rol/dorsal/puestos/
 * equipación/activo. Solo cambia la columna "sujeto" (persona o equipo,
 * vía `renderSubject`) y si se muestra el mapa de dorsales del diálogo de
 * edición (`takenJerseysFor`, solo en contexto equipo — ver comentario en
 * `MembershipDialog`).
 */
export function MembershipTable<T extends MembershipRow>({
  items,
  canManage,
  t,
  subjectHeader,
  renderSubject,
  nameFor,
  takenJerseysFor,
}: {
  items: readonly T[];
  canManage: boolean;
  t: Translate;
  subjectHeader: ReactNode;
  renderSubject: (item: T) => ReactNode;
  nameFor: (item: T) => string;
  takenJerseysFor?: (item: T) => number[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{subjectHeader}</TableHead>
          <TableHead>{t("roleLabel")}</TableHead>
          <TableHead>{t("colJersey")}</TableHead>
          <TableHead>{t("colPositions")}</TableHead>
          <TableHead>{t("colKit")}</TableHead>
          <TableHead>{t("colActive")}</TableHead>
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
              <TableCell>
                {t(`roleOption.${m.role}`)}
                {m.position ? (
                  <span className="text-muted-foreground"> · {m.position}</span>
                ) : null}
              </TableCell>
              <TableCell>{m.jerseyNumber ?? "—"}</TableCell>
              <TableCell>
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
              <TableCell>
                {m.kitShirtIssued || m.kitPantsIssued || m.kitBibIssued ? (
                  <div className="flex flex-wrap gap-1">
                    {m.kitShirtIssued ? (
                      <Badge variant="secondary">{t("kitShirtLabel")}</Badge>
                    ) : null}
                    {m.kitPantsIssued ? (
                      <Badge variant="secondary">{t("kitPantsLabel")}</Badge>
                    ) : null}
                    {m.kitBibIssued ? (
                      <Badge variant="secondary">{t("kitBibLabel")}</Badge>
                    ) : null}
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{m.active ? t("activeYes") : t("activeNo")}</TableCell>
              {canManage ? (
                <TableCell className="flex justify-end gap-1 print:hidden">
                  <MembershipDialog
                    mode="edit"
                    takenJerseys={takenJerseysFor?.(m)}
                    membership={{
                      id: m.id,
                      personName: name,
                      role: m.role,
                      jerseyNumber: m.jerseyNumber,
                      positions: m.positions,
                      isCaptain: m.isCaptain,
                      position: m.position,
                      kitShirtIssued: m.kitShirtIssued,
                      kitPantsIssued: m.kitPantsIssued,
                      kitBibIssued: m.kitBibIssued,
                      active: m.active,
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
