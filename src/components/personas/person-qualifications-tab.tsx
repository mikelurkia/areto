import { getTranslations } from "next-intl/server";

import { DeleteQualificationDialog } from "@/components/personas/delete-qualification-dialog";
import { QualificationDialog } from "@/components/personas/qualification-dialog";
import { EntityFileTable } from "@/components/entity-file-table";
import { SectionHeading } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";

type Qualification = {
  id: string;
  title: string;
  issuer: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  notes: string | null;
};

type PersonQualificationsTabProps = {
  personId: string;
  canManage: boolean;
  qualifications: Qualification[];
  qualificationFileUrls: Map<string, string>;
  today: string;
};

/** Pestaña "Titulaciones" de la ficha de persona. */
export async function PersonQualificationsTab({
  personId,
  canManage,
  qualifications,
  qualificationFileUrls,
  today,
}: PersonQualificationsTabProps) {
  const t = await getTranslations("Personas");

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title={t("qualificationsSection")}
        actions={canManage ? <QualificationDialog mode="create" personId={personId} /> : null}
      />
      {qualifications.length === 0 ? (
        <SectionPlaceholder size="compact" title={t("noQualificationsDescription")} />
      ) : (
        <EntityFileTable
          items={qualifications}
          canManage={canManage}
          actionsLabel={t("colActions")}
          viewFileLabel={t("qualificationViewFile")}
          fileUrl={(q) => qualificationFileUrls.get(q.id) ?? null}
          columns={[
            { header: t("qualificationTitleLabel"), cell: (q) => q.title, className: "font-medium" },
            {
              header: t("qualificationIssuerLabel"),
              cell: (q) => q.issuer ?? "—",
              priority: "tertiary",
            },
            {
              header: t("qualificationExpiresOnLabel"),
              priority: "secondary",
              cell: (q) => {
                if (!q.expiresOn) return "—";
                const isExpired = q.expiresOn < today;
                return (
                  <Badge variant={isExpired ? "destructive" : "secondary"}>
                    {isExpired
                      ? t("qualificationExpiredBadge", { date: q.expiresOn })
                      : t("qualificationExpiresBadge", { date: q.expiresOn })}
                  </Badge>
                );
              },
            },
          ]}
          renderActions={(q) => (
            <>
              <QualificationDialog
                mode="edit"
                qualification={{
                  id: q.id,
                  title: q.title,
                  issuer: q.issuer,
                  issuedOn: q.issuedOn,
                  expiresOn: q.expiresOn,
                  notes: q.notes,
                }}
                fileUrl={qualificationFileUrls.get(q.id) ?? null}
              />
              <DeleteQualificationDialog id={q.id} title={q.title} />
            </>
          )}
        />
      )}
    </div>
  );
}
