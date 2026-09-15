"use client";

import type * as React from "react";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  loadMergePair,
  mergePersons,
  type MergePairPerson,
} from "@/app/[locale]/(app)/personas/duplicados/actions";
import { FormError } from "@/components/form-error";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import { cn } from "@/lib/utils";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useCloseOnActionSuccess } from "@/hooks/use-close-on-action-success";

type CandidatePerson = {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
};

/** Campos comparables, en el orden en que se pintan, con su etiqueta ya existente. */
const FIELDS = [
  ["firstName", "firstNameLabel"],
  ["lastName", "lastNameLabel"],
  ["nationalId", "nationalIdLabel"],
  ["birthDate", "birthDateLabel"],
  ["email", "emailLabel"],
  ["phone", "phoneLabel"],
  ["address", "addressLabel"],
  ["postalCode", "postalCodeLabel"],
  ["city", "cityLabel"],
  ["iban", "ibanLabel"],
  ["medicalCertUntil", "medicalCertLabel"],
  ["shirtSize", "shirtSizeLabel"],
  ["pantsSize", "pantsSizeLabel"],
  ["shoeSize", "shoeSizeLabel"],
  ["photoPath", "photoLabel"],
] as const;

const DATE_FIELDS = new Set(["birthDate", "medicalCertUntil"]);

/**
 * Fusiona dos personas eligiendo, campo a campo, con qué valor se queda la
 * ficha que sobrevive.
 *
 * Se usa en dos sitios: el listado de personas, con las dos filas que el
 * usuario ha marcado a mano —el caso al que el detector de duplicados no llega—
 * y la página de duplicados, donde un grupo puede tener más de dos fichas y hay
 * que elegir antes el par.
 */
export function MergePersonsDialog({
  candidates,
  triggerLabel,
  trigger,
  onMerged,
}: {
  /** Dos o más fichas candidatas; con más de dos, el diálogo pide el par. */
  candidates: CandidatePerson[];
  triggerLabel?: string;
  /** El botón que abre el diálogo, si el de por defecto no encaja. */
  trigger?: React.ReactElement;
  onMerged?: () => void;
}) {
  const t = useTranslations("Personas");
  const locale = useLocale();
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  const [open, setOpen] = useDialogParam(
    `fusionar:${candidates.map((c) => c.id).toSorted().join("_")}`,
  );
  const [primaryId, setPrimaryId] = useState(candidates[0]?.id ?? "");
  const [duplicateId, setDuplicateId] = useState(candidates[1]?.id ?? "");
  // Se guarda junto al par al que pertenece: así, al cambiar la elección, los
  // datos viejos no se pintan como si fueran los nuevos mientras se cargan.
  const [loaded, setLoaded] = useState<{ key: string; rows: MergePairPerson[] } | null>(
    null,
  );
  const [loading, startLoading] = useTransition();
  const pairKey = `${primaryId}_${duplicateId}`;
  const pair = loaded?.key === pairKey ? loaded.rows : null;

  const [state, formAction] = useActionState(mergePersons, {});
  useActionToast(state);
  useCloseOnActionSuccess(state, setOpen);
  useCloseOnActionSuccess(state, () => onMerged?.());

  // Las fichas completas se piden al abrir (y al cambiar el par): el listado
  // solo tiene en el cliente las 25 filas de la página actual.
  useEffect(() => {
    if (!open || !primaryId || !duplicateId || primaryId === duplicateId) return;
    startLoading(async () => {
      const rows = await loadMergePair(primaryId, duplicateId);
      setLoaded({ key: `${primaryId}_${duplicateId}`, rows });
    });
  }, [open, primaryId, duplicateId]);

  const [primary, duplicate] = pair ?? [];

  // El nombre sale de la ficha ya cargada cuando la hay: el listado mantiene la
  // selección al cambiar de página, así que puede pedir fusionar una persona
  // cuyos datos no tiene a mano.
  function label(id: string) {
    const person = pair?.find((p) => p.id === id) ?? candidates.find((p) => p.id === id);
    if (!person) return "";
    return `${person.firstName} ${person.lastName}${person.nationalId ? ` · ${person.nationalId}` : ""}`;
  }
  const pickPair = candidates.length > 2;

  const rows = useMemo(() => {
    if (!primary || !duplicate) return [];
    return FIELDS.flatMap(([field, labelKey]) => {
      const a = primary[field];
      const b = duplicate[field];
      if (a === b || (!a && !b)) return [];
      const text = (value: string | null) => {
        if (!value) return null;
        if (field === "photoPath") return t("mergeHasPhoto");
        if (DATE_FIELDS.has(field)) return dateFmt.format(new Date(`${value}T00:00:00`));
        return value;
      };
      return [{ field, labelKey, primaryText: text(a), duplicateText: text(b) }];
    });
  }, [primary, duplicate, dateFmt, t]);

  const notesDiffer = Boolean(primary && duplicate && primary.notes !== duplicate.notes);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button variant="outline" size="sm" />}>
        {triggerLabel ?? t("mergeAction")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("mergeTitle")}</DialogTitle>
          <DialogDescription>{t("mergeDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex min-h-0 flex-col gap-4">
          <input type="hidden" name="primaryId" value={primaryId} />
          <input type="hidden" name="duplicateId" value={duplicateId} />

          {pickPair ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="merge-primary">{t("mergeKeepLabel")}</FieldLabel>
                <Select
                  value={primaryId}
                  onValueChange={(value: string | null) => setPrimaryId(value ?? "")}
                >
                  <SelectTrigger id="merge-primary" className="w-full">
                    <SelectValue>{(value: string) => label(value)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {label(person.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="merge-duplicate">{t("mergeRemoveLabel")}</FieldLabel>
                <Select
                  value={duplicateId}
                  onValueChange={(value: string | null) => setDuplicateId(value ?? "")}
                >
                  <SelectTrigger id="merge-duplicate" className="w-full">
                    <SelectValue>{(value: string) => label(value)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {label(person.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {candidates.map((person) => (
                <label
                  key={person.id}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                >
                  <input
                    type="radio"
                    name="superviviente"
                    className="sr-only"
                    checked={primaryId === person.id}
                    onChange={() => {
                      setPrimaryId(person.id);
                      setDuplicateId(
                        candidates.find((c) => c.id !== person.id)?.id ?? "",
                      );
                    }}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{label(person.id)}</span>
                    <span className="text-xs text-muted-foreground">
                      {primaryId === person.id ? t("mergeKeepThis") : t("mergeRemoveThis")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {loading || !primary || !duplicate ? (
            <SectionPlaceholder size="compact" title={t("mergeLoadingFields")} />
          ) : rows.length === 0 && !notesDiffer ? (
            <SectionPlaceholder size="compact" title={t("mergeNoFieldDifferences")} />
          ) : (
            // `key` con la superviviente: al cambiarla, los radios vuelven a
            // montarse con el valor por defecto recalculado.
            <div key={primaryId} className="max-h-[50vh] overflow-y-auto pr-1">
              <div className="flex flex-col gap-3">
                {rows.map((row) => (
                  <FieldChoice
                    key={row.field}
                    name={`campo.${row.field}`}
                    label={t(row.labelKey)}
                    emptyLabel={t("mergeEmptyValue")}
                    options={[
                      { value: "primary", text: row.primaryText },
                      { value: "duplicate", text: row.duplicateText },
                    ]}
                    defaultValue={row.primaryText ? "primary" : "duplicate"}
                  />
                ))}
                {notesDiffer ? (
                  <FieldChoice
                    name="campo.notes"
                    label={t("notesLabel")}
                    emptyLabel={t("mergeEmptyValue")}
                    options={[
                      { value: "both", text: t("mergeNotesBoth") },
                      { value: "primary", text: primary.notes },
                      { value: "duplicate", text: duplicate.notes },
                    ]}
                    defaultValue="both"
                  />
                ) : null}
              </div>
            </div>
          )}

          <Alert>
            <AlertDescription>{t("mergeRelationsNotice")}</AlertDescription>
          </Alert>

          <FormError message={state.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton variant="destructive" disabled={loading || !primary}>
              {t("mergeConfirmButton")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Una fila de la comparación: la etiqueta del campo y los valores entre los que
 * elegir. Radios nativos porque el formulario se envía con `FormData`; van
 * ocultos y es la propia etiqueta la que se marca (`has-[:checked]`).
 */
function FieldChoice({
  name,
  label,
  emptyLabel,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  emptyLabel: string;
  options: { value: string; text: string | null }[];
  defaultValue: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        className={cn(
          "grid gap-2",
          options.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm break-words has-[:checked]:border-primary has-[:checked]:bg-primary/10"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className="sr-only"
            />
            <span className={option.text ? undefined : "text-muted-foreground italic"}>
              {option.text ?? emptyLabel}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
