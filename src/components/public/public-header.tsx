import Image from "next/image";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_WIDTH = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
} as const;

type PublicHeaderProps =
  | {
      variant: "brand";
      maxWidth?: keyof typeof MAX_WIDTH;
    }
  | {
      variant: "back";
      maxWidth?: keyof typeof MAX_WIDTH;
      backHref: string;
      backLabel: string;
    };

/**
 * Cabecera compartida de las páginas públicas. `variant="brand"` es la de la
 * home (logo + marca + acceso al panel); `variant="back"` es la de las
 * páginas interiores (inscripción, patrocinadores, formularios), con un link
 * de vuelta en vez del logo.
 */
export async function PublicHeader(props: PublicHeaderProps) {
  const t = await getTranslations("Landing");
  const maxWidth = MAX_WIDTH[props.maxWidth ?? "5xl"];

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
      <div className={cn("mx-auto flex h-16 w-full items-center justify-between px-6", maxWidth)}>
        {props.variant === "brand" ? (
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="" width={32} height={32} className="size-8 object-contain" />
            <div className="leading-tight">
              <span className="block font-heading font-semibold">{t("brand")}</span>
              <span className="block text-xs text-muted-foreground">{t("brandSubtitle")}</span>
            </div>
          </Link>
        ) : (
          <Link
            href={props.backHref}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            {props.backLabel}
          </Link>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
          {props.variant === "brand" ? (
            <Button render={<Link href="/dashboard" />} nativeButton={false} variant="ghost" size="sm">
              {t("openPanel")}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
