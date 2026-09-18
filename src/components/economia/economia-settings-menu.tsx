"use client";

import { SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

export type EconomiaSettingsItem = { key: string; label: string; href: string };

/**
 * Catálogos del módulo (proveedores, cuentas): se tocan una vez por temporada,
 * no a diario, así que salen de la fila de pestañas y viven aquí.
 *
 * Cuando la página activa es uno de ellos, el disparador dice cuál: es lo único
 * que impide que esconderlos cueste saber dónde estás.
 */
export function EconomiaSettingsMenu({
  items,
  activeKey,
  label,
}: {
  items: EconomiaSettingsItem[];
  /** Sección activa, si es una de las de este menú. */
  activeKey?: string;
  label: string;
}) {
  const active = items.find((item) => item.key === activeKey);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={active ? undefined : label}
            aria-current={active ? "page" : undefined}
            className={active ? "font-medium text-foreground" : "text-muted-foreground"}
          />
        }
      >
        <SettingsIcon data-icon="inline-start" />
        {active?.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            data-active={item.key === activeKey ? true : undefined}
            render={<Link href={item.href} />}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
