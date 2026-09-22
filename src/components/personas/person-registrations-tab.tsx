import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format-date";
import { STATUS_TONE } from "@/lib/registration-status";
import { SectionHeading } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Registration = {
  id: string;
  kind: "player" | "member";
  status: keyof typeof STATUS_TONE;
  createdAt: Date;
};

type PersonRegistrationsTabProps = {
  locale: string;
  registrations: Registration[];
};

/** Pestaña "Inscripciones" de la ficha de persona: histórico de inscripciones web. */
export async function PersonRegistrationsTab({ locale, registrations }: PersonRegistrationsTabProps) {
  const t = await getTranslations("Personas");
  const tInscripciones = await getTranslations("Inscripciones");

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title={t("registrationsSection")} />
      {registrations.length === 0 ? (
        <SectionPlaceholder size="compact" title={t("noRegistrationsDescription")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tInscripciones("colKind")}</TableHead>
              <TableHead>{tInscripciones("colStatus")}</TableHead>
              <TableHead>{tInscripciones("colDate")}</TableHead>
              <TableHead className="text-right">{t("viewRegistrationAction")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Badge variant="outline">{tInscripciones(`kind.${r.kind}` as "kind.player")}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    tone={STATUS_TONE[r.status]}
                    label={tInscripciones(`status.${r.status}` as "status.pending")}
                  />
                </TableCell>
                <TableCell nowrap className="text-muted-foreground">
                  {formatDateTime(r.createdAt, locale)}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={r.kind === "player" ? `/inscripciones/${r.id}` : `/socios/${r.id}`}
                    className="text-primary hover:underline"
                  >
                    {t("viewRegistrationAction")}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
