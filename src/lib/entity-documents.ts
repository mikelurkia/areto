import "server-only";

import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { requirePermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { extensionFromMimeType, removeFile, uploadFile } from "@/lib/supabase/storage";

export type DocumentActionState = {
  error?: string;
  message?: string;
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

function readDocumentFile(formData: FormData): File | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
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
}) {
  const { table, bucket, parentIdColumn, formKey, namespace, permission } = config;

  async function uploadDocumentFile(
    parentId: string,
    documentId: string,
    file: File,
  ): Promise<string> {
    const path = `${parentId}/${documentId}.${extensionFromMimeType(file.type)}`;
    await uploadFile(bucket, path, file);
    return path;
  }

  async function add(
    _prev: DocumentActionState,
    formData: FormData,
  ): Promise<DocumentActionState> {
    const t = await getTranslations(namespace);
    await requirePermission(permission);

    const parentId = String(formData.get(formKey) ?? "");
    const fields = readDocumentFields(formData);
    const file = readDocumentFile(formData);
    if (!fields.label) return { error: t("documentLabelRequired") };
    if (!file) return { error: t("documentFileRequired") };
    if (!ALLOWED_DOCUMENT_FILE_TYPES.includes(file.type)) {
      return { error: t("documentFileInvalidType") };
    }
    if (file.size > MAX_DOCUMENT_FILE_BYTES) {
      return { error: t("documentFileTooLarge") };
    }

    const [document] = (await db
      .insert(table)
      .values({
        [parentIdColumn]: parentId,
        label: fields.label,
        filePath: "", // se rellena tras subir el archivo
        fileName: file.name || null,
        notes: fields.notes || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning({ id: table.id })) as { id: string }[];

    const path = await uploadDocumentFile(parentId, document.id, file);
    await db.update(table).set({ filePath: path }).where(eq(table.id, document.id));

    revalidatePath("/", "layout");
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
    const file = readDocumentFile(formData);
    if (!fields.label) return { error: t("documentLabelRequired") };
    if (file && !ALLOWED_DOCUMENT_FILE_TYPES.includes(file.type)) {
      return { error: t("documentFileInvalidType") };
    }
    if (file && file.size > MAX_DOCUMENT_FILE_BYTES) {
      return { error: t("documentFileTooLarge") };
    }

    const existing = await db
      .select({ parentId: table[parentIdColumn as keyof DocumentsTable] as AnyPgColumn, filePath: table.filePath })
      .from(table)
      .where(eq(table.id, id))
      .then((rows) => rows[0]);
    if (!existing) return { error: t("documentNotFound") };

    await db
      .update(table)
      .set({
        label: fields.label,
        notes: fields.notes || null,
        ...(file ? { fileName: file.name || null } : {}),
      })
      .where(eq(table.id, id));

    if (file) {
      if (existing.filePath) await removeFile(bucket, existing.filePath as string);
      const path = await uploadDocumentFile(existing.parentId as unknown as string, id, file);
      await db.update(table).set({ filePath: path }).where(eq(table.id, id));
    }

    revalidatePath("/", "layout");
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

    revalidatePath("/", "layout");
    return { message: t("documentDeleted") };
  }

  return { add, update, delete: deleteDocument };
}
