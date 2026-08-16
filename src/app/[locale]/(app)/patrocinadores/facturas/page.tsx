import { ArrowLeftIcon } from "lucide-react";
import { isNotNull } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";

import { db } from "@/db";
import { sponsorPayments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { seasonLabel } from "@/lib/sponsorship";
import { Link } from "@/i18n/navigation";
import {
  InvoiceRegister,
  type InvoiceRow,
} from "@/components/patrocinadores/invoice-register";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  const t = await getTranslations("Patrocinadores");
  return { title: t("invoiceRegisterTitle") };
}

export default async function InvoiceRegisterPage() {
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("Patrocinadores");
  const locale = await getLocale();

  const payments = await db.query.sponsorPayments.findMany({
    where: isNotNull(sponsorPayments.invoiceNumber),
    with: { term: { with: { sponsor: true } } },
    orderBy: (p, { desc }) => [desc(p.invoicedOn), desc(p.invoiceNumber)],
  });

  const invoices: InvoiceRow[] = payments.map((payment) => {
    const sponsor = payment.term.sponsor;
    const concept = payment.year
      ? `${t("sponsorshipConcept", { name: sponsor.name })} · ${seasonLabel(payment.year)}`
      : t("sponsorshipConcept", { name: sponsor.name });
    return {
      id: payment.id,
      sponsorId: sponsor.id,
      invoiceNumber: payment.invoiceNumber!,
      invoicedOn: payment.invoicedOn,
      sponsorName: sponsor.fiscalName ?? sponsor.name,
      concept,
      amountCents: payment.amountCents,
    };
  });

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
    <div className="flex flex-1 flex-col gap-6">
      <div className="print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/patrocinadores" />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToSponsorships")}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("invoiceRegisterTitle")}
        </h1>
        <p className="text-muted-foreground">{t("invoiceRegisterSubtitle")}</p>
      </div>

      <InvoiceRegister invoices={invoices} years={years} locale={locale} />
    </div>
  );
}
