import "server-only";

import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { requirePermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { revalidateRoutes, type AppRoute } from "@/lib/revalidate";
import { createSignedUploadUrl, extensionFromMimeType, removeFile } from "@/lib/supabase/storage";

export type DocumentActionState = {
  error?: string;
  message?: string;
};

export type DocumentUploadUrlState = {
  error?: string;
  bucket?: string;
  path?: string;
  signedUrl?: string;
  token?: string;
};

const MAX_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_DOCUMENT_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type DocumentsTable = PgTable & {
  id: AnyPgColumn;
  label: AnyPgColumn;
  filePath: AnyPgColumn;
  fileName: AnyPgColumn;
  notes: AnyPgColumn;
};

function readDocumentFields(formData: FormData) {
  return {
    label: String(formData.get("label") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}


/**
 * Documento genérico (person_documents/team_documents/sponsor_documents...):
 * mismas columnas, mismo bucket por entidad y misma lógica en las tres, solo
 * cambia la tabla, el bucket de Storage y la clave foránea al padre. Genera
 * el trío add/update/delete que cada `actions.ts` reexporta como Server Action.
 */
export function makeDocumentActions(config: {
  table: DocumentsTable;
  bucket: string;
  /** Nombre de la propiedad de la FK al padre en el esquema Drizzle (p.ej. "personId"). */
  parentIdColumn: string;
  /** Nombre del campo del formulario que lleva el id del padre (normalmente igual a `parentIdColumn`). */
  formKey: string;
  namespace: "Personas" | "Equipos" | "Patrocinadores";
  /** Permiso necesario para subir, renombrar o borrar. Lo decide cada módulo. */
  permission: Permission;
  /**
   * Páginas donde se ven estos documentos, para invalidarlas al escribir.
   * Las declara cada módulo: la fábrica no sabe en qué ficha se pintan.
   */
  routes: readonly AppRoute[];
}) {
  const { table, bucket, parentIdColumn, formKey, namespace, permission, routes } =
    config;

  /**
   * El navegador sube el archivo directamente a Storage con esta URL firmada
   * (bypassa el cuerpo de la Server Action, sujeto al límite de 4,5 MB de
   * Vercel); `add`/`update` solo reciben la ruta ya subida. Se comprueba el
   * permiso y el tipo/tamaño aquí, antes de autorizar la subida.
   */
  async function requestUploadUrl(
    _prev: DocumentUploadUrlState,
    formData: FormData,
  ): Promise<DocumentUploadUrlState> {
    const t = await getTranslations(namespace);
    await requirePermission(permission);

    const fileType = String(formData.get("fileType") ?? "");
    const fileSize = Number(formData.get("fileSize") ?? 0);
    if (!ALLOWED_DOCUMENT_FILE_TYPES.includes(fileType)) {
      return { error: t("documentFileInvalidType") };
    }
    if (fileSize > MAX_DOCUMENT_FILE_BYTES) {
      return { error: t("documentFileTooLarge") };
    }

    const existingId = String(formData.get("id") ?? "");
    let parentId: string;
    if (existingId) {
      const existing = await db
        .select({ parentId: table[parentIdColumn as keyof DocumentsTable] as AnyPgColumn })
        .from(table)
        .where(eq(table.id, existingId))
        .then((rows) => rows[0]);
      if (!existing) return { error: t("documentNotFound") };
      parentId = existing.parentId as unknown as string;
    } else {
      parentId = String(formData.get(formKey) ?? "");
    }

    const documentId = crypto.randomUUID();
    const path = `${parentId}/${documentId}.${extensionFromMimeType(fileType)}`;
    const signed = await createSignedUploadUrl(bucket, path);
    if (!signed) return { error: t("documentUploadFailed") };

    return { bucket, path, signedUrl: signed.signedUrl, token: signed.token };
  }

  async function add(
    _prev: DocumentActionState,
    formData: FormData,
  ): Promise<DocumentActionState> {
    const t = await getTranslations(namespace);
    await requirePermission(permission);

    const parentId = String(formData.get(formKey) ?? "");
    const fields = readDocumentFields(formData);
    const filePath = String(formData.get("filePath") ?? "");
    const fileName = String(formData.get("fileName") ?? "");
    if (!fields.label) return { error: t("documentLabelRequired") };
    if (!filePath) return { error: t("documentFileRequired") };

    await db.insert(table).values({
      [parentIdColumn]: parentId,
      label: fields.label,
      filePath,
      fileName: fileName || null,
      notes: fields.notes || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    revalidateRoutes(...routes);
    return { message: t("documentAdded") };
  }

  async function update(
    _prev: DocumentActionState,
    formData: FormData,
  ): Promise<DocumentActionState> {
    const t = await getTranslations(namespace);
    await requirePermission(permission);

    const id = String(formData.get("id") ?? "");
    const fields = readDocumentFields(formData);
    const filePath = String(formData.get("filePath") ?? "");
    const fileName = String(formData.get("fileName") ?? "");
    if (!fields.label) return { error: t("documentLabelRequired") };

    const existing = await db
      .select({ filePath: table.filePath })
      .from(table)
      .where(eq(table.id, id))
      .then((rows) => rows[0]);
    if (!existing) return { error: t("documentNotFound") };

    await db
      .update(table)
      .set({
        label: fields.label,
        notes: fields.notes || null,
        ...(filePath ? { filePath, fileName: fileName || null } : {}),
      })
      .where(eq(table.id, id));

    if (filePath && existing.filePath) {
      await removeFile(bucket, existing.filePath as string);
    }

    revalidateRoutes(...routes);
    return { message: t("documentUpdated") };
  }

  async function deleteDocument(
    _prev: DocumentActionState,
    formData: FormData,
  ): Promise<DocumentActionState> {
    await requirePermission(permission);
    const t = await getTranslations(namespace);

    const id = String(formData.get("id") ?? "");

    const existing = await db
      .select({ filePath: table.filePath })
      .from(table)
      .where(eq(table.id, id))
      .then((rows) => rows[0]);

    await db.delete(table).where(eq(table.id, id));
    if (existing?.filePath) await removeFile(bucket, existing.filePath as string);

    revalidateRoutes(...routes);
    return { message: t("documentDeleted") };
  }

  return { add, update, delete: deleteDocument, requestUploadUrl };
}
