import { ClipboardListIcon, PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { DeleteInjuryReportDialog } from "@/components/personas/delete-injury-report-dialog";
import { DeleteMedicalCheckupDialog } from "@/components/personas/delete-medical-checkup-dialog";
import { MedicalCheckupDialog } from "@/components/personas/medical-checkup-dialog";
import { EntityFileTable } from "@/components/entity-file-table";
import { SectionHeading } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MedicalCheckup = {
  id: string;
  occurredOn: string;
  expiresOn: string | null;
  issuer: string | null;
  notes: string | null;
};

type InjuryReport = {
  id: string;
  occurredOn: string;
};

type PersonMedicalTabProps = {
  personId: string;
  canManageMedical: boolean;
  membershipsCount: number;
  medicalCheckups: MedicalCheckup[];
  medicalCheckupFileUrls: Map<string, string>;
  injuryReports: InjuryReport[];
  injuryReportFileUrls: Map<string, string>;
  today: string;
};

/** Pestaña "Médico" de la ficha de persona: reconocimientos médicos y partes de lesión. */
export async function PersonMedicalTab({
  personId,
  canManageMedical,
  membershipsCount,
  medicalCheckups,
  medicalCheckupFileUrls,
  injuryReports,
  injuryReportFileUrls,
  today,
}: PersonMedicalTabProps) {
  const t = await getTranslations("Personas");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <SectionHeading
          title={t("medicalCheckupsSection")}
          actions={
            canManageMedical ? <MedicalCheckupDialog mode="create" personId={personId} /> : null
          }
        />
        {medicalCheckups.length === 0 ? (
          <SectionPlaceholder size="compact" title={t("noMedicalCheckupsDescription")} />
        ) : (
          <>
            {(() => {
              const latest = medicalCheckups[0];
              const isExpired = latest.expiresOn ? latest.expiresOn < today : false;
              return latest.expiresOn ? (
                <Badge variant={isExpired ? "destructive" : "secondary"} className="w-fit">
                  {isExpired
                    ? t("medicalCheckupExpiredBadge", { date: latest.expiresOn })
                    : t("medicalCheckupExpiresBadge", { date: latest.expiresOn })}
                </Badge>
              ) : null;
            })()}
            <EntityFileTable
              items={medicalCheckups}
              canManage={canManageMedical}
              actionsLabel={t("colActions")}
              viewFileLabel={t("medicalCheckupViewFile")}
              fileUrl={(m) => medicalCheckupFileUrls.get(m.id) ?? null}
              columns={[
                {
                  header: t("medicalCheckupOccurredOnLabel"),
                  cell: (m) => m.occurredOn,
                  className: "font-medium",
                },
                {
                  header: t("medicalCheckupIssuerLabel"),
                  cell: (m) => m.issuer ?? "—",
                  priority: "tertiary",
                },
                {
                  header: t("medicalCheckupExpiresOnLabel"),
                  priority: "secondary",
                  cell: (m) => {
                    if (!m.expiresOn) return "—";
                    const isExpired = m.expiresOn < today;
                    return (
                      <Badge variant={isExpired ? "destructive" : "secondary"}>
                        {isExpired
                          ? t("medicalCheckupExpiredBadge", { date: m.expiresOn })
                          : t("medicalCheckupExpiresBadge", { date: m.expiresOn })}
                      </Badge>
                    );
                  },
                },
              ]}
              renderActions={(m) => (
                <>
                  <MedicalCheckupDialog
                    mode="edit"
                    checkup={{
                      id: m.id,
                      occurredOn: m.occurredOn,
                      expiresOn: m.expiresOn,
                      issuer: m.issuer,
                      notes: m.notes,
                    }}
                    fileUrl={medicalCheckupFileUrls.get(m.id) ?? null}
                  />
                  <DeleteMedicalCheckupDialog id={m.id} date={m.occurredOn} />
                </>
              )}
            />
          </>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading
          title={t("injuryReportsSection")}
          actions={
            canManageMedical ? (
              /* Sin ficha en ningún equipo no hay parte que tramitar: lo
                 cubre la licencia federativa del jugador con su equipo
                 (ver la página del parte, que rechaza el alta igual). */
              membershipsCount === 0 ? (
                <p className="text-xs text-muted-foreground">{t("injuryReportNoTeamHint")}</p>
              ) : (
                <Button
                  render={<Link href={`/personas/${personId}/parte-lesion/nuevo`} />}
                  nativeButton={false}
                >
                  <PlusIcon data-icon="inline-start" />
                  {t("addInjuryReportAction")}
                </Button>
              )
            ) : null
          }
        />
        {injuryReports.length === 0 ? (
          <SectionPlaceholder size="compact" title={t("noInjuryReportsDescription")} />
        ) : (
          <EntityFileTable
            items={injuryReports}
            canManage={canManageMedical}
            actionsLabel={t("colActions")}
            viewFileLabel={t("injuryReportViewFile")}
            fileUrl={(r) => injuryReportFileUrls.get(r.id) ?? null}
            columns={[
              {
                header: t("injuryReportOccurredOnLabel"),
                cell: (r) => r.occurredOn,
                className: "font-medium",
              },
            ]}
            renderActions={(r) => (
              <>
                {canManageMedical ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    render={<Link href={`/personas/${personId}/parte-lesion/${r.id}`} />}
                    nativeButton={false}
                  >
                    <ClipboardListIcon />
                    <span className="sr-only">
                      {t("injuryReportFederationSr", { date: r.occurredOn })}
                    </span>
                  </Button>
                ) : null}
                <DeleteInjuryReportDialog id={r.id} date={r.occurredOn} />
              </>
            )}
          />
        )}
      </div>
    </div>
  );
}
