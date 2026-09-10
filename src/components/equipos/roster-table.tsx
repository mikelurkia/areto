"use client";

import { useMemo, useState, type ReactNode } from "react";
import { EyeIcon, EyeOffIcon, TriangleAlertIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFilterParams } from "@/hooks/use-filter-params";
import { BulkRemoveMembershipsDialog } from "@/components/equipos/bulk-remove-memberships-dialog";
import { DeleteMembershipDialog } from "@/components/equipos/delete-membership-dialog";
import { MembershipDialog } from "@/components/equipos/membership-dialog";
import { MembershipFederationCardDialog } from "@/components/equipos/membership-federation-card-dialog";
import { EmptyValue } from "@/components/empty-value";
import { Link } from "@/i18n/navigation";
import {
  MEDICAL_CERT_TONE,
  MEDICAL_EXPIRY_WINDOW_DAYS,
  medicalCertStatus,
  type MedicalCertStatus,
} from "@/lib/medical-status";
import { StatusBadge } from "@/components/status-badge";
import { avatarToneClasses } from "@/lib/avatar-color";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RosterView = "roster" | "medico" | "tallas" | "datos";

export type RosterTableRow = {
  id: string;
  personId: string;
  name: string;
  photoUrl: string | null;
  role: "player" | "coach" | "staff";
  position: string | null;
  jerseyNumber: number | null;
  positions: string[];
  isCaptain: boolean;
  birthDate: string | null;
  birthYear: number | null;
  ageOutOfRange: boolean;
  webRegistrationMissing: boolean;
  federationCardUrl: string | null;
  installmentsCount: number | null;
  medicalCertUntil: string | null;
  shirtSize: string | null;
  pantsSize: string | null;
  shoeSize: string | null;
  nationalId: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
};

export const ROSTER_FILTER_DEFAULTS = { vista: "roster", foco: "" };

/**
 * Tabla de plantilla con vista conmutable: mismas filas (ya cargadas en la
 * ficha del equipo, sin consulta adicional), distintas columnas de detalle
 * según lo que se esté consultando en ese momento — certificado médico,
 * tallas o datos de contacto. Solo esta tabla necesita ser de cliente (para
 * reaccionar al selector sin recargar la página); `MembershipTable` sigue
 * sirviendo a la ficha de persona con sus columnas fijas de siempre.
 */
export function RosterTable({
  teamId,
  teamName,
  canManage,
  requiresCheckup,
  installmentsMode,
  minBirthYear,
  maxBirthYear,
  items,
  headerActions,
}: {
  teamId: string;
  teamName: string;
  canManage: boolean;
  requiresCheckup: boolean;
  installmentsMode: boolean;
  minBirthYear: number | null;
  maxBirthYear: number | null;
  items: readonly RosterTableRow[];
  headerActions?: ReactNode;
}) {
  const t = useTranslations("Equipos");
  const tMedico = useTranslations("Medico");
  const [{ vista, foco }, setFilters] = useFilterParams(ROSTER_FILTER_DEFAULTS, {
    navigate: false,
  });
  const view: RosterView = vista === "datos" && !canManage ? "roster" : (vista as RosterView);
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = medicalCutoff();
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(new Set());

  const focoIds = useMemo(
    () => (foco ? new Set(foco.split(",").filter(Boolean)) : null),
    [foco],
  );
  const visibleItems = focoIds ? items.filter((m) => focoIds.has(m.id)) : items;

  /**
   * Selección de plantilla para "quitar en bloque", solo con `foco` activo:
   * fuera de un aviso de salud concreto la tabla completa es demasiado grande
   * para que "seleccionar todo" sea una acción segura.
   */
  const bulkSelectable = canManage && focoIds !== null;
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectionFoco, setSelectionFoco] = useState(foco);
  if (foco !== selectionFoco) {
    setSelectionFoco(foco);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleRevealed(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        <div className="flex flex-wrap items-center gap-2">
          {focoIds ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {t("rosterFocoShowing", {
                  shown: visibleItems.length,
                  total: items.length,
                })}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setFilters({ foco: "" })}>
                {t("rosterFocoClear")}
              </Button>
            </div>
          ) : null}
          {bulkSelectable && selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t("rosterBulkSelectedCount", { count: selectedIds.size })}</span>
              <BulkRemoveMembershipsDialog
                ids={[...selectedIds]}
                onSuccess={() => setSelectedIds(new Set())}
              />
            </div>
          ) : null}
          <Tabs
            value={view}
            onValueChange={(value) => setFilters({ vista: value as RosterView })}
            aria-label={t("viewLabel")}
          >
            <TabsList variant="default">
              <TabsTrigger value="roster">{t("viewRosterOption")}</TabsTrigger>
              <TabsTrigger value="medico">{t("viewMedicoOption")}</TabsTrigger>
              <TabsTrigger value="tallas">{t("viewTallasOption")}</TabsTrigger>
              {canManage ? (
                <TabsTrigger value="datos">{t("viewDatosOption")}</TabsTrigger>
              ) : null}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {bulkSelectable ? (
              <TableHead className="w-8 print:hidden">
                <Checkbox
                  checked={
                    visibleItems.length > 0 && selectedIds.size === visibleItems.length
                  }
                  onCheckedChange={(checked) =>
                    setSelectedIds(
                      checked === true ? new Set(visibleItems.map((m) => m.id)) : new Set(),
                    )
                  }
                  aria-label={t("rosterBulkSelectAllSr")}
                />
              </TableHead>
            ) : null}
            <TableHead>{t("colPerson")}</TableHead>
            <TableHead>{t("colJersey")}</TableHead>
            {view === "roster" ? (
              <>
                <TableHead priority="secondary">{t("colBirthDate")}</TableHead>
                <TableHead priority="secondary">{t("roleLabel")}</TableHead>
                <TableHead priority="tertiary">{t("colPositions")}</TableHead>
                <TableHead priority="secondary" className="print:hidden">
                  {t("federationCardLabel")}
                </TableHead>
              </>
            ) : null}
            {view === "medico" ? <TableHead>{t("colMedicalCert")}</TableHead> : null}
            {view === "tallas" ? (
              <>
                <TableHead>{t("colShirtSize")}</TableHead>
                <TableHead priority="secondary">{t("colPantsSize")}</TableHead>
                <TableHead priority="secondary">{t("colShoeSize")}</TableHead>
              </>
            ) : null}
            {view === "datos" ? (
              <>
                <TableHead className="print:hidden">{t("colNationalId")}</TableHead>
                <TableHead priority="secondary" className="print:hidden">
                  {t("colPhone")}
                </TableHead>
                <TableHead priority="tertiary" className="print:hidden">
                  {t("colAddress")}
                </TableHead>
              </>
            ) : null}
            {canManage ? (
              <TableHead className="text-right print:hidden">{t("colActions")}</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleItems.map((m) => (
            <TableRow key={m.id}>
              {bulkSelectable ? (
                <TableCell className="print:hidden">
                  <Checkbox
                    checked={selectedIds.has(m.id)}
                    onCheckedChange={(checked) => toggleSelected(m.id, checked === true)}
                    aria-label={t("rosterBulkSelectRowSr", { name: m.name })}
                  />
                </TableCell>
              ) : null}
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    {m.photoUrl ? <AvatarImage src={m.photoUrl} alt="" /> : null}
                    <AvatarFallback className={avatarToneClasses(m.personId)}>
                      <UserRoundIcon className="size-3" />
                    </AvatarFallback>
                  </Avatar>
                  <Link
                    href={`/personas/${m.personId}?from=${encodeURIComponent(`/equipos/${teamId}`)}&fromLabel=${encodeURIComponent(teamName)}`}
                    className="hover:underline"
                  >
                    {m.name}
                  </Link>
                  {m.isCaptain ? (
                    <Badge variant="outline" title={t("captainLabel")}>
                      {t("captainShort")}
                    </Badge>
                  ) : null}
                  {m.webRegistrationMissing ? (
                    <Badge variant="destructive" title={t("webRegistrationMissingLabel")}>
                      {t("webRegistrationMissingShort")}
                    </Badge>
                  ) : null}
                  {m.ageOutOfRange ? (
                    <span
                      title={t("ageOutOfRangeLabel", {
                        year: m.birthYear!,
                        min: minBirthYear!,
                        max: maxBirthYear!,
                      })}
                      aria-label={t("ageOutOfRangeLabel", {
                        year: m.birthYear!,
                        min: minBirthYear!,
                        max: maxBirthYear!,
                      })}
                    >
                      <TriangleAlertIcon className="size-4 text-destructive" aria-hidden />
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{m.jerseyNumber ?? <EmptyValue />}</TableCell>
              {view === "roster" ? (
                <>
                  <TableCell priority="secondary">{m.birthDate ?? <EmptyValue />}</TableCell>
                  <TableCell priority="secondary">
                    {t(`roleOption.${m.role}`)}
                    {m.position ? (
                      <span className="text-muted-foreground"> · {m.position}</span>
                    ) : null}
                  </TableCell>
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
                      <EmptyValue />
                    )}
                  </TableCell>
                  <TableCell className="print:hidden">
                    <div className="flex items-center gap-1">
                      {m.federationCardUrl ? (
                        <a
                          href={m.federationCardUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {t("documentViewFile")}
                        </a>
                      ) : (
                        <EmptyValue />
                      )}
                      {canManage ? (
                        <MembershipFederationCardDialog
                          membershipId={m.id}
                          fileUrl={m.federationCardUrl}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </>
              ) : null}
              {view === "medico" ? (
                <TableCell>
                  <MedicalBadge
                    status={medicalCertStatus(m.medicalCertUntil, today, cutoff, requiresCheckup)}
                    date={m.medicalCertUntil}
                    t={tMedico}
                  />
                </TableCell>
              ) : null}
              {view === "tallas" ? (
                <>
                  <TableCell>{m.shirtSize ?? <EmptyValue />}</TableCell>
                  <TableCell priority="secondary">{m.pantsSize ?? <EmptyValue />}</TableCell>
                  <TableCell priority="secondary">{m.shoeSize ?? <EmptyValue />}</TableCell>
                </>
              ) : null}
              {view === "datos" ? (
                <>
                  <TableCell className="print:hidden">
                    {m.nationalId ? (
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums">
                          {revealedIds.has(m.id) ? m.nationalId : maskNationalId(m.nationalId)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleRevealed(m.id)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={
                            revealedIds.has(m.id) ? t("rosterHideNationalId") : t("rosterRevealNationalId")
                          }
                        >
                          {revealedIds.has(m.id) ? (
                            <EyeOffIcon className="size-3.5" />
                          ) : (
                            <EyeIcon className="size-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <EmptyValue />
                    )}
                  </TableCell>
                  <TableCell priority="secondary" className="print:hidden">
                    {m.phone ?? <EmptyValue />}
                  </TableCell>
                  <TableCell priority="tertiary" className="print:hidden">
                    {[m.address, m.postalCode, m.city].filter(Boolean).join(", ") || (
                      <EmptyValue />
                    )}
                  </TableCell>
                </>
              ) : null}
              {canManage ? (
                <TableCell className="flex justify-end gap-1 print:hidden">
                  <MembershipDialog
                    mode="edit"
                    membership={{
                      id: m.id,
                      personName: m.name,
                      role: m.role,
                      jerseyNumber: m.jerseyNumber,
                      positions: m.positions,
                      position: m.position,
                      installmentsCount: m.installmentsCount,
                    }}
                    installmentsMode={installmentsMode}
                  />
                  <DeleteMembershipDialog id={m.id} name={m.name} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MedicalBadge({
  status,
  date,
  t,
}: {
  status: MedicalCertStatus;
  date: string | null;
  t: ReturnType<typeof useTranslations<"Medico">>;
}) {
  const label =
    status === "exempt"
      ? t("statusExemptBadge")
      : status === "missing"
        ? t("statusMissingBadge")
        : status === "expired"
          ? t("statusExpiredBadge", { date: date! })
          : status === "expiring"
            ? t("statusExpiringBadge", { date: date! })
            : t("statusOkBadge", { date: date! });
  return <StatusBadge tone={MEDICAL_CERT_TONE[status]} label={label} />;
}

/** Oculta todo salvo los 3 últimos caracteres, para no dejar el DNI/NIE a la vista por defecto. */
function maskNationalId(value: string): string {
  if (value.length <= 3) return value;
  return "•".repeat(value.length - 3) + value.slice(-3);
}

/** Ventana de aviso del certificado médico, calculada en cliente al pintar la tabla. */
function medicalCutoff(): string {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + MEDICAL_EXPIRY_WINDOW_DAYS);
  return cutoffDate.toISOString().slice(0, 10);
}
