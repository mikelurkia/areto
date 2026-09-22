import { getTranslations } from "next-intl/server";

import {
  addPersonDocument,
  deletePersonDocument,
  requestPersonDocumentUploadUrl,
  updatePersonDocument,
} from "@/app/[locale]/(app)/personas/actions";
import { fileTypeLabel } from "@/lib/file-type";
import { DeleteDocumentDialog } from "@/components/delete-document-dialog";
import { DocumentDialog } from "@/components/document-dialog";
import { EntityFileTable } from "@/components/entity-file-table";
import { SectionHeading } from "@/components/page-header";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { Badge } from "@/components/ui/badge";

type PersonDocument = {
  id: string;
  label: string;
  notes: string | null;
  fileName: string | null;
  filePath: string;
};

type PersonDocumentsTabProps = {
  personId: string;
  canManage: boolean;
  documents: PersonDocument[];
  documentFileUrls: Map<string, string>;
};

/** Pestaña "Documentos" de la ficha de persona. */
export async function PersonDocumentsTab({
  personId,
  canManage,
  documents,
  documentFileUrls,
}: PersonDocumentsTabProps) {
  const t = await getTranslations("Personas");

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title={t("documentsSection")}
        actions={
          canManage ? (
            <DocumentDialog
              mode="create"
              parentId={personId}
              formKey="personId"
              namespace="Personas"
              htmlIdPrefix="person-document"
              addAction={addPersonDocument}
              updateAction={updatePersonDocument}
              requestUploadUrlAction={requestPersonDocumentUploadUrl}
            />
          ) : null
        }
      />
      {documents.length === 0 ? (
        <SectionPlaceholder size="compact" title={t("noDocumentsDescription")} />
      ) : (
        <EntityFileTable
          items={documents}
          canManage={canManage}
          actionsLabel={t("colActions")}
          viewFileLabel={t("documentViewFile")}
          fileUrl={(d) => documentFileUrls.get(d.id) ?? null}
          columns={[
            { header: t("documentLabelLabel"), cell: (d) => d.label, className: "font-medium" },
            {
              header: t("documentTypeColumn"),
              priority: "secondary",
              cell: (d) => {
                const typeLabel = fileTypeLabel(d.fileName ?? d.filePath);
                return typeLabel ? <Badge variant="outline">{typeLabel}</Badge> : "—";
              },
            },
            {
              header: t("documentNotesColumn"),
              cell: (d) => d.notes ?? "—",
              className: "text-muted-foreground",
              priority: "tertiary",
            },
          ]}
          renderActions={(d) => (
            <>
              <DocumentDialog
                mode="edit"
                namespace="Personas"
                htmlIdPrefix="person-document"
                addAction={addPersonDocument}
                updateAction={updatePersonDocument}
                requestUploadUrlAction={requestPersonDocumentUploadUrl}
                document={{ id: d.id, label: d.label, notes: d.notes }}
                fileUrl={documentFileUrls.get(d.id) ?? null}
              />
              <DeleteDocumentDialog
                id={d.id}
                label={d.label}
                namespace="Personas"
                deleteAction={deletePersonDocument}
              />
            </>
          )}
        />
      )}
    </div>
  );
}
