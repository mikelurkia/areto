"use client";

import { useCallback, useEffect, useState } from "react";
import { BellIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { fetchNotifications } from "@/app/[locale]/(app)/notification-actions";
import type { NotificationItem } from "@/lib/notifications";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Campana de notificaciones: las mismas alertas que ya calcula el dashboard
 * (`src/lib/notifications.ts`), accesibles desde cualquier página.
 *
 * Se pide al servidor al montar (una vez por carga completa: el layout no se
 * remonta al navegar dentro de la app) y de nuevo cada vez que se abre, nunca
 * desde el árbol de render de una página — ver el comentario de
 * `loadNotificationAlerts`.
 */
export function NotificationBell() {
  const t = useTranslations("AppLayout");
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  const load = useCallback(() => {
    fetchNotifications().then(setItems);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const count = items?.reduce((sum, item) => sum + item.count, 0) ?? 0;

  return (
    <DropdownMenu onOpenChange={(open) => open && load()}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={t("notificationsSr")} />
        }
      >
        <span className="relative">
          <BellIcon />
          {count > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] tabular-nums"
            >
              {count > 9 ? "9+" : count}
            </Badge>
          ) : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-72">
        <DropdownMenuLabel>{t("notificationsTitle")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!items || items.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            {t("notificationsEmpty")}
          </div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.key} render={<Link href={item.href} />}>
              <div className="flex w-full flex-col gap-0.5 py-0.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1">{item.label}</span>
                  <Badge variant={item.tone === "danger" ? "destructive" : "warning"}>
                    {item.count}
                  </Badge>
                </div>
                {item.hint ? (
                  <span className="text-xs text-muted-foreground">{item.hint}</span>
                ) : null}
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
