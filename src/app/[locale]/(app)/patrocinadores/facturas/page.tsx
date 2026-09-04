import { isNotNull } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { sponsorPayments } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { seasonLabel } from "@/lib/sponsorship";
import { PageHeader } from "@/components/page-header";
import {
  InvoiceRegister,
  type InvoiceRow,
} from "@/components/patrocinadores/invoice-register";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Patrocinadores" });
  return { title: t("invoiceRegisterTitle") };
}

export default async function InvoiceRegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  await requirePermission("patrocinadores.view");
  const t = await getTranslations("Patrocinadores");

  // Vista filtrada del registro fiscal único: las anualidades que ya tienen
  // factura emitida. Los datos salen de la factura, no del patrocinador, que
  // es lo que impide que renombrar la empresa reescriba facturas pasadas.
  // Se consulta desde `sponsor_payments` porque el recibo imprimible sigue
  // colgando de la anualidad.
  const payments = await db.query.sponsorPayments.findMany({
    where: isNotNull(sponsorPayments.issuedInvoiceId),
    with: { term: { columns: { sponsorId: true } }, issuedInvoice: true },
  });

  const invoices: InvoiceRow[] = payments.map((payment) => {
    const invoice = payment.issuedInvoice!;
    const concept =
      invoice.concept ??
      (payment.year
        ? `${t("sponsorshipConcept", { name: invoice.customerName })} · ${seasonLabel(payment.year)}`
        : t("sponsorshipConcept", { name: invoice.customerName }));
    return {
      id: payment.id,
      sponsorId: payment.term.sponsorId,
      invoiceNumber: invoice.number,
      invoicedOn: invoice.issuedOn,
      sponsorName: invoice.customerName,
      concept,
      amountCents: invoice.totalCents,
    };
  });

  // El orden lo marca la factura, no la anualidad, así que se ordena aquí:
  // `orderBy` de la query relacional solo alcanza columnas de `sponsor_payments`.
  invoices.sort(
    (a, b) =>
      (b.invoicedOn ?? "").localeCompare(a.invoicedOn ?? "") ||
      b.invoiceNumber.localeCompare(a.invoiceNumber),
  );

  const years = [
    ...new Set(
      invoices
        .map((inv) => inv.invoicedOn?.slice(0, 4))
        .filter((y): y is string => Boolean(y)),
    ),
  ]
    .map(Number)
    .sort((a, b) => b - a);

  return (
    /*
      `print:p-[14mm]` porque esta página imprime sin ser una `PrintableSheet`:
      `@page` ya no da margen (lo pone la hoja como padding), así que sin esto
      saldría a sangre.
    */
    <div className="flex flex-1 flex-col gap-6 print:p-[14mm]">
      <PageHeader
        back={{ href: "/patrocinadores", label: t("backToSponsorships") }}
        title={t("invoiceRegisterTitle")}
        description={t("invoiceRegisterSubtitle")}
      />

      <InvoiceRegister invoices={invoices} years={years} locale={locale} />
    </div>
  );
}
