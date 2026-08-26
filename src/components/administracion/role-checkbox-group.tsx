"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { RoleOption } from "@/components/administracion/role-dialog";

/**
 * Selección de roles de una cuenta. Varios a la vez: los permisos efectivos
 * son la unión, así que quien juega y además entrena marca las dos casillas.
 *
 * Casillas y no un desplegable múltiple: con media docena de opciones fijas, un
 * combobox con búsqueda añade un clic y esconde justo lo que hay que leer para
 * elegir bien. Además `formData.getAll("roleIds")` sale gratis. Si algún día el
 * club llega a quince roles, en `components/ui/combobox.tsx` ya está
 * `ComboboxChips` para esto.
 *
 * Controlado y no `defaultChecked`: el diálogo de un usuario sigue montado
 * mientras la página se revalida, así que la selección de partida cambia bajo
 * los pies del componente. Con `defaultChecked` Base UI avisa de que se está
 * cambiando el estado inicial de una casilla no controlada, y la casilla se
 * queda mostrando lo viejo. Quien lo monta le pasa una `key` derivada de la
 * selección para que vuelva a sembrarse cuando el servidor manda datos nuevos.
 */
export function RoleCheckboxGroup({
  roles,
  selected,
  disabled,
  idPrefix,
}: {
  roles: RoleOption[];
  selected: string[];
  disabled?: boolean;
  /** Para no repetir ids cuando hay varios diálogos montados a la vez. */
  idPrefix: string;
}) {
  const t = useTranslations("Administracion");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selected));

  function toggle(roleId: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(roleId);
      else next.delete(roleId);
      return next;
    });
  }

  return (
    <FieldGroup className="gap-2">
      {roles.map((role) => (
        <Field key={role.id} orientation="horizontal">
          <Checkbox
            id={`${idPrefix}-role-${role.id}`}
            name="roleIds"
            value={role.id}
            checked={checked.has(role.id)}
            disabled={disabled}
            onCheckedChange={(on) => toggle(role.id, Boolean(on))}
          />
          <div>
            <FieldLabel
              htmlFor={`${idPrefix}-role-${role.id}`}
              className="items-center font-normal"
            >
              {role.name}
              {role.isDefault ? (
                <Badge variant="secondary">{t("defaultBadge")}</Badge>
              ) : null}
            </FieldLabel>
            {role.description ? (
              <FieldDescription>{role.description}</FieldDescription>
            ) : null}
          </div>
        </Field>
      ))}
    </FieldGroup>
  );
}
