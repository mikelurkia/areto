"use client";

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
 * elegir bien. Además `formData.getAll("roleIds")` sale gratis y el formulario
 * funciona sin JavaScript. Si algún día el club llega a quince roles, en
 * `components/ui/combobox.tsx` ya está `ComboboxChips` para esto.
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
  const checked = new Set(selected);

  return (
    <FieldGroup className="gap-2">
      {roles.map((role) => (
        <Field key={role.id} orientation="horizontal">
          <Checkbox
            id={`${idPrefix}-role-${role.id}`}
            name="roleIds"
            value={role.id}
            defaultChecked={checked.has(role.id)}
            disabled={disabled}
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
