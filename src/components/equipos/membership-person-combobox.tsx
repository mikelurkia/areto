"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

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

/**
 * Selector de persona con búsqueda por texto para el alta de membresías: la
 * lista de personas del club es larga y un `Select` obliga a recorrerla entera.
 * El valor viaja al server action en un input oculto (`personId`).
 */
export function MembershipPersonCombobox({
  id,
  persons,
}: {
  id: string;
  persons: PersonOption[];
}) {
  const t = useTranslations("Equipos");
  const [value, setValue] = useState<PersonOption | null>(null);
  const [inputValue, setInputValue] = useState("");

  const items = useMemo(
    () => [...persons].sort((a, b) => labelOf(a).localeCompare(labelOf(b))),
    [persons],
  );

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
          <ComboboxEmpty>{t("noPersonResults")}</ComboboxEmpty>
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
