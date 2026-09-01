"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import {
  paymentStatus,
  persons,
  sponsorContacts,
  sponsorDocuments,
  sponsorNotes,
  sponsorPayments,
  sponsors,
  sponsorshipAgreementStatus,
  sponsorshipTerms,
  sponsorshipTier,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { nextInvoiceNumber } from "@/lib/club";
import { makeDocumentActions } from "@/lib/entity-documents";
import { makeNoteActions } from "@/lib/entity-notes";
import { resizeImageToWebp } from "@/lib/image-resize";
import { readAmountCents } from "@/lib/money";
import { logoThumbPath } from "@/lib/sponsorship";
import { extensionFromMimeType, removeFile, uploadFile } from "@/lib/supabase/storage";
import { ROUTE, revalidateRoutes } from "@/lib/revalidate";

export type SponsorState = {
  error?: string;
  message?: string;
};

const LOGO_BUCKET = "sponsorship-logos";
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const CONTRACT_BUCKET = "sponsorship-contracts";
const MAX_CONTRACT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_CONTRACT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// El logo se ve casi siempre como avatar pequeño (listados, muro público,
// vista previa al editar); solo la ficha del patrocinador enlaza al original
// a tamaño completo. Por eso se suben dos versiones: la original tal cual la
// sube el usuario, y esta miniatura ligera para todo lo demás.
const LOGO_THUMB_MAX_DIMENSION = 256;

async function uploadSponsorLogo(sponsorId: string, file: File): Promise<string> {
  const path = `${sponsorId}/logo.${extensionFromMimeType(file.type)}`;
  const thumb = await resizeImageToWebp(file, LOGO_THUMB_MAX_DIMENSION);
  await Promise.all([
    uploadFile(LOGO_BUCKET, path, file),
    uploadFile(LOGO_BUCKET, logoThumbPath(path), thumb),
  ]);
  return path;
}

async function removeSponsorLogoObject(path: string) {
  await Promise.all([
    removeFile(LOGO_BUCKET, path),
    removeFile(LOGO_BUCKET, logoThumbPath(path)),
  ]);
}

async function uploadTermContract(
  sponsorId: string,
  termId: string,
  file: File,
): Promise<string> {
  const path = `${sponsorId}/${termId}/contract.${extensionFromMimeType(file.type)}`;
  await uploadFile(CONTRACT_BUCKET, path, file);
  return path;
}

async function removeTermContractObject(path: string) {
  await removeFile(CONTRACT_BUCKET, path);
}

function readLogo(formData: FormData): File | null {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

function readContract(formData: FormData): File | null {
  const file = formData.get("contract");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

function readContactPersonId(formData: FormData): string | null {
  const value = String(formData.get("contactPersonId") ?? "");
  return value && value !== "none" ? value : null;
}

function readSponsorFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    contactPersonId: readContactPersonId(formData),
    contactEmail: String(formData.get("contactEmail") ?? "").trim() || null,
    contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
    websiteUrl: String(formData.get("websiteUrl") ?? "").trim() || null,
    fiscalName: String(formData.get("fiscalName") ?? "").trim() || null,
    taxId: String(formData.get("taxId") ?? "").trim() || null,
    fiscalAddress: String(formData.get("fiscalAddress") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    removeLogo: formData.get("removeLogo") === "on",
  };
}

export async function createSponsor(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const fields = readSponsorFields(formData);
  const logo = readLogo(formData);
  if (!fields.name) return { error: t("sponsorNameRequired") };
  if (logo && !ALLOWED_LOGO_TYPES.includes(logo.type)) {
    return { error: t("logoInvalidType") };
  }
  if (logo && logo.size > MAX_LOGO_BYTES) {
    return { error: t("logoTooLarge") };
  }

  const [sponsor] = await db
    .insert(sponsors)
    .values({
      name: fields.name,
      contactPersonId: fields.contactPersonId,
      contactEmail: fields.contactEmail,
      contactPhone: fields.contactPhone,
      websiteUrl: fields.websiteUrl,
      fiscalName: fields.fiscalName,
      taxId: fields.taxId,
      fiscalAddress: fields.fiscalAddress,
      notes: fields.notes,
    })
    .returning({ id: sponsors.id });

  if (logo) {
    const path = await uploadSponsorLogo(sponsor.id, logo);
    await db.update(sponsors).set({ logoPath: path }).where(eq(sponsors.id, sponsor.id));
  }

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("sponsorCreated") };
}

export async function updateSponsor(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");
  const fields = readSponsorFields(formData);
  const logo = readLogo(formData);
  if (!fields.name) return { error: t("sponsorNameRequired") };
  if (logo && !ALLOWED_LOGO_TYPES.includes(logo.type)) {
    return { error: t("logoInvalidType") };
  }
  if (logo && logo.size > MAX_LOGO_BYTES) {
    return { error: t("logoTooLarge") };
  }

  const existing = await db.query.sponsors.findFirst({
    where: eq(sponsors.id, id),
    columns: { logoPath: true },
  });
  if (!existing) return { error: t("sponsorNotFound") };

  await db
    .update(sponsors)
    .set({
      name: fields.name,
      contactPersonId: fields.contactPersonId,
      contactEmail: fields.contactEmail,
      contactPhone: fields.contactPhone,
      websiteUrl: fields.websiteUrl,
      fiscalName: fields.fiscalName,
      taxId: fields.taxId,
      fiscalAddress: fields.fiscalAddress,
      notes: fields.notes,
    })
    .where(eq(sponsors.id, id));

  if (logo) {
    if (existing.logoPath) await removeSponsorLogoObject(existing.logoPath);
    const path = await uploadSponsorLogo(id, logo);
    await db.update(sponsors).set({ logoPath: path }).where(eq(sponsors.id, id));
  } else if (fields.removeLogo && existing.logoPath) {
    await removeSponsorLogoObject(existing.logoPath);
    await db.update(sponsors).set({ logoPath: null }).where(eq(sponsors.id, id));
  }

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("sponsorUpdated") };
}

export type QuickPersonState = {
  error?: string;
  person?: { id: string; firstName: string; lastName: string };
};

/**
 * Alta exprés de una persona desde el buscador de contacto del patrocinador:
 * solo pide el nombre completo (primera palabra = nombre, resto = apellidos).
 * La ficha se puede completar luego en Personas.
 */
export async function quickCreateContactPerson(
  fullName: string,
): Promise<QuickPersonState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { error: t("contactPersonNameRequired") };

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");

  const [person] = await db
    .insert(persons)
    .values({ firstName, lastName })
    .returning({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
    });

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { person };
}

export async function deleteSponsor(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");

  const [existing, terms] = await Promise.all([
    db.query.sponsors.findFirst({ where: eq(sponsors.id, id), columns: { logoPath: true } }),
    db.query.sponsorshipTerms.findMany({
      where: eq(sponsorshipTerms.sponsorId, id),
      columns: { contractPath: true },
    }),
  ]);

  await db.delete(sponsors).where(eq(sponsors.id, id));

  if (existing?.logoPath) await removeSponsorLogoObject(existing.logoPath);
  await Promise.all(
    terms
      .filter((term) => term.contractPath)
      .map((term) => removeTermContractObject(term.contractPath!)),
  );

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("sponsorDeleted") };
}

function readDate(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

function readTier(formData: FormData): (typeof sponsorshipTier.enumValues)[number] | null {
  const value = String(formData.get("tier") ?? "");
  return (sponsorshipTier.enumValues as readonly string[]).includes(value)
    ? (value as (typeof sponsorshipTier.enumValues)[number])
    : null;
}

function readAgreementStatus(
  formData: FormData,
): (typeof sponsorshipAgreementStatus.enumValues)[number] {
  const value = String(formData.get("agreementStatus") ?? "");
  return (sponsorshipAgreementStatus.enumValues as readonly string[]).includes(value)
    ? (value as (typeof sponsorshipAgreementStatus.enumValues)[number])
    : "confirmed";
}

function readTermFields(formData: FormData) {
  return {
    tier: readTier(formData),
    agreementStatus: readAgreementStatus(formData),
    totalAmountCents: readAmountCents(formData.get("amount")),
    startsOn: readDate(formData, "startsOn"),
    endsOn: readDate(formData, "endsOn"),
    benefits: String(formData.get("benefits") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    removeContract: formData.get("removeContract") === "on",
  };
}

export async function addSponsorshipTerm(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const sponsorId = String(formData.get("sponsorId") ?? "");
  const fields = readTermFields(formData);
  const contract = readContract(formData);
  if (fields.startsOn && fields.endsOn && fields.startsOn > fields.endsOn) {
    return { error: t("dateRangeInvalid") };
  }
  if (contract && !ALLOWED_CONTRACT_TYPES.includes(contract.type)) {
    return { error: t("contractInvalidType") };
  }
  if (contract && contract.size > MAX_CONTRACT_BYTES) {
    return { error: t("contractTooLarge") };
  }

  const [term] = await db
    .insert(sponsorshipTerms)
    .values({
      sponsorId,
      tier: fields.tier,
      agreementStatus: fields.agreementStatus,
      totalAmountCents: fields.totalAmountCents,
      startsOn: fields.startsOn,
      endsOn: fields.endsOn,
      benefits: fields.benefits,
      notes: fields.notes,
    })
    .returning({ id: sponsorshipTerms.id });

  if (contract) {
    const path = await uploadTermContract(sponsorId, term.id, contract);
    await db
      .update(sponsorshipTerms)
      .set({ contractPath: path })
      .where(eq(sponsorshipTerms.id, term.id));
  }

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("termCreated") };
}

export async function updateSponsorshipTerm(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");
  const fields = readTermFields(formData);
  const contract = readContract(formData);
  if (fields.startsOn && fields.endsOn && fields.startsOn > fields.endsOn) {
    return { error: t("dateRangeInvalid") };
  }
  if (contract && !ALLOWED_CONTRACT_TYPES.includes(contract.type)) {
    return { error: t("contractInvalidType") };
  }
  if (contract && contract.size > MAX_CONTRACT_BYTES) {
    return { error: t("contractTooLarge") };
  }

  const existing = await db.query.sponsorshipTerms.findFirst({
    where: eq(sponsorshipTerms.id, id),
    columns: { sponsorId: true, contractPath: true },
  });
  if (!existing) return { error: t("termNotFound") };

  await db
    .update(sponsorshipTerms)
    .set({
      tier: fields.tier,
      agreementStatus: fields.agreementStatus,
      totalAmountCents: fields.totalAmountCents,
      startsOn: fields.startsOn,
      endsOn: fields.endsOn,
      benefits: fields.benefits,
      notes: fields.notes,
    })
    .where(eq(sponsorshipTerms.id, id));

  if (contract) {
    if (existing.contractPath) await removeTermContractObject(existing.contractPath);
    const path = await uploadTermContract(existing.sponsorId, id, contract);
    await db
      .update(sponsorshipTerms)
      .set({ contractPath: path })
      .where(eq(sponsorshipTerms.id, id));
  } else if (fields.removeContract && existing.contractPath) {
    await removeTermContractObject(existing.contractPath);
    await db
      .update(sponsorshipTerms)
      .set({ contractPath: null })
      .where(eq(sponsorshipTerms.id, id));
  }

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("termUpdated") };
}

export async function deleteSponsorshipTerm(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");

  const existing = await db.query.sponsorshipTerms.findFirst({
    where: eq(sponsorshipTerms.id, id),
    columns: { contractPath: true },
  });

  await db.delete(sponsorshipTerms).where(eq(sponsorshipTerms.id, id));
  if (existing?.contractPath) await removeTermContractObject(existing.contractPath);

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("termDeleted") };
}

/**
 * Renueva un patrocinio: clona el término desplazando sus fechas un año y lo
 * deja "en negociación" para revisarlo. No copia contrato ni cobros.
 */
function shiftYear(value: string | null, years: number): string | null {
  if (!value) return null;
  const d = new Date(value);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export async function renewSponsorshipTerm(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");
  const source = await db.query.sponsorshipTerms.findFirst({
    where: eq(sponsorshipTerms.id, id),
  });
  if (!source) return { error: t("termNotFound") };

  await db.insert(sponsorshipTerms).values({
    sponsorId: source.sponsorId,
    tier: source.tier,
    agreementStatus: "negotiating",
    totalAmountCents: source.totalAmountCents,
    startsOn: shiftYear(source.startsOn, 1),
    endsOn: shiftYear(source.endsOn, 1),
    benefits: source.benefits,
    notes: source.notes,
  });

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("termRenewed") };
}

// ---------------------------------------------------------------------------
// Cobros (plazos) de un patrocinio
// ---------------------------------------------------------------------------

function readPaymentStatus(
  formData: FormData,
): (typeof paymentStatus.enumValues)[number] {
  const value = String(formData.get("status") ?? "");
  return (paymentStatus.enumValues as readonly string[]).includes(value)
    ? (value as (typeof paymentStatus.enumValues)[number])
    : "pending";
}

function readYear(formData: FormData): number | null {
  const value = Number(String(formData.get("year") ?? "").trim());
  return Number.isInteger(value) && value >= 2000 && value <= 2100 ? value : null;
}

function readPaymentFields(formData: FormData) {
  return {
    year: readYear(formData),
    amountCents: readAmountCents(formData.get("amount")),
    status: readPaymentStatus(formData),
    dueDate: readDate(formData, "dueDate"),
    paidOn: readDate(formData, "paidOn"),
    method: String(formData.get("method") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function addSponsorPayment(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const termId = String(formData.get("termId") ?? "");
  const fields = readPaymentFields(formData);
  if (!termId) return { error: t("termNotFound") };
  if (fields.amountCents === null || fields.amountCents <= 0) {
    return { error: t("paymentAmountRequired") };
  }

  await db.insert(sponsorPayments).values({
    termId,
    year: fields.year,
    amountCents: fields.amountCents,
    status: fields.status,
    dueDate: fields.dueDate,
    paidOn: fields.paidOn,
    method: fields.method,
    notes: fields.notes,
  });

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("paymentCreated") };
}

export async function updateSponsorPayment(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");
  const fields = readPaymentFields(formData);
  if (fields.amountCents === null || fields.amountCents <= 0) {
    return { error: t("paymentAmountRequired") };
  }

  const existing = await db.query.sponsorPayments.findFirst({
    where: eq(sponsorPayments.id, id),
    columns: { id: true },
  });
  if (!existing) return { error: t("paymentNotFound") };

  await db
    .update(sponsorPayments)
    .set({
      year: fields.year,
      amountCents: fields.amountCents,
      status: fields.status,
      dueDate: fields.dueDate,
      paidOn: fields.paidOn,
      method: fields.method,
      notes: fields.notes,
    })
    .where(eq(sponsorPayments.id, id));

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("paymentUpdated") };
}

export async function deleteSponsorPayment(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");
  await db.delete(sponsorPayments).where(eq(sponsorPayments.id, id));

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("paymentDeleted") };
}

/** Marca un cobro como pagado hoy en un solo clic. */
export async function markSponsorPaymentPaid(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");
  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(sponsorPayments)
    .set({ status: "paid", paidOn: today })
    .where(eq(sponsorPayments.id, id));

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("paymentMarkedPaid") };
}

/**
 * Emite la factura de un cobro: le asigna un número correlativo del año en
 * curso (2026/0001...) y fija la fecha de emisión a hoy. Es idempotente: si el
 * cobro ya tiene número de factura no lo reasigna (la numeración no puede tener
 * huecos ni duplicados). El documento imprimible vive en la ruta `recibo`.
 */
export async function issueSponsorInvoice(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");
  const payment = await db.query.sponsorPayments.findFirst({
    where: eq(sponsorPayments.id, id),
    columns: { id: true, invoiceNumber: true },
  });
  if (!payment) return { error: t("paymentNotFound") };
  if (payment.invoiceNumber) return { error: t("alreadyInvoiced") };

  const today = new Date();
  const invoiceNumber = await nextInvoiceNumber(today.getFullYear());

  await db
    .update(sponsorPayments)
    .set({ invoiceNumber, invoicedOn: today.toISOString().slice(0, 10) })
    .where(eq(sponsorPayments.id, id));

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("invoiceIssued", { number: invoiceNumber }) };
}

/**
 * Genera las anualidades de un acuerdo: una por temporada, desde `firstYear`
 * durante `count` temporadas, repartiendo el importe TOTAL indicado entre
 * ellas a partes iguales (los céntimos sueltos de un reparto no exacto van a
 * las últimas temporadas, para que la suma cuadre con el total). Es lo que
 * convierte un acuerdo de 4 años en 4 anualidades listas para facturar. No
 * duplica anualidades de años que ya existan para ese acuerdo.
 */
export async function generateAnnualities(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const termId = String(formData.get("termId") ?? "");
  const firstYear = Number(String(formData.get("firstYear") ?? "").trim());
  const count = Number(String(formData.get("count") ?? "").trim());
  const totalCents = readAmountCents(formData.get("amount"));

  if (!termId) return { error: t("termNotFound") };
  if (!Number.isInteger(firstYear) || firstYear < 2000 || firstYear > 2100) {
    return { error: t("firstYearInvalid") };
  }
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    return { error: t("generateCountInvalid") };
  }
  if (totalCents === null || totalCents <= 0) {
    return { error: t("paymentAmountRequired") };
  }

  const existing = await db.query.sponsorPayments.findMany({
    where: eq(sponsorPayments.termId, termId),
    columns: { year: true },
  });
  const existingYears = new Set(existing.map((p) => p.year));

  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  const rows = Array.from({ length: count }, (_, i) => ({
    year: firstYear + i,
    amountCents: baseCents + (i >= count - remainderCents ? 1 : 0),
  }))
    .filter((row) => !existingYears.has(row.year))
    .map((row) => ({
      termId,
      year: row.year,
      amountCents: row.amountCents,
      status: "pending" as const,
    }));

  if (rows.length === 0) return { error: t("annualitiesAllExist") };
  await db.insert(sponsorPayments).values(rows);

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("annualitiesGenerated", { count: rows.length }) };
}

// ---------------------------------------------------------------------------
// Bitácora de seguimiento del patrocinador
// ---------------------------------------------------------------------------

const sponsorNoteActions = makeNoteActions({
  table: sponsorNotes,
  parentIdColumn: "sponsorId",
  formKey: "sponsorId",
  namespace: "Patrocinadores",
  permission: "patrocinadores.manage",
  routes: [ROUTE.patrocinadorFicha],
});
export const addSponsorNote = sponsorNoteActions.add;
export const deleteSponsorNote = sponsorNoteActions.delete;

const sponsorDocumentActions = makeDocumentActions({
  table: sponsorDocuments,
  bucket: "sponsor-documents",
  parentIdColumn: "sponsorId",
  formKey: "sponsorId",
  namespace: "Patrocinadores",
  permission: "patrocinadores.manage",
  routes: [ROUTE.patrocinadorFicha],
});
export const addSponsorDocument = sponsorDocumentActions.add;
export const updateSponsorDocument = sponsorDocumentActions.update;
export const deleteSponsorDocument = sponsorDocumentActions.delete;

// ---------------------------------------------------------------------------
// Contactos adicionales del patrocinador
// ---------------------------------------------------------------------------

function readContactFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    role: String(formData.get("role") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function addSponsorContact(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const sponsorId = String(formData.get("sponsorId") ?? "");
  const fields = readContactFields(formData);
  if (!fields.name) return { error: t("contactNameRequired") };

  await db.insert(sponsorContacts).values({ sponsorId, ...fields });

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("contactCreated") };
}

export async function updateSponsorContact(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");
  const fields = readContactFields(formData);
  if (!fields.name) return { error: t("contactNameRequired") };

  await db.update(sponsorContacts).set(fields).where(eq(sponsorContacts.id, id));

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("contactUpdated") };
}

export async function deleteSponsorContact(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const id = String(formData.get("id") ?? "");
  await db.delete(sponsorContacts).where(eq(sponsorContacts.id, id));

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("contactDeleted") };
}

// ---------------------------------------------------------------------------
// Importación masiva (pegar filas de la hoja de presupuestos)
// ---------------------------------------------------------------------------

/**
 * Importa patrocinadores desde texto pegado, una línea por patrocinador con
 * campos separados por tabulador o punto y coma: `Nombre; Importe; Nivel`.
 * Crea el patrocinador y un patrocinio con ese importe y nivel. El nivel
 * acepta principal/colaborador/publicidad (o vacío).
 */
export async function importSponsors(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const t = await getTranslations("Patrocinadores");
  await requirePermission("patrocinadores.manage");

  const raw = String(formData.get("data") ?? "");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { error: t("importEmpty") };

  const validTiers = sponsorshipTier.enumValues as readonly string[];

  const parsed = lines.flatMap((line) => {
    const cols = line.split(/[\t;]/).map((c) => c.trim());
    const name = cols[0];
    if (!name) return [];

    const amountRaw = (cols[1] ?? "").replace(/[€\s.]/g, "").replace(",", ".");
    const amount = Number(amountRaw);
    const amountCents = Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;

    const tierRaw = (cols[2] ?? "").toLowerCase();
    const tier = validTiers.includes(tierRaw)
      ? (tierRaw as (typeof sponsorshipTier.enumValues)[number])
      : null;

    return [{ name, tier, amountCents }];
  });
  if (parsed.length === 0) return { error: t("importEmpty") };

  /*
    Dos inserts por lote dentro de una transacción, en vez de dos por línea
    pegada. Antes, un fallo a mitad dejaba patrocinadores sin su acuerdo y sin
    forma de saber por dónde se había quedado la importación; ahora entra todo
    o no entra nada. Mismo criterio que `importTeamsFromSeason`.

    `returning` conserva el orden de `values`, así que cada acuerdo se cuelga
    del patrocinador de su misma línea.
  */
  const created = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(sponsors)
      .values(parsed.map(({ name }) => ({ name })))
      .returning({ id: sponsors.id });

    await tx.insert(sponsorshipTerms).values(
      inserted.map(({ id }, i) => ({
        sponsorId: id,
        tier: parsed[i].tier,
        totalAmountCents: parsed[i].amountCents,
      })),
    );
    return inserted.length;
  });

  revalidateRoutes(
    ROUTE.patrocinadores,
    ROUTE.patrocinadorFicha,
    ROUTE.patrocinadoresFacturas,
    ROUTE.patrocinadoresMuro,
  );
  return { message: t("importDone", { count: created }) };
}
