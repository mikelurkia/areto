"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cabecera de la app. Es un componente de cliente para que el layout pueda ser
 * sincrónico: cualquier `await` en el layout (traducciones incluidas) bloquea la
 * navegación entera y deja sin efecto los `loading.tsx` de las rutas hijas.
 * No añade JS apreciable: el trigger, el tema y el idioma ya eran de cliente.
 */
export function AppHeader() {
  const t = useTranslations("AppLayout");

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 print:hidden">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <span className="text-sm font-medium text-muted-foreground">
        {t("headerTitle")}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        {/*
          El selector de idioma lee `usePathname()`, que en el armazón estático de
          una ruta con parámetros dinámicos (/personas/[personId], etc.) todavía no
          se conoce: sin este límite bloquearía el prerender de la ruta entera.
          El hueco tiene el tamaño del botón para que no salte la cabecera.
        */}
        <Suspense fallback={<Skeleton className="mx-2.5 h-4 w-20" />}>
          <LocaleSwitcher persist />
        </Suspense>
      </div>
    </header>
  );
}
