"use client";

import { useActionState } from "react";
import { PaperclipIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  uploadInjuryReportTemplate,
  type ClubState,
} from "@/app/[locale]/(app)/club/actions";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ClubState = {};

/**
 * Sustituye la plantilla del parte de lesión de la Mutualidad. Un solo fichero
 * global: al subir uno nuevo reemplaza el anterior, de ahí que el enlace de
 * abajo sea siempre la misma URL.
 *
 * El enlace a la plantilla vigente (o el aviso de que falta) se ve siempre,
 * tenga o no el usuario `club.manage`: es información, no una acción de
 * gestión. Solo el formulario de subida se oculta sin ese permiso.
 */
export function InjuryReportTemplateForm({
  templateUrl,
  canManage,
}: {
  templateUrl: string | null;
  canManage: boolean;
}) {
  const t = useTranslations("Club");
  const [state, action] = useActionState(uploadInjuryReportTemplate, initialState);
  useActionToast(state);

  return (
    <div className="flex flex-col gap-4">
      {templateUrl ? (
        <a
          href={templateUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 self-start text-sm text-primary hover:underline"
        >
          <PaperclipIcon className="size-3.5" />
          {t("injuryTemplateViewCurrent")}
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">{t("injuryTemplateMissing")}</p>
      )}
      {canManage ? (
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="club-injury-template">
                {t("injuryTemplateFileLabel")}
              </FieldLabel>
              <Input
                id="club-injury-template"
                name="template"
                type="file"
                accept="application/pdf"
                required
              />
            </Field>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SubmitButton className="self-start">{t("injuryTemplateSaveAction")}</SubmitButton>
          </FieldGroup>
        </form>
      ) : null}
    </div>
  );
}
