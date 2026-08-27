"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { findGuardianCandidates } from "@/app/[locale]/(app)/personas/list-actions";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";

export type GuardianOption = {
  id: string;
  firstName: string;
  lastName: string;
};

/** Margen entre la última tecla y la consulta al servidor. */
const SEARCH_DELAY_MS = 250;

/** Longitud mínima, la misma que exige la acción de servidor. */
const MIN_QUERY = 2;

/**
 * Tutores de una persona, por búsqueda en vez de por lista completa.
 *
 * Antes esto era un `<select>` con TODAS las personas del club, y ese select
 * era la razón por la que la pantalla de personas —y las tres fichas de
 * detalle— cargaban la tabla `persons` entera: ver una ficha se llevaba por
 * delante el listado completo. Ahora se buscan al escribir, como la paleta de
 * comandos.
 *
 * Los menores los descarta la consulta, no este componente: un menor no puede
 * ser tutor y ese criterio pertenece al mismo sitio que el resto del filtro.
 *
 * Controlado desde el diálogo porque el importe de la cuota y el mandato SEPA
 * dependen de quién sea el tutor principal (el primero de la lista).
 */
export function GuardianPicker({
  value,
  onValueChange,
  excludePersonId,
}: {
  value: GuardianOption[];
  onValueChange: (next: GuardianOption[]) => void;
  /** Al editar, la propia persona no puede ser su tutora. */
  excludePersonId?: string;
}) {
  const t = useTranslations("Personas");
  const anchor = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GuardianOption[]>([]);

  const term = inputValue.trim();
  const enoughToSearch = term.length >= MIN_QUERY;
  useEffect(() => {
    if (!enoughToSearch) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await findGuardianCandidates(term, excludePersonId);
      if (!cancelled) setResults(found);
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, enoughToSearch, excludePersonId]);

  // Con el texto por debajo del mínimo la lista se vacía por derivación y no
  // llamando a `setResults`: un `setState` en el cuerpo del efecto provoca
  // renders en cascada (y lo prohíbe `react-hooks/set-state-in-effect`).
  // Y los ya elegidos fuera: elegir dos veces al mismo tutor no significa nada.
  const items = enoughToSearch
    ? results.filter((r) => !value.some((v) => v.id === r.id))
    : [];

  return (
    <>
      {/* Lista separada por comas, como espera `readGuardianIds`: el orden
          importa, el primero es el tutor principal y el titular del SEPA. */}
      <input type="hidden" name="guardianIds" value={value.map((g) => g.id).join(",")} />
      <Combobox<GuardianOption, true>
        items={items}
        multiple
        value={value}
        onValueChange={onValueChange}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        open={open}
        onOpenChange={setOpen}
        itemToStringLabel={(g: GuardianOption) => `${g.firstName} ${g.lastName}`}
        isItemEqualToValue={(a: GuardianOption, b: GuardianOption) => a.id === b.id}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {(chips: GuardianOption[]) => (
              <>
                {chips.map((g) => (
                  <ComboboxChip
                    key={g.id}
                    aria-label={`${g.firstName} ${g.lastName}`}
                  >
                    {g.firstName} {g.lastName}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id="person-guardian"
                  placeholder={chips.length > 0 ? "" : t("addGuardianPlaceholder")}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>
            {enoughToSearch ? t("guardianNoResults") : t("guardianSearchHint")}
          </ComboboxEmpty>
          <ComboboxList>
            {(g: GuardianOption) => (
              <ComboboxItem key={g.id} value={g}>
                {g.firstName} {g.lastName}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  );
}
