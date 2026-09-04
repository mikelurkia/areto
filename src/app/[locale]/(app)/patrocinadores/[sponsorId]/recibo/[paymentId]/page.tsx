import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { sponsorPayments } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getClubBrandingAssets, getClubSettings } from "@/lib/club";
import { seasonLabel } from "@/lib/sponsorship";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { PrintableSheet } from "@/components/printable-sheet";
import { formatCents } from "@/lib/money";

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
      with: {
        term: { with: { sponsor: { columns: { id: true, name: true } } } },
        issuedInvoice: true,
      },
    }),
    getClubSettings(),
  ]);
  if (!payment || payment.term.sponsor.id !== sponsorId) notFound();
  // Aparte del `Promise.all` de arriba: por debajo dispara varias queries de
  // Storage propias (ver CLAUDE.md sobre concurrencia de queries en páginas).
  const { logoUrl } = await getClubBrandingAssets();

  // Los datos del destinatario y los importes salen de la factura emitida, que
  // los congeló el día de la emisión: leerlos en vivo del patrocinador haría
  // que renombrar la empresa reescribiese facturas ya emitidas.
  const invoice = payment.issuedInvoice;
  const amount = formatCents(invoice?.totalCents ?? payment.amountCents, locale);

  const concept =
    invoice?.concept ??
    (payment.year
      ? `${t("sponsorshipConcept", { name: payment.term.sponsor.name })} · ${seasonLabel(payment.year)}`
      : t("sponsorshipConcept", { name: payment.term.sponsor.name }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <BackLink href={`/patrocinadores/${sponsorId}`} label={t("backToSponsor")} />
        <PrintButton label={t("printAction")} />
      </div>

      {!invoice ? (
        <p className="mx-auto w-full max-w-xl rounded-md border border-dashed p-3 text-center text-[8pt] text-muted-foreground print:hidden">
          {t("notInvoicedYet")}
        </p>
      ) : null}

      <PrintableSheet>
        {/* Cabecera: título + número/fecha de factura */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-start gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-[28pt] w-auto object-contain" />
            ) : null}
            <div>
              <h1 className="text-[11pt] font-semibold tracking-tight">{t("invoiceTitle")}</h1>
              <p className="text-[8pt] text-muted-foreground">
                {club?.legalName ?? "Areto"}
              </p>
            </div>
          </div>
          <div className="text-right text-[8pt]">
            {invoice ? (
              <>
                <p className="text-muted-foreground">{t("invoiceNumberLabel")}</p>
                <p className="font-medium">{invoice.number}</p>
                <p className="mt-1 text-[7pt] text-muted-foreground">{invoice.issuedOn}</p>
              </>
            ) : null}
          </div>
        </div>

        {/* Emisor y receptor */}
        <div className="mb-8 grid grid-cols-2 gap-6">
          <div>
            <p className="mb-1 text-[7pt] tracking-wide text-muted-foreground uppercase">
              {t("invoiceFrom")}
            </p>
            <p className="font-medium">{club?.legalName ?? "Areto"}</p>
            {club?.taxId ? (
              <p className="text-[8pt] text-muted-foreground">{club.taxId}</p>
            ) : null}
            {club?.address ? (
              <p className="text-[8pt] text-muted-foreground">{club.address}</p>
            ) : null}
            {club?.email ? (
              <p className="text-[8pt] text-muted-foreground">{club.email}</p>
            ) : null}
          </div>
          <div>
            <p className="mb-1 text-[7pt] tracking-wide text-muted-foreground uppercase">
              {t("invoiceTo")}
            </p>
            <p className="font-medium">{invoice?.customerName ?? payment.term.sponsor.name}</p>
            {invoice?.customerTaxId ? (
              <p className="text-[8pt] text-muted-foreground">{invoice.customerTaxId}</p>
            ) : null}
            {invoice?.customerAddress ? (
              <p className="text-[8pt] text-muted-foreground">{invoice.customerAddress}</p>
            ) : null}
          </div>
        </div>

        {/* Concepto y total (operación sin IVA) */}
        <div className="flex items-start justify-between border-y py-3 text-[8pt]">
          <span className="text-muted-foreground">{t("conceptLabel")}</span>
          <span className="max-w-xs text-right font-medium">{concept}</span>
        </div>

        {invoice && (invoice.vatCents !== 0 || invoice.withholdingCents !== 0) ? (
          <div className="mt-3 flex flex-col gap-1 text-[8pt]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("invoiceBaseLabel")}</span>
              <span>{formatCents(invoice.baseCents, locale)}</span>
            </div>
            {invoice.vatCents !== 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("invoiceVatLabel")}</span>
                <span>{formatCents(invoice.vatCents, locale)}</span>
              </div>
            ) : null}
            {invoice.withholdingCents !== 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("invoiceWithholdingLabel")}</span>
                <span>-{formatCents(invoice.withholdingCents, locale)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <span className="font-semibold">{t("totalLabel")}</span>
          <span className="text-[10pt] font-semibold">{amount}</span>
        </div>
        {!invoice || invoice.vatCents === 0 ? (
          <p className="mt-1 text-right text-[7pt] text-muted-foreground">{t("vatExempt")}</p>
        ) : null}

        {club?.iban ? (
          <div className="mt-6 border-t pt-4 text-[8pt]">
            <span className="text-muted-foreground">{t("ibanLabel")}: </span>
            <span className="font-medium">{club.iban}</span>
          </div>
        ) : null}
      </PrintableSheet>
    </div>
  );
}
