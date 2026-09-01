"use client";

import type { ReactNode } from "react";
import { TriangleAlertIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFilterParams } from "@/hooks/use-filter-params";
import { DeleteMembershipDialog } from "@/components/equipos/delete-membership-dialog";
import { MembershipDialog } from "@/components/equipos/membership-dialog";
import { MembershipFederationCardDialog } from "@/components/equipos/membership-federation-card-dialog";
import { EmptyValue } from "@/components/empty-value";
import { Link } from "@/i18n/navigation";
import {
  MEDICAL_EXPIRY_WINDOW_DAYS,
  medicalCertStatus,
  type MedicalCertStatus,
} from "@/lib/medical-status";
import { StatusBadge } from "@/components/status-badge";
import type { StatusTone } from "@/lib/status-tone";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const FILTER_DEFAULTS = { vista: "roster" };

const MEDICAL_TONE: Record<MedicalCertStatus, StatusTone> = {
  expired: "danger",
  missing: "warning",
  expiring: "warning",
  ok: "positive",
  exempt: "neutral",
};

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
  const [{ vista }, setFilters] = useFilterParams(FILTER_DEFAULTS, { navigate: false });
  const view: RosterView = vista === "datos" && !canManage ? "roster" : (vista as RosterView);
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = medicalCutoff();

  const viewLabel: Record<RosterView, string> = {
    roster: t("viewRosterOption"),
    medico: t("viewMedicoOption"),
    tallas: t("viewTallasOption"),
    datos: t("viewDatosOption"),
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        <Select value={view} onValueChange={(value) => value && setFilters({ vista: value })}>
          <SelectTrigger className="w-48" aria-label={t("viewLabel")}>
            <SelectValue>{(value: RosterView) => viewLabel[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="roster">{t("viewRosterOption")}</SelectItem>
            <SelectItem value="medico">{t("viewMedicoOption")}</SelectItem>
            <SelectItem value="tallas">{t("viewTallasOption")}</SelectItem>
            {canManage ? <SelectItem value="datos">{t("viewDatosOption")}</SelectItem> : null}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colPerson")}</TableHead>
            <TableHead>{t("colJersey")}</TableHead>
            {view === "roster" ? (
              <>
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
                <TableHead>{t("colNationalId")}</TableHead>
                <TableHead priority="secondary">{t("colPhone")}</TableHead>
                <TableHead priority="tertiary">{t("colAddress")}</TableHead>
              </>
            ) : null}
            {canManage ? (
              <TableHead className="text-right print:hidden">{t("colActions")}</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    {m.photoUrl ? <AvatarImage src={m.photoUrl} alt="" /> : null}
                    <AvatarFallback>
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
                    >
                      <TriangleAlertIcon className="size-4 text-destructive" />
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{m.jerseyNumber ?? <EmptyValue />}</TableCell>
              {view === "roster" ? (
                <>
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
                  <TableCell>{m.nationalId ?? <EmptyValue />}</TableCell>
                  <TableCell priority="secondary">{m.phone ?? <EmptyValue />}</TableCell>
                  <TableCell priority="tertiary">
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
  return <StatusBadge tone={MEDICAL_TONE[status]} label={label} />;
}

/** Ventana de aviso del certificado médico, calculada en cliente al pintar la tabla. */
function medicalCutoff(): string {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + MEDICAL_EXPIRY_WINDOW_DAYS);
  return cutoffDate.toISOString().slice(0, 10);
}
