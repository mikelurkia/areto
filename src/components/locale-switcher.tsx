"use client";

import { useLocale } from "next-intl";
import { GlobeIcon } from "lucide-react";

import { updateLocale } from "@/app/[locale]/(app)/actions";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const localeNames: Record<Locale, string> = {
  eu: "Euskara",
  es: "Castellano",
};

/** En pantallas estrechas no cabe el nombre completo junto al resto de la cabecera. */
const localeShortNames: Record<Locale, string> = {
  eu: "EU",
  es: "ES",
};

type LocaleSwitcherProps = {
  className?: string;
  /** Si hay usuario autenticado, guarda el idioma elegido como su preferencia. */
  persist?: boolean;
};

export function LocaleSwitcher({ className, persist }: LocaleSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  async function selectLocale(l: Locale) {
    if (persist) await updateLocale(l);
    router.replace(pathname, { locale: l });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className={cn("gap-1.5", className)} />
        }
      >
        <GlobeIcon className="size-4" />
        <span className="hidden sm:inline">{localeNames[locale as Locale]}</span>
        <span className="sm:hidden">{localeShortNames[locale as Locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            data-active={l === locale ? true : undefined}
            onClick={() => selectLocale(l)}
          >
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
