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

export type PersonOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  /** Correo del usuario que ya la tiene vinculada, si no es el que se edita. */
  linkedToEmail: string | null;
};

const labelOf = (p: PersonOption) => `${p.firstName} ${p.lastName}`.trim();

/**
 * Selector de la persona del club a la que corresponde una cuenta.
 *
 * Las opciones vienen enteras del servidor y se filtran en el navegador, igual
 * que en el selector de contacto de patrocinadores: son unos pocos campos por
 * persona y evita una acción de servidor por pulsación.
 *
 * Las personas ya vinculadas a otra cuenta salen deshabilitadas en vez de
 * ocultas, con el correo de quien las ocupa: que se vea *por qué* no se pueden
 * elegir ahorra el "no encuentro a Fulano". El índice único de la base de datos
 * lo vuelve a impedir de todas formas.
 */
export function UserPersonCombobox({
  personOptions,
  defaultPersonId,
  emailHint,
}: {
  personOptions: PersonOption[];
  defaultPersonId: string | null;
  /** Correo tecleado en el formulario, para sugerir la persona que coincida. */
  emailHint?: string;
}) {
  const t = useTranslations("Administracion");

  const items = useMemo(
    () => [...personOptions].sort((a, b) => labelOf(a).localeCompare(labelOf(b))),
    [personOptions],
  );

  const suggested = useMemo(() => {
    const email = emailHint?.trim().toLowerCase();
    if (!email) return null;
    return (
      items.find((p) => !p.linkedToEmail && p.email?.toLowerCase() === email) ?? null
    );
  }, [items, emailHint]);

  const [value, setValue] = useState<PersonOption | null>(
    () => items.find((p) => p.id === defaultPersonId) ?? null,
  );
  const [inputValue, setInputValue] = useState(() => (value ? labelOf(value) : ""));
  const [open, setOpen] = useState(false);

  return (
    <>
      <input type="hidden" name="personId" value={value?.id ?? "none"} />
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
          placeholder={t("personSearchPlaceholder")}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>{t("personNoResults")}</ComboboxEmpty>
          <ComboboxList>
            {(person: PersonOption) => (
              <ComboboxItem
                key={person.id}
                value={person}
                disabled={person.linkedToEmail !== null}
              >
                <span>{labelOf(person)}</span>
                {person.linkedToEmail ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t("personLinkedTo", { email: person.linkedToEmail })}
                  </span>
                ) : null}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {suggested && !value ? (
        <button
          type="button"
          className="self-start text-xs text-muted-foreground hover:underline"
          onClick={() => {
            setValue(suggested);
            setInputValue(labelOf(suggested));
          }}
        >
          {t("personEmailMatch", { name: labelOf(suggested) })}
        </button>
      ) : null}
    </>
  );
}
