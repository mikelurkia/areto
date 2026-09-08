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

export type PersonOption = { id: string; firstName: string; lastName: string };

const labelOf = (p: PersonOption) => `${p.firstName} ${p.lastName}`.trim();

/**
 * Solo selección sobre `persons` ya existentes: a diferencia de
 * `ContactPersonCombobox`, un ticket no da de alta gente nueva al vuelo.
 */
export function PurchaseReceiptPersonCombobox({
  personOptions,
  defaultPersonId,
}: {
  personOptions: PersonOption[];
  defaultPersonId: string | null;
}) {
  const t = useTranslations("Economia");
  const [value, setValue] = useState<PersonOption | null>(
    () => personOptions.find((p) => p.id === defaultPersonId) ?? null,
  );
  const [inputValue, setInputValue] = useState(() => (value ? labelOf(value) : ""));
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => [...personOptions].sort((a, b) => labelOf(a).localeCompare(labelOf(b))),
    [personOptions],
  );

  return (
    <>
      <input type="hidden" name="paidByPersonId" value={value?.id ?? "none"} />
      <Combobox<PersonOption>
        items={items}
        value={value}
        onValueChange={setValue}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        open={open}
        onOpenChange={setOpen}
        itemToStringLabel={labelOf}
        isItemEqualToValue={(a, b) => a.id === b.id}
      >
        <ComboboxInput
          className="w-full"
          placeholder={t("ticketPaidBySearchPlaceholder")}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>{t("ticketPaidByNoResults")}</ComboboxEmpty>
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
