import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { persons } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { calculateAge } from "@/lib/age";
import { teamSeasonLabel } from "@/lib/team-label";
import { Link } from "@/i18n/navigation";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";

/**
 * Todo lo que el club guarda de la persona (el informe RGPD es exhaustivo).
 * En `cache()` para no repetir la consulta en `generateMetadata`.
 */
const getPersonRecord = cache((personId: string) =>
  db.query.persons.findFirst({
    where: eq(persons.id, personId),
    with: {
      guardian: true,
      dependents: true,
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
    <div className="flex justify-between gap-6 border-b py-1.5 text-sm last:border-b-0">
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
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
  await requireRole(["admin", "staff"]);
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

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 rounded-lg border p-8">
        {/* Cabecera: responsable del tratamiento + título */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t("rgpdReportTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">{fullName}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{club?.legalName ?? "Areto"}</p>
            {club?.taxId ? (
              <p className="text-xs text-muted-foreground">{club.taxId}</p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
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
            value={person.isMember ? t("rgpdYes") : t("rgpdNo")}
          />
        </Section>

        <Section title={t("contactSection")}>
          <Row label={t("emailLabel")} value={person.email} />
          <Row label={t("phoneLabel")} value={person.phone} />
          <Row label={t("addressLabel")} value={person.address} />
          <Row label={t("cityLabel")} value={person.city} />
          <Row label={t("ibanLabel")} value={person.iban} />
        </Section>

        <Section title={t("rgpdOtherDataSection")}>
          <Row label={t("medicalCertLabel")} value={person.medicalCertUntil} />
          <Row label={t("shirtSizeLabel")} value={person.shirtSize} />
          <Row label={t("pantsSizeLabel")} value={person.pantsSize} />
          <Row label={t("shoeSizeLabel")} value={person.shoeSize} />
          <Row
            label={t("photoConsentLabel")}
            value={person.photoConsent ? t("rgpdYes") : t("rgpdNo")}
          />
          <Row
            label={t("rgpdHasPhotoLabel")}
            value={person.photoPath ? t("rgpdYes") : t("rgpdNo")}
          />
          <Row label={t("notesLabel")} value={person.notes} />
        </Section>

        {person.guardian || person.dependents.length > 0 ? (
          <Section title={t("tabFamily")}>
            {person.guardian ? (
              <Row
                label={t("rgpdGuardianLabel")}
                value={`${person.guardian.firstName} ${person.guardian.lastName}`}
              />
            ) : null}
            {person.dependents.map((d) => (
              <Row
                key={d.id}
                label={t("rgpdDependentLabel")}
                value={`${d.firstName} ${d.lastName}`}
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
            <p className="text-sm">{person.tags.map((tag) => tag.tag).join(", ")}</p>
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

        <p className="border-t pt-4 text-xs text-muted-foreground">
          {t("rgpdFooter")}
        </p>
      </div>
    </div>
  );
}
