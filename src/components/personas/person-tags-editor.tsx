"use client";

import { useActionState, useRef } from "react";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { addPersonTag, deletePersonTag } from "@/app/[locale]/(app)/personas/actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useActionResult, useActionToast } from "@/hooks/use-action-toast";

type Tag = { id: string; tag: string };

function DeleteTagButton({ id, tag }: { id: string; tag: string }) {
  const t = useTranslations("Personas");
  const [state, action] = useActionState(deletePersonTag, {});
  useActionToast(state);

  return (
    <form action={action} className="print:hidden">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="ml-0.5 rounded-full outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <XIcon className="size-3" />
        <span className="sr-only">{t("deleteTagSr", { tag })}</span>
      </button>
    </form>
  );
}

export function PersonTagsEditor({
  personId,
  tags,
  existingTags,
}: {
  personId: string;
  tags: Tag[];
  existingTags: string[];
}) {
  const t = useTranslations("Personas");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(addPersonTag, {});
  useActionToast(state);
  // Vaciar el campo solo cuando llega una etiqueta nueva, no al volver a la pantalla.
  useActionResult(state, (result) => {
    if (result.message) formRef.current?.reset();
  });

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <Badge key={t.id} variant="secondary" className="capitalize">
          {t.tag}
          <DeleteTagButton id={t.id} tag={t.tag} />
        </Badge>
      ))}
      <form ref={formRef} action={formAction} className="print:hidden">
        <input type="hidden" name="personId" value={personId} />
        <Input
          name="tag"
          list="existing-person-tags"
          placeholder={t("addTagPlaceholder")}
          className="h-6 w-32 text-xs"
        />
        <datalist id="existing-person-tags">
          {existingTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </form>
    </div>
  );
}
