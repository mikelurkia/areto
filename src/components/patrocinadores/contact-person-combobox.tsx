"use client";

import { useMemo, useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { quickCreateContactPerson } from "@/app/[locale]/(app)/patrocinadores/actions";
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

export function ContactPersonCombobox({
  personOptions,
  defaultPersonId,
}: {
  personOptions: PersonOption[];
  defaultPersonId: string | null;
}) {
  const t = useTranslations("Patrocinadores");
  const [options, setOptions] = useState(personOptions);
  const [value, setValue] = useState<PersonOption | null>(
    () => personOptions.find((p) => p.id === defaultPersonId) ?? null,
  );
  const [inputValue, setInputValue] = useState(() => (value ? labelOf(value) : ""));
  const [open, setOpen] = useState(false);
  const [isCreating, startCreate] = useTransition();

  const items = useMemo(
    () => [...options].sort((a, b) => labelOf(a).localeCompare(labelOf(b))),
    [options],
  );

  const trimmedQuery = inputValue.trim();

  function handleCreate() {
    if (!trimmedQuery || isCreating) return;
    startCreate(async () => {
      const result = await quickCreateContactPerson(trimmedQuery);
      if (result.error || !result.person) {
        toast.error(result.error ?? t("contactPersonCreateError"));
        return;
      }
      const person = result.person;
      setOptions((prev) => [person, ...prev]);
      setValue(person);
      setInputValue(labelOf(person));
      setOpen(false);
      toast.success(t("contactPersonCreated"));
    });
  }

  return (
    <>
      <input type="hidden" name="contactPersonId" value={value?.id ?? "none"} />
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
          placeholder={t("contactPersonSearchPlaceholder")}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {trimmedQuery ? (
              <button
                type="button"
                disabled={isCreating}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCreate}
                className="flex w-full items-center justify-center gap-1.5 px-2 py-1.5 text-sm text-foreground hover:underline disabled:opacity-50"
              >
                <PlusIcon className="size-4 shrink-0" />
                {t("contactPersonCreateAction", { name: trimmedQuery })}
              </button>
            ) : (
              t("contactPersonNoResults")
            )}
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
