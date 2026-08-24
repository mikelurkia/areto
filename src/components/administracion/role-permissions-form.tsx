"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { setRolePermissions } from "@/app/[locale]/(app)/administracion/roles/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  ADMIN_LOCKED_PERMISSIONS,
  PERMISSION_MODULES,
  type Permission,
} from "@/lib/permissions";

/**
 * Matriz de permisos de UN rol: casillas agrupadas por módulo y un único envío.
 *
 * Todas las casillas comparten `name="permissions"`, así que la Server Action
 * las recoge con `formData.getAll("permissions")` y reemplaza el conjunto
 * entero. Con guardado por casilla harían falta decenas de acciones
 * concurrentes y no habría forma de aplicar de una vez la comprobación de "que
 * no quede nadie que pueda administrar".
 */
export function RolePermissionsForm({
  roleId,
  roleKey,
  granted,
  canEdit,
}: {
  roleId: string;
  roleKey: string;
  granted: Permission[];
  canEdit: boolean;
}) {
  const t = useTranslations("Administracion");
  const [checked, setChecked] = useState<Set<Permission>>(() => new Set(granted));
  const [state, action] = useActionState(setRolePermissions, {});
  useActionToast(state);

  // El rol de administrador conserva siempre la administración: es lo único que
  // garantiza que siempre queda una vía de vuelta si alguien se equivoca.
  const isAdminRole = roleKey === "admin";
  const locked = useMemo(
    () => new Set<Permission>(isAdminRole ? ADMIN_LOCKED_PERMISSIONS : []),
    [isAdminRole],
  );

  const initial = useMemo(() => new Set(granted), [granted]);
  const dirty =
    checked.size !== initial.size || [...checked].some((p) => !initial.has(p));

  function toggle(permission: Permission, on: boolean) {
    if (locked.has(permission)) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  function toggleModule(permissions: readonly Permission[], on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const permission of permissions) {
        if (locked.has(permission)) continue;
        if (on) next.add(permission);
        else next.delete(permission);
      }
      return next;
    });
  }

  const losesAdmin = !checked.has("usuarios.manage") && initial.has("usuarios.manage");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="roleId" value={roleId} />
      {/*
        Las casillas bloqueadas se pintan deshabilitadas, y un input deshabilitado
        no viaja en el envío: este oculto es el que las mantiene concedidas.
        La Server Action lo vuelve a comprobar de todos modos.
      */}
      {[...locked].map((permission) => (
        <input key={permission} type="hidden" name="permissions" value={permission} />
      ))}

      {PERMISSION_MODULES.map((module) => {
        const all = module.permissions.every((p) => checked.has(p));
        return (
          <Card key={module.key}>
            <CardHeader>
              <CardTitle className="text-base">
                {t(`modules.${module.key}` as "modules.personas")}
              </CardTitle>
              <CardDescription>
                {t(`moduleHints.${module.key}` as "moduleHints.personas")}
              </CardDescription>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleModule(module.permissions, !all)}
                >
                  {all ? t("clearModule") : t("selectAllModule")}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {module.permissions.map((permission) => {
                const isLocked = locked.has(permission);
                return (
                  <Field key={permission} orientation="horizontal">
                    <Checkbox
                      id={`perm-${permission}`}
                      name={isLocked ? undefined : "permissions"}
                      value={permission}
                      checked={checked.has(permission) || isLocked}
                      disabled={!canEdit || isLocked}
                      onCheckedChange={(value) => toggle(permission, value)}
                    />
                    <div>
                      <FieldLabel
                        htmlFor={`perm-${permission}`}
                        className="font-normal"
                      >
                        {t(`permissions.${permission}` as "permissions.personas.view")}
                      </FieldLabel>
                      <FieldDescription>
                        {isLocked
                          ? t("permissionLocked")
                          : t(
                              `permissionHints.${permission}` as "permissionHints.personas.view",
                            )}
                      </FieldDescription>
                    </div>
                  </Field>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {losesAdmin ? (
        <p className="text-sm text-destructive">{t("removeAdminWarning")}</p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        {!dirty ? (
          <span className="text-sm text-muted-foreground">{t("noChanges")}</span>
        ) : null}
        <SubmitButton disabled={!dirty || !canEdit}>
          {t("savePermissions")}
        </SubmitButton>
      </div>
    </form>
  );
}
