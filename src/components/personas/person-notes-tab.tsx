import { getTranslations } from "next-intl/server";

import { addPersonNote, deletePersonNote } from "@/app/[locale]/(app)/personas/actions";
import { NotesLog } from "@/components/notes-log";
import { SectionHeading } from "@/components/page-header";

type Note = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: Date;
};

type PersonNotesTabProps = {
  personId: string;
  canManage: boolean;
  notes: Note[];
};

/** Pestaña "Bitácora" de la ficha de persona: notas internas. */
export async function PersonNotesTab({ personId, canManage, notes }: PersonNotesTabProps) {
  const t = await getTranslations("Personas");

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title={t("notesLogSection")} />
      <NotesLog
        parentId={personId}
        formKey="personId"
        namespace="Personas"
        addAction={addPersonNote}
        deleteAction={deletePersonNote}
        canManage={canManage}
        notes={notes.map((n) => ({
          id: n.id,
          body: n.body,
          authorName: n.authorName,
          createdAt: n.createdAt.toISOString().slice(0, 16).replace("T", " "),
        }))}
      />
    </div>
  );
}
