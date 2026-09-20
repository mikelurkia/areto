"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { findMembershipCandidates } from "@/app/[locale]/(app)/equipos/[teamId]/actions";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

type PersonOption = { id: string; firstName: string; lastName: string };

const labelOf = (p: PersonOption) => `${p.firstName} ${p.lastName}`.trim();

/** Margen entre la última tecla y la consulta al servidor. */
const SEARCH_DELAY_MS = 250;

/** Longitud mínima, la misma que exige la acción de servidor. */
const MIN_QUERY = 2;

/**
 * Selector de persona con búsqueda al escribir para el alta de membresías:
 * antes recibía la lista completa de personas del club por props, que era la
 * razón por la que la ficha de equipo cargaba la tabla `persons` entera (ver
 * `equipos/[teamId]/page.tsx`). Mismo patrón que `GuardianPicker`.
 * El valor viaja al server action en un input oculto (`personId`).
 */
export function MembershipPersonCombobox({ id, teamId }: { id: string; teamId: string }) {
  const t = useTranslations("Equipos");
  const [value, setValue] = useState<PersonOption | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<PersonOption[]>([]);

  const term = inputValue.trim();
  const enoughToSearch = term.length >= MIN_QUERY;
  useEffect(() => {
    if (!enoughToSearch) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await findMembershipCandidates(teamId, term);
      if (!cancelled) setResults(found);
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, enoughToSearch, teamId]);

  const items = enoughToSearch ? results : [];

  return (
    <>
      <input type="hidden" name="personId" value={value?.id ?? ""} />
      <Combobox<PersonOption>
        items={items}
        value={value}
        onValueChange={setValue}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        itemToStringLabel={labelOf}
        isItemEqualToValue={(a, b) => a.id === b.id}
      >
        <ComboboxInput
          id={id}
          className="w-full"
          placeholder={t("searchPersonPlaceholder")}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {enoughToSearch ? t("noPersonResults") : t("searchPersonHint")}
          </ComboboxEmpty>
          <ComboboxList>
            {(person: PersonOption) => (
              <ComboboxItem key={person.id} value={person}>
                {labelOf(person)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  );
}
