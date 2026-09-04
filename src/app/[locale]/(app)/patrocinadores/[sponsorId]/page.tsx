import { StatusBadge } from "@/components/status-badge";
import { cache } from "react";
import { notFound } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  HandshakeIcon,
  ReceiptTextIcon,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { db } from "@/db";
import { sponsors } from "@/db/schema";
import {
  addSponsorDocument,
  addSponsorNote,
  deleteSponsorDocument,
  deleteSponsorNote,
  updateSponsorDocument,
} from "@/app/[locale]/(app)/patrocinadores/actions";
import { hasPermission, requirePermission } from "@/lib/auth";
import { resolveBackHref } from "@/lib/back-href";
import { fileTypeLabel } from "@/lib/file-type";
import { getPublicUrl, getSignedUrls } from "@/lib/supabase/storage";
import {
  annualEquivalentCents,
  logoThumbPath,
  seasonLabel,
  seasonYearOf,
  SPONSORSHIP_TONE,
  sponsorshipStatus,
  SPONSORSHIP_EXPIRY_WINDOW_DAYS,
} from "@/lib/sponsorship";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { DeleteSponsorContactDialog } from "@/components/patrocinadores/delete-sponsor-contact-dialog";
import { DeleteSponsorDialog } from "@/components/patrocinadores/delete-sponsor-dialog";
import { DeleteSponsorPaymentDialog } from "@/components/patrocinadores/delete-sponsor-payment-dialog";
import { DeleteSponsorshipTermDialog } from "@/components/patrocinadores/delete-sponsorship-term-dialog";
import { GenerateAnnualitiesDialog } from "@/components/patrocinadores/generate-payments-dialog";
import { IssuedInvoiceDialog } from "@/components/economia/issued-invoice-dialog";
import { MarkPaymentPaidButton } from "@/components/patrocinadores/mark-payment-paid-button";
import { RenewSponsorshipTermButton } from "@/components/patrocinadores/renew-sponsorship-term-button";
import { SponsorContactDialog } from "@/components/patrocinadores/sponsor-contact-dialog";
import { SponsorDialog } from "@/components/patrocinadores/sponsor-dialog";
import { DeleteDocumentDialog } from "@/components/delete-document-dialog";
import { DocumentDialog } from "@/components/document-dialog";
import { InfoRow } from "@/components/info-row";
import { NotesLog } from "@/components/notes-log";
import { SponsorPaymentDialog } from "@/components/patrocinadores/sponsor-payment-dialog";
import { SponsorshipTermDialog } from "@/components/patrocinadores/sponsorship-term-dialog";
import { StopPropagation } from "@/components/stop-propagation";
import { PrintButton } from "@/components/print-button";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCents } from "@/lib/money";

const LOGO_BUCKET = "sponsorship-logos";
const CONTRACT_BUCKET = "sponsorship-contracts";
const DOCUMENTS_BUCKET = "sponsor-documents";

// `uploadTermContract` (actions.ts) admite hasta 10MB, el doble que el resto
// de subidas del repo — con el timeout por defecto de Vercel una conexión
// lenta puede no dar tiempo a terminar.
export const maxDuration = 60;

/**
 * Ficha del patrocinador con sus acuerdos, contactos y documentos. En `cache()`
 * para que `generateMetadata` y la página compartan una sola consulta.
 */
const getSponsor = cache((sponsorId: string) =>
  db.query.sponsors.findFirst({
    where: eq(sponsors.id, sponsorId),
    with: {
      contactPerson: true,
      terms: {
        orderBy: (terms, { desc }) => [desc(terms.startsOn)],
        with: {
          payments: {
            orderBy: (payments, { asc }) => [asc(payments.dueDate)],
            with: { issuedInvoice: { columns: { number: true, issuedOn: true } } },
          },
        },
      },
      contacts: { orderBy: (contacts, { asc }) => [asc(contacts.name)] },
      documents: { orderBy: (docs, { desc }) => [desc(docs.createdAt)] },
      noteEntries: { orderBy: (notes, { desc }) => [desc(notes.createdAt)] },
    },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; sponsorId: string }>;
}) {
  const { sponsorId } = await params;
  const sponsor = await getSponsor(sponsorId);
  return { title: sponsor?.name ?? "Areto" };
}

export default async function SponsorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; sponsorId: string }>;
  searchParams: Promise<{ from?: string; fromLabel?: string }>;
}) {
  const { locale, sponsorId } = await params;
  const { from, fromLabel } = await searchParams;
  const backHref = resolveBackHref(from, "/patrocinadores");
  // Renderizado estático: fija el idioma sin tener que leer cabeceras.
  setRequestLocale(locale);
  const user = await requirePermission("patrocinadores.view");
  const canManage = hasPermission(user, "patrocinadores.manage");
  const t = await getTranslations("Patrocinadores");

  // La ficha, el listado de personas (selector de contacto) y los catálogos
  // que necesita el diálogo de emisión de factura son independientes.
  const [sponsor, allPersons, allSeasons, categories] = await Promise.all([
    getSponsor(sponsorId),
    db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true },
      orderBy: (persons, { asc }) => [
        asc(persons.lastName),
        asc(persons.firstName),
      ],
    }),
    db.query.seasons.findMany({
      columns: { id: true, name: true },
      orderBy: (seasons, { desc }) => [desc(seasons.name)],
    }),
    db.query.economicCategories.findMany({
      columns: { id: true, name: true },
      orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.name)],
    }),
  ]);
  if (!sponsor) notFound();

  // Miniatura para el avatar de la cabecera; el original a tamaño completo
  // solo se pide si el visitante hace clic en "ver logo original".
  const logoThumbUrl = getPublicUrl(
    LOGO_BUCKET,
    sponsor.logoPath ? logoThumbPath(sponsor.logoPath) : null,
  );
  const logoUrl = getPublicUrl(LOGO_BUCKET, sponsor.logoPath);
  const [contractUrls, documentFileUrls] = await Promise.all([
    getSignedUrls(CONTRACT_BUCKET, sponsor.terms, (term) => term.contractPath, (term) => term.id),
    getSignedUrls(DOCUMENTS_BUCKET, sponsor.documents, (d) => d.filePath, (d) => d.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + SPONSORSHIP_EXPIRY_WINDOW_DAYS);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  function formatAmount(amountCents: number | null) {
    if (amountCents === null) return null;
    return formatCents(amountCents, locale);
  }

  function termLabel(term: { startsOn: string | null; endsOn: string | null }) {
    return `${term.startsOn ?? "—"} — ${term.endsOn ?? t("ongoing")}`;
  }

  // Anualidades aplanadas (con su acuerdo) y totales comprometido vs. cobrado.
  // Comprometido = suma de las anualidades; si un acuerdo aún no tiene
  // anualidades generadas, cuenta su importe total pactado como comprometido.
  const payments = sponsor.terms.flatMap((term) =>
    term.payments.map((payment) => ({ ...payment, term })),
  );
  const committedCents = sponsor.terms.reduce((sum, term) => {
    if (term.payments.length > 0) {
      return sum + term.payments.reduce((s, p) => s + p.amountCents, 0);
    }
    return sum + (term.totalAmountCents ?? 0);
  }, 0);
  const collectedCents = payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const pendingCents = committedCents - collectedCents;

  const paymentStatusVariant = {
    paid: "secondary",
    pending: "outline",
    overdue: "destructive",
    waived: "outline",
  } as const;

  const agreementStatusTone = {
    confirmed: "positive",
    negotiating: "neutral",
    lost: "danger",
  } as const;

  const noteEntries = sponsor.noteEntries.map((note) => ({
    id: note.id,
    body: note.body,
    authorName: note.authorName,
    createdAt: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
      note.createdAt,
    ),
  }));

  const backLabel =
    fromLabel && backHref !== "/patrocinadores"
      ? t("backToSponsorshipsFrom", { name: fromLabel })
      : t("backToSponsorships");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        back={{ href: backHref, label: backLabel }}
        title={sponsor.name}
        description={t("termsCount", { count: sponsor.terms.length })}
        media={
          <div className="flex size-14 items-center justify-center rounded border bg-muted/30 p-1.5">
            {logoThumbUrl ? (
              logoUrl ? (
                <a
                  href={logoUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("viewOriginalLogoAction")}
                  title={t("viewOriginalLogoAction")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoThumbUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoThumbUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              )
            ) : (
              <HandshakeIcon className="size-5 text-muted-foreground" />
            )}
          </div>
        }
        actions={
          <>
            <PrintButton label={t("printAction")} />
            {canManage ? (
              <>
                <SponsorDialog
                  mode="edit"
                  sponsor={sponsor}
                  logoUrl={logoThumbUrl}
                  personOptions={allPersons}
                />
                <DeleteSponsorDialog id={sponsor.id} name={sponsor.name} />
              </>
            ) : null}
          </>
        }
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t("tabGeneral")}</TabsTrigger>
          <TabsTrigger value="patrocinios">
            {t("tabAgreements", { count: sponsor.terms.length })}
          </TabsTrigger>
          <TabsTrigger value="contactos">
            {t("tabContacts", { count: sponsor.contacts.length })}
          </TabsTrigger>
          <TabsTrigger value="documentos">
            {t("tabDocuments", { count: sponsor.documents.length })}
          </TabsTrigger>
          <TabsTrigger value="seguimiento">
            {t("tabNotes", { count: sponsor.noteEntries.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="general"
          keepMounted
          className="flex flex-col gap-6"
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("contactSection")}
              </h2>
              <dl className="grid grid-cols-2 gap-3">
                <InfoRow
                  label={t("contactPersonLabel")}
                  value={
                    sponsor.contactPerson ? (
                      <Link
                        href={`/personas/${sponsor.contactPerson.id}?from=${encodeURIComponent(`/patrocinadores/${sponsor.id}`)}&fromLabel=${encodeURIComponent(sponsor.name)}`}
                        className="hover:underline"
                      >
                        {sponsor.contactPerson.firstName}{" "}
                        {sponsor.contactPerson.lastName}
                      </Link>
                    ) : null
                  }
                />
                <InfoRow
                  label={t("contactEmailLabel")}
                  value={sponsor.contactEmail}
                />
                <InfoRow
                  label={t("contactPhoneLabel")}
                  value={sponsor.contactPhone}
                />
                <InfoRow
                  label={t("websiteLabel")}
                  value={
                    sponsor.websiteUrl ? (
                      <a
                        href={sponsor.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {sponsor.websiteUrl}
                      </a>
                    ) : null
                  }
                />
              </dl>
            </div>

            {sponsor.fiscalName || sponsor.taxId || sponsor.fiscalAddress ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("fiscalSection")}
                </h2>
                <dl className="grid grid-cols-2 gap-3">
                  <InfoRow
                    label={t("fiscalNameLabel")}
                    value={sponsor.fiscalName}
                  />
                  <InfoRow label={t("taxIdLabel")} value={sponsor.taxId} />
                  <InfoRow
                    label={t("fiscalAddressLabel")}
                    value={sponsor.fiscalAddress}
                  />
                </dl>
              </div>
            ) : null}

            {sponsor.notes ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("notesLabel")}
                </h2>
                <p className="text-sm whitespace-pre-wrap">{sponsor.notes}</p>
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent
          value="patrocinios"
          keepMounted
          className="flex flex-col gap-6"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label={t("committedLabel")}
              value={formatAmount(committedCents) ?? "—"}
            />
            <StatTile
              label={t("collectedLabel")}
              value={formatAmount(collectedCents) ?? "—"}
            />
            <StatTile
              label={t("pendingLabel")}
              value={formatAmount(pendingCents) ?? "—"}
            />
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("termsHistorySection")}
            </h2>
            {canManage ? (
              <span className="print:hidden">
                <SponsorshipTermDialog mode="create" sponsorId={sponsor.id} />
              </span>
            ) : null}
          </div>

          {sponsor.terms.length === 0 ? (
            <SectionPlaceholder size="compact" title={t("noTermsDescription")} />
          ) : (
            <div className="flex flex-col gap-4">
              {sponsor.terms.map((term) => {
                const status = sponsorshipStatus(term.endsOn, today, cutoff);
                const contractUrl = contractUrls.get(term.id) ?? null;
                const termFirstYear = term.startsOn
                  ? seasonYearOf(term.startsOn)
                  : seasonYearOf(today);
                const suggestedPaymentAmountCents =
                  term.totalAmountCents != null
                    ? annualEquivalentCents(
                        term.totalAmountCents,
                        term.startsOn,
                        term.endsOn,
                      )
                    : null;
                const singleTermOptions = [
                  { id: term.id, label: termLabel(term) },
                ];
                // Progreso de cobro del acuerdo: solo tiene sentido si ya
                // hay anualidades generadas (si no, no hay nada que progrese).
                const termTotalCents =
                  term.payments.length > 0
                    ? term.payments.reduce((s, p) => s + p.amountCents, 0)
                    : null;
                const termCollectedCents = term.payments
                  .filter((p) => p.status === "paid")
                  .reduce((s, p) => s + p.amountCents, 0);
                const termProgressPct =
                  termTotalCents && termTotalCents > 0
                    ? Math.min(
                        100,
                        Math.round((termCollectedCents / termTotalCents) * 100),
                      )
                    : null;
                return (
                  <Collapsible
                    key={term.id}
                    defaultOpen={status !== "expired"}
                    className="overflow-hidden rounded-lg border"
                  >
                    <CollapsibleTrigger
                      render={<div />}
                      nativeButton={false}
                      className="group/term-trigger flex w-full cursor-pointer flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                    >
                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground group-aria-expanded/term-trigger:hidden" />
                          <ChevronUpIcon className="hidden size-4 shrink-0 text-muted-foreground group-aria-expanded/term-trigger:block" />
                          <span className="font-medium">
                            {term.startsOn ?? "—"} —{" "}
                            {term.endsOn ?? t("ongoing")}
                          </span>
                          {term.tier ? (
                            <Badge variant={term.tier === "principal" ? "gold" : "outline"}>
                              {t(`tier.${term.tier}`)}
                            </Badge>
                          ) : null}
                          <StatusBadge
                            tone={agreementStatusTone[term.agreementStatus]}
                            label={t(`agreementStatus.${term.agreementStatus}`)}
                          />
                          <StatusBadge
                            tone={SPONSORSHIP_TONE[status]}
                            label={t(`${status}Badge`)}
                          />
                        </div>
                        {termProgressPct !== null ? (
                          <Progress
                            value={termProgressPct}
                            className="max-w-xs"
                            aria-label={t("collectedLabel")}
                          >
                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                              {formatAmount(termCollectedCents)} /{" "}
                              {formatAmount(termTotalCents)}
                            </span>
                          </Progress>
                        ) : null}
                        {term.benefits ? (
                          <p className="max-w-prose text-sm text-muted-foreground">
                            {term.benefits}
                          </p>
                        ) : null}
                        {term.notes ? (
                          <p className="text-xs text-muted-foreground italic">
                            {term.notes}
                          </p>
                        ) : null}
                        {contractUrl ? (
                          <StopPropagation>
                            <a
                              href={contractUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline print:hidden"
                            >
                              {t("viewContract")}
                            </a>
                          </StopPropagation>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {t("totalAmountShort")}
                          </p>
                          <p className="font-semibold">
                            {formatAmount(term.totalAmountCents) ?? "—"}
                          </p>
                        </div>
                        {canManage ? (
                          <StopPropagation className="flex gap-1 print:hidden">
                            <RenewSponsorshipTermButton id={term.id} />
                            <SponsorshipTermDialog
                              mode="edit"
                              term={term}
                              contractUrl={contractUrl}
                            />
                            <DeleteSponsorshipTermDialog id={term.id} />
                          </StopPropagation>
                        ) : null}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="flex flex-col gap-3 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {t("paymentsSection")}
                          </h3>
                          {canManage ? (
                            <span className="flex gap-2 print:hidden">
                              <GenerateAnnualitiesDialog
                                termOptions={singleTermOptions}
                                defaultTermId={term.id}
                                defaultFirstYear={termFirstYear}
                              />
                              <SponsorPaymentDialog
                                mode="create"
                                termOptions={singleTermOptions}
                                defaultTermId={term.id}
                                defaultAmountCents={suggestedPaymentAmountCents}
                              />
                            </span>
                          ) : null}
                        </div>
                        {term.payments.length === 0 ? (
                          <SectionPlaceholder size="compact" title={t("noPaymentsDescription")} />
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("seasonYearLabel")}</TableHead>
                                <TableHead>{t("colAmount")}</TableHead>
                                <TableHead priority="secondary">
                                  {t("dueDateLabel")}
                                </TableHead>
                                <TableHead priority="secondary">
                                  {t("paymentStatusLabel")}
                                </TableHead>
                                <TableHead priority="tertiary">
                                  {t("paidOnLabel")}
                                </TableHead>
                                <TableHead priority="tertiary">
                                  {t("invoiceNumberLabel")}
                                </TableHead>
                                {canManage ? (
                                  <TableHead className="text-right print:hidden">
                                    {t("colActions")}
                                  </TableHead>
                                ) : null}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {term.payments.map((payment) => (
                                <TableRow key={payment.id}>
                                  <TableCell nowrap className="font-medium">
                                    {payment.year
                                      ? seasonLabel(payment.year)
                                      : "—"}
                                  </TableCell>
                                  <TableCell nowrap className="font-medium">
                                    {formatAmount(payment.amountCents)}
                                  </TableCell>
                                  <TableCell priority="secondary" nowrap>
                                    {payment.dueDate ?? "—"}
                                  </TableCell>
                                  <TableCell priority="secondary">
                                    <Badge
                                      variant={
                                        paymentStatusVariant[payment.status]
                                      }
                                    >
                                      {t(`paymentStatus.${payment.status}`)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell
                                    priority="tertiary"
                                    nowrap
                                    className="text-muted-foreground"
                                  >
                                    {payment.paidOn ?? "—"}
                                    {payment.method ? (
                                      <span className="block text-xs">
                                        {payment.method}
                                      </span>
                                    ) : null}
                                    {payment.notes ? (
                                      <span className="block text-xs italic">
                                        {payment.notes}
                                      </span>
                                    ) : null}
                                  </TableCell>
                                  <TableCell priority="tertiary" className="text-muted-foreground">
                                    {payment.issuedInvoice ? (
                                      <span>
                                        {payment.issuedInvoice.number}
                                        <span className="block text-xs">
                                          {payment.issuedInvoice.issuedOn}
                                        </span>
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  {canManage ? (
                                    <TableCell className="flex justify-end gap-1 print:hidden">
                                      {payment.status !== "paid" ? (
                                        <MarkPaymentPaidButton id={payment.id} />
                                      ) : null}
                                      {payment.issuedInvoice ? (
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          render={
                                            <Link
                                              href={`/patrocinadores/${sponsor.id}/recibo/${payment.id}`}
                                            />
                                          }
                                          nativeButton={false}
                                        >
                                          <ReceiptTextIcon />
                                          <span className="sr-only">
                                            {t("viewInvoiceSr")}
                                          </span>
                                        </Button>
                                      ) : (
                                        <IssuedInvoiceDialog
                                          mode="sponsor"
                                          ledger="official"
                                          manageableLedgers={["official"]}
                                          seasons={allSeasons}
                                          categories={categories}
                                          defaults={{
                                            sponsorPaymentId: payment.id,
                                            seasonId:
                                              (payment.year
                                                ? allSeasons.find(
                                                    (s) => s.name === seasonLabel(payment.year!),
                                                  )?.id
                                                : null) ??
                                              allSeasons[0]?.id ??
                                              "",
                                            customerName: sponsor.fiscalName ?? sponsor.name,
                                            customerTaxId: sponsor.taxId,
                                            customerAddress: sponsor.fiscalAddress,
                                            concept: payment.year
                                              ? `${t("sponsorshipConcept", { name: sponsor.name })} · ${seasonLabel(payment.year)}`
                                              : t("sponsorshipConcept", { name: sponsor.name }),
                                            totalCents: payment.amountCents,
                                          }}
                                        />
                                      )}
                                      <SponsorPaymentDialog
                                        mode="edit"
                                        payment={payment}
                                      />
                                      <DeleteSponsorPaymentDialog
                                        id={payment.id}
                                      />
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="contactos"
          keepMounted
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("contactsSection")}
            </h2>
            {canManage ? (
              <span className="print:hidden">
                <SponsorContactDialog mode="create" sponsorId={sponsor.id} />
              </span>
            ) : null}
          </div>
          {sponsor.contacts.length === 0 ? (
            <SectionPlaceholder size="compact" title={t("noContactsDescription")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("contactNameLabel")}</TableHead>
                  <TableHead priority="tertiary">{t("contactRoleLabel")}</TableHead>
                  <TableHead priority="secondary">{t("contactEmailLabel")}</TableHead>
                  <TableHead priority="secondary">{t("contactPhoneLabel")}</TableHead>
                  {canManage ? (
                    <TableHead className="text-right print:hidden">
                      {t("colActions")}
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsor.contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      {contact.name}
                    </TableCell>
                    <TableCell priority="tertiary" className="text-muted-foreground">
                      {contact.role ?? "—"}
                    </TableCell>
                    <TableCell priority="secondary">{contact.email ?? "—"}</TableCell>
                    <TableCell priority="secondary">{contact.phone ?? "—"}</TableCell>
                    {canManage ? (
                      <TableCell className="flex justify-end gap-1 print:hidden">
                        <SponsorContactDialog mode="edit" contact={contact} />
                        <DeleteSponsorContactDialog id={contact.id} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent
          value="documentos"
          keepMounted
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("documentsSection")}
            </h2>
            {canManage ? (
              <span className="print:hidden">
                <DocumentDialog
                  mode="create"
                  parentId={sponsor.id}
                  formKey="sponsorId"
                  namespace="Patrocinadores"
                  htmlIdPrefix="sponsor-document"
                  addAction={addSponsorDocument}
                  updateAction={updateSponsorDocument}
                />
              </span>
            ) : null}
          </div>
          {sponsor.documents.length === 0 ? (
            <SectionPlaceholder size="compact" title={t("noDocumentsDescription")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("documentLabelLabel")}</TableHead>
                  <TableHead priority="secondary">{t("documentTypeColumn")}</TableHead>
                  <TableHead priority="tertiary">{t("documentNotesColumn")}</TableHead>
                  <TableHead>{t("documentViewFile")}</TableHead>
                  {canManage ? (
                    <TableHead className="text-right print:hidden">
                      {t("colActions")}
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsor.documents.map((d) => {
                  const fileUrl = documentFileUrls.get(d.id) ?? null;
                  const typeLabel = fileTypeLabel(d.fileName ?? d.filePath);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.label}</TableCell>
                      <TableCell priority="secondary">
                        {typeLabel ? <Badge variant="outline">{typeLabel}</Badge> : "—"}
                      </TableCell>
                      <TableCell priority="tertiary" className="text-muted-foreground">
                        {d.notes ?? "—"}
                      </TableCell>
                      <TableCell>
                        {fileUrl ? (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {t("documentViewFile")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      {canManage ? (
                        <TableCell className="flex justify-end gap-1 print:hidden">
                          <DocumentDialog
                            mode="edit"
                            namespace="Patrocinadores"
                            htmlIdPrefix="sponsor-document"
                            addAction={addSponsorDocument}
                            updateAction={updateSponsorDocument}
                            document={{ id: d.id, label: d.label, notes: d.notes }}
                            fileUrl={fileUrl}
                          />
                          <DeleteDocumentDialog
                            id={d.id}
                            label={d.label}
                            namespace="Patrocinadores"
                            deleteAction={deleteSponsorDocument}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent
          value="seguimiento"
          keepMounted
          className="flex flex-col gap-4"
        >
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("notesSection")}
          </h2>
          <NotesLog
            parentId={sponsor.id}
            formKey="sponsorId"
            namespace="Patrocinadores"
            addAction={addSponsorNote}
            deleteAction={deleteSponsorNote}
            notes={noteEntries}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
