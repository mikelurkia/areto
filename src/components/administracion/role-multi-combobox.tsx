"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
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
import type { RoleOption } from "@/components/administracion/role-dialog";

/**
 * Selección de roles de una cuenta. Varios a la vez: los permisos efectivos
 * son la unión, así que quien juega y además entrena elige los dos.
 *
 * Combobox con chips y no casillas: los roles no son media docena fija, son
 * filas que el club crea a su gusto. Con casillas la lista crecía sin techo y
 * acababa sacando el diálogo de la pantalla; así la altura del campo no depende
 * de cuántos roles haya, y la descripción de cada uno se lee en el desplegable,
 * que es justo cuando hace falta para elegir bien.
 *
 * `formData.getAll("roleIds")` sigue siendo lo que lee la acción de servidor:
 * se emite un campo oculto por rol elegido, igual que el selector de persona.
 *
 * Controlado y no `defaultValue`: el diálogo de un usuario sigue montado
 * mientras la página se revalida, así que la selección de partida cambia bajo
 * los pies del componente. Quien lo monta le pasa una `key` derivada de la
 * selección para que vuelva a sembrarse cuando el servidor manda datos nuevos.
 */
export function RoleMultiCombobox({
  roles,
  selected,
  disabled,
}: {
  roles: RoleOption[];
  selected: string[];
  disabled?: boolean;
}) {
  const t = useTranslations("Administracion");
  const anchor = useRef<HTMLDivElement | null>(null);

  const [value, setValue] = useState<RoleOption[]>(() =>
    roles.filter((role) => selected.includes(role.id)),
  );
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <>
      {value.map((role) => (
        <input key={role.id} type="hidden" name="roleIds" value={role.id} />
      ))}
      <Combobox<RoleOption, true>
        items={roles}
        multiple
        value={value}
        onValueChange={setValue}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
        itemToStringLabel={(role: RoleOption) => role.name}
        isItemEqualToValue={(a: RoleOption, b: RoleOption) => a.id === b.id}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {(chips: RoleOption[]) => (
              <>
                {chips.map((role) => (
                  <ComboboxChip key={role.id} aria-label={role.name}>
                    {role.name}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={
                    chips.length > 0 ? "" : t("rolesSearchPlaceholder")
                  }
                  disabled={disabled}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>{t("rolesNoResults")}</ComboboxEmpty>
          <ComboboxList>
            {(role: RoleOption) => (
              <ComboboxItem key={role.id} value={role}>
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    {role.name}
                    {role.isDefault ? (
                      <Badge variant="secondary">{t("defaultBadge")}</Badge>
                    ) : null}
                  </span>
                  {role.description ? (
                    <span className="text-xs text-muted-foreground">
                      {role.description}
                    </span>
                  ) : null}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  );
}
