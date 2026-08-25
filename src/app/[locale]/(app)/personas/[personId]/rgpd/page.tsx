import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { persons } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { calculateAge } from "@/lib/age";
import { teamSeasonLabel } from "@/lib/team-label";
import { Link } from "@/i18n/navigation";
import { PrintButton } from "@/components/print-button";
import { PrintableSheet } from "@/components/printable-sheet";
import { Button } from "@/components/ui/button";

/**
 * Todo lo que el club guarda de la persona (el informe RGPD es exhaustivo).
 * En `cache()` para no repetir la consulta en `generateMetadata`.
 */
const getPersonRecord = cache((personId: string) =>
  db.query.persons.findFirst({
    where: eq(persons.id, personId),
    with: {
      guardianRows: { with: { guardian: true } },
      guardianOfRows: { with: { person: true } },
      payerPerson: true,
      clubMember: true,
      memberships: { with: { team: { with: { season: true } } } },
      qualifications: { orderBy: (q, { desc }) => [desc(q.createdAt)] },
      documents: { orderBy: (d, { desc }) => [desc(d.createdAt)] },
      tags: { orderBy: (tag, { asc }) => [asc(tag.tag)] },
      payments: { with: { fee: { with: { season: true } } } },
    },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; personId: string }>;
}) {
  const { personId } = await params;
  const person = await getPersonRecord(personId);
  return {
    title: person ? `RGPD · ${person.firstName} ${person.lastName}` : "Areto",
  };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-6 border-b py-1.5 text-[8pt] last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[7pt] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

export default async function PersonRgpdPage({
  params,
}: {
  params: Promise<{ locale: string; personId: string }>;
}) {
  const { locale, personId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("personas.manage");
  const t = await getTranslations("Personas");
  const tEquipos = await getTranslations("Equipos");

  const [person, club] = await Promise.all([
    getPersonRecord(personId),
    getClubSettings(),
  ]);
  if (!person) notFound();

  const fullName = `${person.firstName} ${person.lastName}`;
  const generatedOn = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
  }).format(new Date());
  // Un menor no puede ser titular de un mandato SEPA: si hay tutor
  // principal pagador, el iban/consentimiento vigentes son los suyos.
  const payer = person.payerPerson;
  const consentDateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const fmtConsentDate = (d: Date | string | null) => (d ? consentDateFmt.format(new Date(d)) : null);
  const consentValue = (granted: boolean, at: Date | string | null) => {
    if (!granted) return t("rgpdNo");
    const date = fmtConsentDate(at);
    return date ? t("consentSinceLabel", { date }) : t("rgpdYes");
  };
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
      cents / 100,
    );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/personas/${person.id}`} />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToPersona")}
        </Button>
        <PrintButton label={t("printAction")} />
      </div>

      <PrintableSheet className="gap-8">
        {/* Cabecera: responsable del tratamiento + título */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <h1 className="text-[11pt] font-semibold tracking-tight">
              {t("rgpdReportTitle")}
            </h1>
            <p className="text-[8pt] text-muted-foreground">{fullName}</p>
          </div>
          <div className="text-right text-[8pt]">
            <p className="font-medium">{club?.legalName ?? "Areto"}</p>
            {club?.taxId ? (
              <p className="text-[7pt] text-muted-foreground">{club.taxId}</p>
            ) : null}
            <p className="mt-1 text-[7pt] text-muted-foreground">
              {t("rgpdGeneratedOn", { date: generatedOn })}
            </p>
          </div>
        </div>

        <Section title={t("rgpdIdentitySection")}>
          <Row label={t("firstNameLabel")} value={person.firstName} />
          <Row label={t("lastNameLabel")} value={person.lastName} />
          <Row label={t("birthDateLabel")} value={person.birthDate} />
          <Row
            label={t("rgpdAgeLabel")}
            value={person.birthDate ? calculateAge(person.birthDate) : null}
          />
          <Row label={t("nationalIdLabel")} value={person.nationalId} />
          <Row
            label={t("memberBadge")}
            value={person.clubMember?.status === "active" ? t("rgpdYes") : t("rgpdNo")}
          />
        </Section>

        <Section title={t("contactSection")}>
          <Row label={t("emailLabel")} value={person.email} />
          <Row label={t("phoneLabel")} value={person.phone} />
          <Row label={t("addressLabel")} value={person.address} />
          <Row label={t("cityLabel")} value={person.city} />
          <Row
            label={t("ibanLabel")}
            value={
              payer
                ? t("ibanHandledByGuardian", { name: `${payer.firstName} ${payer.lastName}` })
                : person.iban
            }
          />
        </Section>

        <Section title={t("rgpdOtherDataSection")}>
          <Row label={t("medicalCertLabel")} value={person.medicalCertUntil} />
          <Row label={t("shirtSizeLabel")} value={person.shirtSize} />
          <Row label={t("pantsSizeLabel")} value={person.pantsSize} />
          <Row label={t("shoeSizeLabel")} value={person.shoeSize} />
          <Row
            label={t("photoConsentLabel")}
            value={consentValue(person.photoConsent, person.photoConsentAt)}
          />
          <Row
            label={t("sepaConsentLabel")}
            value={consentValue(
              payer ? payer.sepaConsent : person.sepaConsent,
              payer ? payer.sepaConsentAt : person.sepaConsentAt,
            )}
          />
          <Row
            label={t("termsConsentLabel")}
            value={consentValue(person.termsConsent, person.termsConsentAt)}
          />
          <Row
            label={t("privacyConsentLabel")}
            value={consentValue(person.privacyConsent, person.privacyConsentAt)}
          />
          <Row
            label={t("rgpdHasPhotoLabel")}
            value={person.photoPath ? t("rgpdYes") : t("rgpdNo")}
          />
          <Row label={t("notesLabel")} value={person.notes} />
        </Section>

        {person.guardianRows.length > 0 || person.guardianOfRows.length > 0 ? (
          <Section title={t("tabFamily")}>
            {person.guardianRows.map((r) => (
              <Row
                key={r.id}
                label={t("rgpdGuardianLabel")}
                value={`${r.guardian.firstName} ${r.guardian.lastName}`}
              />
            ))}
            {person.guardianOfRows.map((r) => (
              <Row
                key={r.id}
                label={t("rgpdDependentLabel")}
                value={`${r.person.firstName} ${r.person.lastName}`}
              />
            ))}
          </Section>
        ) : null}

        {person.memberships.length > 0 ? (
          <Section title={t("teamsSection")}>
            {person.memberships.map((m) => (
              <Row
                key={m.id}
                label={teamSeasonLabel(m.team, m.team.season)}
                value={`${tEquipos(`roleOption.${m.role}`)}${
                  m.jerseyNumber ? ` · #${m.jerseyNumber}` : ""
                }`}
              />
            ))}
          </Section>
        ) : null}

        {person.qualifications.length > 0 ? (
          <Section title={t("qualificationsSection")}>
            {person.qualifications.map((q) => (
              <Row
                key={q.id}
                label={q.title}
                value={q.expiresOn ? q.expiresOn : (q.issuer ?? "—")}
              />
            ))}
          </Section>
        ) : null}

        {person.documents.length > 0 ? (
          <Section title={t("documentsSection")}>
            {person.documents.map((d) => (
              <Row key={d.id} label={d.label} value={d.fileName ?? "—"} />
            ))}
          </Section>
        ) : null}

        {person.tags.length > 0 ? (
          <Section title={t("rgpdTagsSection")}>
            <p className="text-[8pt]">{person.tags.map((tag) => tag.tag).join(", ")}</p>
          </Section>
        ) : null}

        {person.payments.length > 0 ? (
          <Section title={t("rgpdPaymentsSection")}>
            {person.payments.map((p) => (
              <Row
                key={p.id}
                label={`${p.fee.name}${p.dueDate ? ` · ${p.dueDate}` : ""}`}
                value={`${money(p.amountCents)} · ${t(`rgpdPaymentStatus.${p.status}`)}`}
              />
            ))}
          </Section>
        ) : null}

        <p className="border-t pt-4 text-[7pt] text-muted-foreground">
          {t("rgpdFooter")}
        </p>
      </PrintableSheet>
    </div>
  );
}
