import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getBankName } from "@/lib/bank";
import { AssignMemberNumberButton } from "@/components/personas/assign-member-number-button";
import { PersonIdScanDialog } from "@/components/personas/person-id-scan-dialog";
import { RevokeMandateDialog } from "@/components/personas/revoke-mandate-dialog";
import { InfoRow } from "@/components/info-row";
import { SectionHeading } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MaskedIbanText } from "@/components/masked-iban";
import { MailIcon, PhoneIcon, MessageCircleIcon } from "lucide-react";

type PayerPerson = {
  id: string;
  firstName: string;
  lastName: string;
  sepaConsent: boolean;
};

type Mandate = {
  status: string;
  rum: string;
};

type PersonGeneralTabProps = {
  personId: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  birthDate: string | null;
  ageTeamNames: string | null;
  nationalId: string | null;
  shirtSize: string | null;
  pantsSize: string | null;
  shoeSize: string | null;
  memberNumber: number | null;
  isMember: boolean;
  canManage: boolean;
  canViewBanking: boolean;
  canManageBanking: boolean;
  payerPerson: PayerPerson | null;
  iban: string | null;
  mandate: Mandate | null | undefined;
  effectivePayerId: string;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  photoConsent: boolean;
  photoConsentDate: string | null;
  sepaConsent: boolean;
  sepaConsentDate: string | null;
  termsConsent: boolean;
  termsConsentDate: string | null;
  privacyConsent: boolean;
  privacyConsentDate: string | null;
  notes: string | null;
};

/** Pestaña "General" de la ficha de persona: contacto, datos personales, ficha de socio, DNI y consentimientos. */
export async function PersonGeneralTab({
  personId,
  email,
  phone,
  address,
  postalCode,
  city,
  birthDate,
  ageTeamNames,
  nationalId,
  shirtSize,
  pantsSize,
  shoeSize,
  memberNumber,
  isMember,
  canManage,
  canViewBanking,
  canManageBanking,
  payerPerson,
  iban,
  mandate,
  effectivePayerId,
  idFrontUrl,
  idBackUrl,
  photoConsent,
  photoConsentDate,
  sepaConsent,
  sepaConsentDate,
  termsConsent,
  termsConsentDate,
  privacyConsent,
  privacyConsentDate,
  notes,
}: PersonGeneralTabProps) {
  const t = await getTranslations("Personas");

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-3">
        <SectionHeading title={t("contactSection")} />
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow label={t("emailLabel")} value={email} />
          <InfoRow label={t("phoneLabel")} value={phone} />
          <InfoRow label={t("addressLabel")} value={address} />
          <InfoRow label={t("postalCodeLabel")} value={postalCode} />
          <InfoRow label={t("cityLabel")} value={city} />
        </dl>
        {email || phone ? (
          <div className="flex flex-wrap gap-2 print:hidden">
            {email ? (
              <Button
                variant="outline"
                size="sm"
                render={<a href={`mailto:${email}`} />}
                nativeButton={false}
              >
                <MailIcon data-icon="inline-start" />
                {t("emailAction")}
              </Button>
            ) : null}
            {phone ? (
              <Button
                variant="outline"
                size="sm"
                render={<a href={`tel:${phone}`} />}
                nativeButton={false}
              >
                <PhoneIcon data-icon="inline-start" />
                {t("callAction")}
              </Button>
            ) : null}
            {phone ? (
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
                nativeButton={false}
              >
                <MessageCircleIcon data-icon="inline-start" />
                {t("whatsappAction")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("personalDataSection")} />
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow
            label={t("birthDateLabel")}
            value={
              birthDate ? (
                <>
                  {birthDate}
                  {ageTeamNames ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t("birthDateAgeTeamHint", { teams: ageTeamNames })}
                    </span>
                  ) : null}
                </>
              ) : null
            }
          />
          <InfoRow label={t("nationalIdLabel")} value={nationalId} />
          <InfoRow label={t("shirtSizeLabel")} value={shirtSize} />
          <InfoRow label={t("pantsSizeLabel")} value={pantsSize} />
          <InfoRow label={t("shoeSizeLabel")} value={shoeSize} />
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("memberSection")} />
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow
            label={t("memberNumberLabel")}
            value={
              memberNumber ??
              (isMember && canManage ? (
                <span className="print:hidden">
                  <AssignMemberNumberButton personId={personId} />
                </span>
              ) : null)
            }
          />
          {canViewBanking ? (
            <InfoRow
              label={payerPerson ? t("paidByLabel") : t("ibanLabel")}
              value={
                payerPerson ? (
                  <Link
                    href={`/personas/${payerPerson.id}`}
                    className="text-primary hover:underline"
                  >
                    {payerPerson.firstName} {payerPerson.lastName}
                  </Link>
                ) : iban ? (
                  <MaskedIbanText value={iban} />
                ) : null
              }
            />
          ) : null}
          {canViewBanking && !payerPerson && getBankName(iban) ? (
            <InfoRow label={t("bankLabel")} value={getBankName(iban)} />
          ) : null}
          {canViewBanking && mandate ? (
            <InfoRow
              label={t("mandateLabel")}
              value={
                mandate.status === "active"
                  ? t("mandateActiveValue", { rum: mandate.rum })
                  : t("mandateRevokedValue", { rum: mandate.rum })
              }
            />
          ) : null}
          {canManageBanking && mandate?.status === "active" ? (
            <div className="pt-1">
              <RevokeMandateDialog payerPersonId={effectivePayerId} />
            </div>
          ) : null}
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("idDocumentsSection")} />
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow
            label={t("idFrontLabel")}
            value={
              <div className="flex items-center gap-2">
                {idFrontUrl ? (
                  <a
                    href={idFrontUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t("documentViewFile")}
                  </a>
                ) : (
                  "—"
                )}
                {canManage ? (
                  <span className="print:hidden">
                    <PersonIdScanDialog personId={personId} side="front" fileUrl={idFrontUrl} />
                  </span>
                ) : null}
              </div>
            }
          />
          <InfoRow
            label={t("idBackLabel")}
            value={
              <div className="flex items-center gap-2">
                {idBackUrl ? (
                  <a
                    href={idBackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t("documentViewFile")}
                  </a>
                ) : (
                  "—"
                )}
                {canManage ? (
                  <span className="print:hidden">
                    <PersonIdScanDialog personId={personId} side="back" fileUrl={idBackUrl} />
                  </span>
                ) : null}
              </div>
            }
          />
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("consentSection")} />
        <div className="flex flex-wrap gap-1">
          {photoConsent ? (
            <Badge
              variant="secondary"
              title={photoConsentDate ? t("consentSinceLabel", { date: photoConsentDate }) : undefined}
            >
              {t("photoConsentLabel")}
            </Badge>
          ) : null}
          {sepaConsent ? (
            <Badge
              variant="secondary"
              title={sepaConsentDate ? t("consentSinceLabel", { date: sepaConsentDate }) : undefined}
            >
              {t("sepaConsentLabel")}
            </Badge>
          ) : null}
          {termsConsent ? (
            <Badge
              variant="secondary"
              title={termsConsentDate ? t("consentSinceLabel", { date: termsConsentDate }) : undefined}
            >
              {t("termsConsentLabel")}
            </Badge>
          ) : null}
          {privacyConsent ? (
            <Badge
              variant="secondary"
              title={
                privacyConsentDate ? t("consentSinceLabel", { date: privacyConsentDate }) : undefined
              }
            >
              {t("privacyConsentLabel")}
            </Badge>
          ) : null}
          {!photoConsent && !sepaConsent && !termsConsent && !privacyConsent ? "—" : null}
        </div>
      </div>

      {notes ? (
        <div className="flex flex-col gap-3 sm:col-span-2">
          <SectionHeading title={t("notesLabel")} />
          <p className="text-sm whitespace-pre-wrap">{notes}</p>
        </div>
      ) : null}
    </div>
  );
}
