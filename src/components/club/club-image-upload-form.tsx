"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import type { ClubState } from "@/app/[locale]/(app)/club/actions";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";

const initialState: ClubState = {};

/**
 * Sube (o elimina) uno de los tres gráficos del club: logo, sello o firma.
 * Mismo patrón que el logo de patrocinador (`sponsor-dialog.tsx`) —
 * previsualización + campo de fichero + casilla "eliminar" si ya hay uno—,
 * pero como formulario suelto en vez de diálogo. Un solo componente para los
 * tres porque solo cambian la acción, el nombre del campo y la etiqueta.
 */
export function ClubImageUploadForm({
  action,
  fieldName,
  imageUrl,
  label,
}: {
  action: (state: ClubState, formData: FormData) => Promise<ClubState>;
  fieldName: string;
  imageUrl: string | null;
  label: string;
}) {
  const t = useTranslations("Club");
  const [state, formAction] = useActionState(action, initialState);
  useActionToast(state);

  return (
    <form action={formAction} key={imageUrl ?? ""}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`club-${fieldName}`}>{label}</FieldLabel>
          <div className="flex items-center gap-3">
            <div className="flex size-16 items-center justify-center rounded border bg-muted/30 p-1.5">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            <Input
              id={`club-${fieldName}`}
              name={fieldName}
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
          </div>
          {imageUrl ? (
            <Field orientation="horizontal" className="mt-1">
              <Checkbox id={`club-${fieldName}-remove`} name="remove" />
              <Label htmlFor={`club-${fieldName}-remove`} className="font-normal">
                {t("removeImageLabel")}
              </Label>
            </Field>
          ) : null}
        </Field>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <SubmitButton className="self-start">{t("saveClubData")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
