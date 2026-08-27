import "server-only";

import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { requirePermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { revalidateRoutes, type AppRoute } from "@/lib/revalidate";

export type NoteActionState = {
  error?: string;
  message?: string;
};

type NotesTable = PgTable & {
  id: AnyPgColumn;
  body: AnyPgColumn;
  authorName: AnyPgColumn;
};

/**
 * Bitácora de notas (person_notes/team_notes/sponsor_notes...): mismas
 * columnas y misma lógica en las tres, solo cambia la tabla, la clave foránea
 * al padre y el namespace de traducción. Genera el par add/delete que cada
 * `actions.ts` reexporta como Server Action.
 */
export function makeNoteActions(config: {
  table: NotesTable;
  /** Nombre de la propiedad de la FK al padre en el esquema Drizzle (p.ej. "personId"). */
  parentIdColumn: string;
  /** Nombre del campo del formulario que lleva el id del padre (normalmente igual a `parentIdColumn`). */
  formKey: string;
  namespace: "Personas" | "Equipos" | "Patrocinadores";
  /** Permiso necesario para escribir en la bitácora. Lo decide cada módulo. */
  permission: Permission;
  /**
   * Páginas donde se ve esta bitácora, para invalidarlas al escribir. Las
   * declara cada módulo porque la fábrica no puede saber en qué ficha se
   * pinta la tabla que le pasan.
   */
  routes: readonly AppRoute[];
}) {
  const { table, parentIdColumn, formKey, namespace, permission, routes } = config;

  async function add(
    _prev: NoteActionState,
    formData: FormData,
  ): Promise<NoteActionState> {
    const t = await getTranslations(namespace);
    const user = await requirePermission(permission);

    const parentId = String(formData.get(formKey) ?? "");
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return { error: t("noteBodyRequired") };

    await db.insert(table).values({
      [parentIdColumn]: parentId,
      body,
      authorName: user.fullName ?? user.email,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    revalidateRoutes(...routes);
    return { message: t("noteAdded") };
  }

  async function deleteNote(
    _prev: NoteActionState,
    formData: FormData,
  ): Promise<NoteActionState> {
    const t = await getTranslations(namespace);
    await requirePermission(permission);

    const id = String(formData.get("id") ?? "");
    await db.delete(table).where(eq(table.id, id));

    revalidateRoutes(...routes);
    return { message: t("noteDeleted") };
  }

  return { add, delete: deleteNote };
}
