"use client";

import { Fragment, useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { setPermissionMatrix } from "@/app/[locale]/(app)/administracion/roles/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useActionToast } from "@/hooks/use-action-toast";
import { cn } from "@/lib/utils";
import {
  ADMIN_LOCKED_PERMISSIONS,
  PERMISSION_MODULES,
  permissionKey,
  type Permission,
} from "@/lib/permissions";

export type MatrixRole = {
  id: string;
  key: string;
  /** Etiqueta ya resuelta: traducida si es de fábrica, su nombre si es del club. */
  label: string;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
  userCount: number;
};

/**
 * Clave de una casilla. Los uuid no contienen `:` y las claves de permiso
 * tampoco (solo puntos, ver `permissionKey`), así que el primer `:` parte sin
 * ambigüedad tanto aquí como en la Server Action.
 */
const cellKey = (roleId: string, permission: Permission) => `${roleId}:${permission}`;

/**
 * Matriz roles × permisos: permisos en filas (agrupados por módulo), roles en
 * columnas, editable in situ y con un único envío.
 *
 * Sustituye a la ficha por rol y al resumen de solo lectura que había antes:
 * eran la misma información contada dos veces, y comparar dos roles obligaba a
 * ir y volver. Con 22 permisos y media docena de roles cabe en una pantalla.
 *
 * El estado es un `Set` plano de claves compuestas y no un `Map<rol, Set>`
 * porque todas las operaciones (casilla, fila, columna, módulo×rol) son
 * "añadir o quitar N claves", y el diff de sucio es un one-liner.
 */
export function RolesPermissionMatrix({
  roles,
  granted,
  canEdit,
}: {
  roles: MatrixRole[];
  /** roleId → permisos concedidos, ya filtrados contra el catálogo en el servidor. */
  granted: Record<string, Permission[]>;
  canEdit: boolean;
}) {
  const t = useTranslations("Administracion");
  const [state, action] = useActionState(setPermissionMatrix, {});
  useActionToast(state);

  const initial = useMemo(() => {
    const set = new Set<string>();
    for (const role of roles) {
      for (const permission of granted[role.id] ?? []) {
        set.add(cellKey(role.id, permission));
      }
    }
    return set;
  }, [roles, granted]);

  const [checked, setChecked] = useState<Set<string>>(() => new Set(initial));

  // El rol de administrador conserva siempre la administración: es lo único
  // que garantiza que siempre queda una vía de vuelta si alguien se equivoca.
  const adminRoleId = roles.find((r) => r.key === "admin")?.id;
  const isLocked = (roleId: string, permission: Permission) =>
    roleId === adminRoleId &&
    (ADMIN_LOCKED_PERMISSIONS as readonly string[]).includes(permission);

  const dirtyCells = useMemo(() => {
    const out = new Set<string>();
    for (const key of checked) if (!initial.has(key)) out.add(key);
    for (const key of initial) if (!checked.has(key)) out.add(key);
    return out;
  }, [checked, initial]);

  /** Columnas tocadas: son las únicas que se envían y, por tanto, se reescriben. */
  const dirtyRoleIds = useMemo(() => {
    const out = new Set<string>();
    for (const key of dirtyCells) out.add(key.slice(0, key.indexOf(":")));
    return out;
  }, [dirtyCells]);

  function setCells(pairs: [string, Permission][], on: boolean) {
    if (!canEdit) return;
    setChecked((prev) => {
      const next = new Set(prev);
      for (const [roleId, permission] of pairs) {
        if (isLocked(roleId, permission)) continue;
        const key = cellKey(roleId, permission);
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  const has = (roleId: string, permission: Permission) =>
    checked.has(cellKey(roleId, permission)) || isLocked(roleId, permission);

  /** Estado de un grupo de pares para una casilla tri-estado. */
  function groupState(pairs: [string, Permission][]) {
    const on = pairs.filter(([r, p]) => has(r, p)).length;
    return {
      checked: on === pairs.length && pairs.length > 0,
      indeterminate: on > 0 && on < pairs.length,
    };
  }

  const allPairs: [string, Permission][] = roles.flatMap((role) =>
    PERMISSION_MODULES.flatMap((m) =>
      m.permissions.map((p) => [role.id, p] as [string, Permission]),
    ),
  );

  // Roles que pierden la administración con este cambio.
  const losesAdmin = roles.some(
    (r) =>
      initial.has(cellKey(r.id, "usuarios.manage")) &&
      !checked.has(cellKey(r.id, "usuarios.manage")),
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      {/* Qué columnas se reescriben. Sin esto, vaciar un rol por completo sería
          indistinguible de no haberlo tocado. */}
      {[...dirtyRoleIds].map((roleId) => (
        <input key={roleId} type="hidden" name="role" value={roleId} />
      ))}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("matrixSubtitle")}</p>
        {canEdit ? (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCells(allPairs, true)}
            >
              {t("selectAllModule")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCells(allPairs, false)}
            >
              {t("clearModule")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                scope="col"
                className="sticky left-0 z-20 min-w-56 border-r bg-background"
              >
                {t("colPermissions")}
              </TableHead>
              {roles.map((role) => {
                const column: [string, Permission][] = PERMISSION_MODULES.flatMap((m) =>
                  m.permissions.map((p) => [role.id, p] as [string, Permission]),
                );
                const s = groupState(column);
                return (
                  <TableHead key={role.id} scope="col" className="min-w-28 text-center">
                    <div className="flex flex-col items-center gap-1 py-1">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="font-medium text-foreground">
                              {role.label}
                            </span>
                          }
                        />
                        <TooltipContent>
                          {t("roleUserCount", { count: role.userCount })}
                          {role.description ? ` · ${role.description}` : ""}
                        </TooltipContent>
                      </Tooltip>
                      <div className="flex gap-1">
                        {role.isSystem ? (
                          <Badge variant="secondary">{t("systemBadge")}</Badge>
                        ) : null}
                        {role.isDefault ? (
                          <Badge variant="secondary">{t("defaultBadge")}</Badge>
                        ) : null}
                      </div>
                      <Checkbox
                        aria-label={t("selectAllColumn", { role: role.label })}
                        checked={s.checked}
                        indeterminate={s.indeterminate}
                        disabled={!canEdit}
                        onCheckedChange={(on) => setCells(column, Boolean(on))}
                      />
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {PERMISSION_MODULES.map((module) => (
              <Fragment key={module.key}>
                <TableRow className="bg-muted/50">
                  <TableCell className="sticky left-0 z-10 border-r bg-muted/50 font-medium">
                    {t(`modules.${module.key}` as "modules.personas")}
                  </TableCell>
                  {roles.map((role) => {
                    const cells: [string, Permission][] = module.permissions.map(
                      (p) => [role.id, p] as [string, Permission],
                    );
                    const s = groupState(cells);
                    return (
                      <TableCell key={role.id} className="bg-muted/50 text-center">
                        <Checkbox
                          aria-label={`${t(`modules.${module.key}` as "modules.personas")} — ${role.label}`}
                          checked={s.checked}
                          indeterminate={s.indeterminate}
                          disabled={!canEdit}
                          onCheckedChange={(on) => setCells(cells, Boolean(on))}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>

                {module.permissions.map((permission) => {
                  const row: [string, Permission][] = roles.map(
                    (r) => [r.id, permission] as [string, Permission],
                  );
                  const label = t(
                    `permissions.${permissionKey(permission)}` as "permissions.personas_view",
                  );
                  return (
                    <TableRow key={permission}>
                      <TableCell className="sticky left-0 z-10 border-r bg-background">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            aria-label={t("selectAllRow", { permission: label })}
                            checked={groupState(row).checked}
                            indeterminate={groupState(row).indeterminate}
                            disabled={!canEdit}
                            onCheckedChange={(on) => setCells(row, Boolean(on))}
                          />
                          <span className="text-sm font-normal">{label}</span>
                        </div>
                      </TableCell>
                      {roles.map((role) => {
                        const locked = isLocked(role.id, permission);
                        const key = cellKey(role.id, permission);
                        const cell = (
                          <Checkbox
                            aria-label={`${label} — ${role.label}`}
                            name={locked ? undefined : "cell"}
                            value={key}
                            checked={has(role.id, permission)}
                            disabled={!canEdit || locked}
                            onCheckedChange={(on) =>
                              setCells([[role.id, permission]], Boolean(on))
                            }
                          />
                        );
                        return (
                          <TableCell
                            key={role.id}
                            className={cn(
                              "text-center",
                              dirtyCells.has(key) && "bg-primary/5 ring-1 ring-primary/40",
                            )}
                          >
                            {locked ? (
                              <Tooltip>
                                <TooltipTrigger render={<span>{cell}</span>} />
                                <TooltipContent>{t("permissionLocked")}</TooltipContent>
                              </Tooltip>
                            ) : (
                              cell
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/*
        Las casillas bloqueadas se pintan deshabilitadas, y un input deshabilitado
        no viaja en el envío: estos ocultos son los que las mantienen concedidas
        cuando su columna se reescribe. La Server Action lo vuelve a forzar.
      */}
      {adminRoleId && dirtyRoleIds.has(adminRoleId)
        ? ADMIN_LOCKED_PERMISSIONS.map((permission) => (
            <input
              key={permission}
              type="hidden"
              name="cell"
              value={cellKey(adminRoleId, permission)}
            />
          ))
        : null}

      {losesAdmin ? (
        <p className="text-sm text-destructive">{t("removeAdminWarning")}</p>
      ) : null}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        {dirtyCells.size === 0 ? (
          <span className="text-sm text-muted-foreground">{t("noChanges")}</span>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">
              {t("matrixDirtyCount", { count: dirtyCells.size })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChecked(new Set(initial))}
            >
              {t("discardChanges")}
            </Button>
          </>
        )}
        <SubmitButton disabled={dirtyCells.size === 0 || !canEdit}>
          {t("savePermissions")}
        </SubmitButton>
      </div>
    </form>
  );
}
