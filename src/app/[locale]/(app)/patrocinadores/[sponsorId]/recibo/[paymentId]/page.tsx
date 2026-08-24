import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { sponsorPayments } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import { seasonLabel } from "@/lib/sponsorship";
import { Link } from "@/i18n/navigation";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; sponsorId: string; paymentId: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Patrocinadores" });
  return { title: t("invoiceTitle") };
}

export default async function SponsorInvoicePage({
  params,
}: {
  params: Promise<{ locale: string; sponsorId: string; paymentId: string }>;
}) {
  const { locale, sponsorId, paymentId } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("patrocinadores.view");
  const t = await getTranslations("Patrocinadores");

  const [payment, club] = await Promise.all([
    db.query.sponsorPayments.findFirst({
      where: eq(sponsorPayments.id, paymentId),
      with: { term: { with: { sponsor: true } } },
    }),
    getClubSettings(),
  ]);
  if (!payment || payment.term.sponsor.id !== sponsorId) notFound();

  const sponsor = payment.term.sponsor;
  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(payment.amountCents / 100);

  const concept = payment.year
    ? `${t("sponsorshipConcept", { name: sponsor.name })} · ${seasonLabel(payment.year)}`
    : t("sponsorshipConcept", { name: sponsor.name });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/patrocinadores/${sponsorId}`} />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToSponsor")}
        </Button>
        <PrintButton label={t("printAction")} />
      </div>

      {!payment.invoiceNumber ? (
        <p className="mx-auto w-full max-w-xl rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground print:hidden">
          {t("notInvoicedYet")}
        </p>
      ) : null}

      <div className="mx-auto w-full max-w-xl rounded-lg border p-8">
        {/* Cabecera: título + número/fecha de factura */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("invoiceTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {club?.legalName ?? "Areto"}
            </p>
          </div>
          <div className="text-right text-sm">
            {payment.invoiceNumber ? (
              <>
                <p className="text-muted-foreground">{t("invoiceNumberLabel")}</p>
                <p className="font-medium">{payment.invoiceNumber}</p>
              </>
            ) : null}
            {payment.invoicedOn ? (
              <p className="mt-1 text-xs text-muted-foreground">{payment.invoicedOn}</p>
            ) : null}
          </div>
        </div>

        {/* Emisor y receptor */}
        <div className="mb-8 grid grid-cols-2 gap-6">
          <div>
            <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
              {t("invoiceFrom")}
            </p>
            <p className="font-medium">{club?.legalName ?? "Areto"}</p>
            {club?.taxId ? (
              <p className="text-sm text-muted-foreground">{club.taxId}</p>
            ) : null}
            {club?.address ? (
              <p className="text-sm text-muted-foreground">{club.address}</p>
            ) : null}
            {club?.email ? (
              <p className="text-sm text-muted-foreground">{club.email}</p>
            ) : null}
          </div>
          <div>
            <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
              {t("invoiceTo")}
            </p>
            <p className="font-medium">{sponsor.fiscalName ?? sponsor.name}</p>
            {sponsor.taxId ? (
              <p className="text-sm text-muted-foreground">{sponsor.taxId}</p>
            ) : null}
            {sponsor.fiscalAddress ? (
              <p className="text-sm text-muted-foreground">{sponsor.fiscalAddress}</p>
            ) : null}
          </div>
        </div>

        {/* Concepto y total (operación sin IVA) */}
        <div className="flex items-start justify-between border-y py-3 text-sm">
          <span className="text-muted-foreground">{t("conceptLabel")}</span>
          <span className="max-w-xs text-right font-medium">{concept}</span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="font-semibold">{t("totalLabel")}</span>
          <span className="text-lg font-semibold">{amount}</span>
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">{t("vatExempt")}</p>

        {club?.iban ? (
          <div className="mt-6 border-t pt-4 text-sm">
            <span className="text-muted-foreground">{t("ibanLabel")}: </span>
            <span className="font-medium">{club.iban}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
