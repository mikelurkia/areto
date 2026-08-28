import { getTranslations } from "next-intl/server";

import type { GuardianData } from "@/components/inscripciones/guardian-review-fields";
import type { MemberRegistrationDetail } from "@/components/inscripciones/member-review-form";
import type { RegistrationDetail } from "@/components/inscripciones/review-form";
import { InfoRow } from "@/components/info-row";
import { MaskedIbanText } from "@/components/masked-iban";
import { ConsentRow } from "@/components/match-select";
import { Card } from "@/components/ui/card";

async function GuardianSummary({ guardian, index }: { guardian: GuardianData; index: number }) {
  const t = await getTranslations("Inscripciones");
  return (
    <Card className="gap-3 px-(--card-spacing)">
      <span className="text-sm font-medium">
        {t("guardianLabel")} {index + 1}
      </span>
      <dl className="grid gap-3 sm:grid-cols-2">
        <InfoRow label={t("firstNameLabel")} value={guardian.firstName} />
        <InfoRow label={t("lastNameLabel")} value={guardian.lastName} />
        <InfoRow label={t("birthDateLabel")} value={guardian.birthDate} />
        <InfoRow label={t("nationalIdLabel")} value={guardian.nationalId} />
        <InfoRow label={t("addressLabel")} value={guardian.address} />
        <InfoRow label={t("postalCodeLabel")} value={guardian.postalCode} />
        <InfoRow label={t("cityLabel")} value={guardian.city} />
        <InfoRow label={t("phoneLabel")} value={guardian.phone} />
        <InfoRow label={t("emailLabel")} value={guardian.email} />
      </dl>
    </Card>
  );
}

function GuardiansSummarySection({
  guardians,
  title,
}: {
  guardians: GuardianData[];
  title: string;
}) {
  if (guardians.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="flex flex-col gap-3">
        {guardians.map((g, i) => (
          <GuardianSummary key={g.id} guardian={g} index={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Resumen de solo lectura de una inscripción pendiente, para quien puede verla
 * (`inscripciones.view`/`socios.view`) pero no gestionarla. Reutiliza las
 * mismas claves de traducción y componentes de `review-form.tsx`/
 * `member-review-form.tsx` — sin los campos editables ni los botones de
 * aprobar/rechazar.
 */
export async function PlayerRegistrationSummary({
  registration,
}: {
  registration: RegistrationDetail;
}) {
  const t = await getTranslations("Inscripciones");
  return (
    <Card className="gap-6 px-(--card-spacing)">
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("playerSection")}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <InfoRow label={t("firstNameLabel")} value={registration.firstName} />
          <InfoRow label={t("lastNameLabel")} value={registration.lastName} />
          <InfoRow label={t("birthDateLabel")} value={registration.birthDate} />
          <InfoRow label={t("nationalIdLabel")} value={registration.nationalId} />
          <InfoRow label={t("addressLabel")} value={registration.address} />
          <InfoRow label={t("postalCodeLabel")} value={registration.postalCode} />
          <InfoRow label={t("cityLabel")} value={registration.city} />
          <InfoRow label={t("phoneLabel")} value={registration.phone} />
          <InfoRow label={t("emailLabel")} value={registration.email} />
          <InfoRow label={t("shirtSizeLabel")} value={registration.shirtSize} />
          <InfoRow label={t("pantsSizeLabel")} value={registration.pantsSize} />
          <InfoRow label={t("shoeSizeLabel")} value={registration.shoeSize} />
        </dl>
      </div>

      <GuardiansSummarySection guardians={registration.guardians} title={t("guardiansSection")} />

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("paymentSection")}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <InfoRow
            label={t("ibanLabel")}
            value={registration.iban ? <MaskedIbanText value={registration.iban} /> : null}
          />
          <InfoRow
            label={t("installmentsLabel")}
            value={
              registration.installmentsChosen === 2 ? t("installmentsTwo") : t("installmentsOne")
            }
          />
        </dl>
        <Card size="sm" className="gap-2 px-(--card-spacing)">
          <ConsentRow label={t("sepaConsentShortLabel")} granted={registration.sepaConsent} />
          <ConsentRow label={t("termsConsentShortLabel")} granted={registration.termsConsent} />
          <ConsentRow label={t("imageConsentShortLabel")} granted={registration.photoConsent} />
          <ConsentRow
            label={t("privacyConsentShortLabel")}
            granted={registration.privacyConsent}
          />
        </Card>
      </div>
    </Card>
  );
}

export async function MemberRegistrationSummary({
  registration,
}: {
  registration: MemberRegistrationDetail;
}) {
  const t = await getTranslations("Inscripciones");
  return (
    <Card className="gap-6 px-(--card-spacing)">
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("memberSection")}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <InfoRow label={t("firstNameLabel")} value={registration.firstName} />
          <InfoRow label={t("lastNameLabel")} value={registration.lastName} />
          <InfoRow label={t("birthDateLabel")} value={registration.birthDate} />
          <InfoRow label={t("nationalIdLabel")} value={registration.nationalId} />
          <InfoRow label={t("addressLabel")} value={registration.address} />
          <InfoRow label={t("postalCodeLabel")} value={registration.postalCode} />
          <InfoRow label={t("cityLabel")} value={registration.city} />
          <InfoRow label={t("phoneLabel")} value={registration.phone} />
          <InfoRow label={t("emailLabel")} value={registration.email} />
        </dl>
      </div>

      <GuardiansSummarySection guardians={registration.guardians} title={t("guardiansSection")} />

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("paymentSection")}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <InfoRow
            label={t("ibanLabel")}
            value={registration.iban ? <MaskedIbanText value={registration.iban} /> : null}
          />
        </dl>
        <Card size="sm" className="gap-2 px-(--card-spacing)">
          <ConsentRow label={t("sepaConsentShortLabel")} granted={registration.sepaConsent} />
          <ConsentRow
            label={t("privacyConsentShortLabel")}
            granted={registration.privacyConsent}
          />
        </Card>
      </div>
    </Card>
  );
}
