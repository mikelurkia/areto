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
import { requirePermission } from "@/lib/auth";
import { resolveBackHref } from "@/lib/back-href";
import { fileTypeLabel } from "@/lib/file-type";
import { getPublicUrl, getSignedUrls } from "@/lib/supabase/storage";
import {
  annualEquivalentCents,
  logoThumbPath,
  seasonLabel,
  seasonYearOf,
  sponsorshipStatus,
  SPONSORSHIP_EXPIRY_WINDOW_DAYS,
} from "@/lib/sponsorship";
import { Link } from "@/i18n/navigation";
import { BackLink } from "@/components/back-link";
import { DeleteSponsorContactDialog } from "@/components/patrocinadores/delete-sponsor-contact-dialog";
import { DeleteSponsorDialog } from "@/components/patrocinadores/delete-sponsor-dialog";
import { DeleteSponsorPaymentDialog } from "@/components/patrocinadores/delete-sponsor-payment-dialog";
import { DeleteSponsorshipTermDialog } from "@/components/patrocinadores/delete-sponsorship-term-dialog";
import { GenerateAnnualitiesDialog } from "@/components/patrocinadores/generate-payments-dialog";
import { IssueInvoiceButton } from "@/components/patrocinadores/issue-invoice-button";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          payments: { orderBy: (payments, { asc }) => [asc(payments.dueDate)] },
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
  await requirePermission("patrocinadores.view");
  const t = await getTranslations("Patrocinadores");

  // La ficha y el listado de personas (selector de contacto) son independientes.
  const [sponsor, allPersons] = await Promise.all([
    getSponsor(sponsorId),
    db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true },
      orderBy: (persons, { asc }) => [
        asc(persons.lastName),
        asc(persons.firstName),
      ],
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
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(amountCents / 100);
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

  const agreementStatusVariant = {
    confirmed: "secondary",
    negotiating: "outline",
    lost: "destructive",
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
      <div className="print:hidden">
        <BackLink href={backHref} label={backLabel} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {sponsor.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("termsCount", { count: sponsor.terms.length })}
            </p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton label={t("printAction")} />
          <SponsorDialog
            mode="edit"
            sponsor={sponsor}
            logoUrl={logoThumbUrl}
            personOptions={allPersons}
          />
          <DeleteSponsorDialog id={sponsor.id} name={sponsor.name} />
        </div>
      </div>

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
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">
                {t("committedLabel")}
              </p>
              <p className="text-lg font-semibold">
                {formatAmount(committedCents) ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">
                {t("collectedLabel")}
              </p>
              <p className="text-lg font-semibold">
                {formatAmount(collectedCents) ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">
                {t("pendingLabel")}
              </p>
              <p className="text-lg font-semibold">
                {formatAmount(pendingCents) ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("termsHistorySection")}
            </h2>
            <span className="print:hidden">
              <SponsorshipTermDialog mode="create" sponsorId={sponsor.id} />
            </span>
          </div>

          {sponsor.terms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noTermsDescription")}
            </p>
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
                          <Badge
                            variant={
                              agreementStatusVariant[term.agreementStatus]
                            }
                          >
                            {t(`agreementStatus.${term.agreementStatus}`)}
                          </Badge>
                          {status === "active" ? (
                            <Badge variant="secondary">
                              {t("activeBadge")}
                            </Badge>
                          ) : status === "expiringSoon" ? (
                            <Badge variant="warning">{t("expiringSoonBadge")}</Badge>
                          ) : (
                            <Badge variant="destructive">
                              {t("expiredBadge")}
                            </Badge>
                          )}
                        </div>
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
                        <StopPropagation className="flex gap-1 print:hidden">
                          <RenewSponsorshipTermButton id={term.id} />
                          <SponsorshipTermDialog
                            mode="edit"
                            term={term}
                            contractUrl={contractUrl}
                          />
                          <DeleteSponsorshipTermDialog id={term.id} />
                        </StopPropagation>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="flex flex-col gap-3 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {t("paymentsSection")}
                          </h3>
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
                        </div>
                        {term.payments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {t("noPaymentsDescription")}
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("seasonYearLabel")}</TableHead>
                                <TableHead>{t("colAmount")}</TableHead>
                                <TableHead>{t("dueDateLabel")}</TableHead>
                                <TableHead>{t("paymentStatusLabel")}</TableHead>
                                <TableHead>{t("paidOnLabel")}</TableHead>
                                <TableHead>{t("invoiceNumberLabel")}</TableHead>
                                <TableHead className="text-right print:hidden">
                                  {t("colActions")}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {term.payments.map((payment) => (
                                <TableRow key={payment.id}>
                                  <TableCell className="font-medium">
                                    {payment.year
                                      ? seasonLabel(payment.year)
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {formatAmount(payment.amountCents)}
                                  </TableCell>
                                  <TableCell>
                                    {payment.dueDate ?? "—"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        paymentStatusVariant[payment.status]
                                      }
                                    >
                                      {t(`paymentStatus.${payment.status}`)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
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
                                  <TableCell className="text-muted-foreground">
                                    {payment.invoiceNumber ? (
                                      <span>
                                        {payment.invoiceNumber}
                                        {payment.invoicedOn ? (
                                          <span className="block text-xs">
                                            {payment.invoicedOn}
                                          </span>
                                        ) : null}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell className="flex justify-end gap-1 print:hidden">
                                    {payment.status !== "paid" ? (
                                      <MarkPaymentPaidButton id={payment.id} />
                                    ) : null}
                                    {payment.invoiceNumber ? (
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
                                      <IssueInvoiceButton id={payment.id} />
                                    )}
                                    <SponsorPaymentDialog
                                      mode="edit"
                                      payment={payment}
                                    />
                                    <DeleteSponsorPaymentDialog
                                      id={payment.id}
                                    />
                                  </TableCell>
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
            <span className="print:hidden">
              <SponsorContactDialog mode="create" sponsorId={sponsor.id} />
            </span>
          </div>
          {sponsor.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noContactsDescription")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("contactNameLabel")}</TableHead>
                  <TableHead>{t("contactRoleLabel")}</TableHead>
                  <TableHead>{t("contactEmailLabel")}</TableHead>
                  <TableHead>{t("contactPhoneLabel")}</TableHead>
                  <TableHead className="text-right print:hidden">
                    {t("colActions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsor.contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      {contact.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.role ?? "—"}
                    </TableCell>
                    <TableCell>{contact.email ?? "—"}</TableCell>
                    <TableCell>{contact.phone ?? "—"}</TableCell>
                    <TableCell className="flex justify-end gap-1 print:hidden">
                      <SponsorContactDialog mode="edit" contact={contact} />
                      <DeleteSponsorContactDialog id={contact.id} />
                    </TableCell>
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
          </div>
          {sponsor.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDocumentsDescription")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("documentLabelLabel")}</TableHead>
                  <TableHead>{t("documentTypeColumn")}</TableHead>
                  <TableHead>{t("documentNotesColumn")}</TableHead>
                  <TableHead>{t("documentViewFile")}</TableHead>
                  <TableHead className="text-right print:hidden">
                    {t("colActions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsor.documents.map((d) => {
                  const fileUrl = documentFileUrls.get(d.id) ?? null;
                  const typeLabel = fileTypeLabel(d.fileName ?? d.filePath);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.label}</TableCell>
                      <TableCell>
                        {typeLabel ? <Badge variant="outline">{typeLabel}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
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
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
