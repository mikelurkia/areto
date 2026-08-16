"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("AppLayout");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("relative", className)}
          />
        }
      >
        <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">{t("themeToggleSr")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          data-active={theme === "light" ? true : undefined}
          onClick={() => setTheme("light")}
        >
          {t("themeLight")}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-active={theme === "dark" ? true : undefined}
          onClick={() => setTheme("dark")}
        >
          {t("themeDark")}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-active={theme === "system" ? true : undefined}
          onClick={() => setTheme("system")}
        >
          {t("themeSystem")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
