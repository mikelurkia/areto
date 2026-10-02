"use client";

import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";

/**
 * Descarga del adjunto desde la lista, sin entrar en la ficha. `download`
 * fuerza la descarga en vez de abrir el PDF en una pestaña: la URL es del
 * proxy `/api/storage` (mismo origen), que es donde el atributo surte efecto.
 */
export function FileDownloadLink({ url, fileName }: { url: string; fileName: string | null }) {
  const t = useTranslations("Economia");
  return (
    <a
      href={url}
      download={fileName ?? ""}
      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
    >
      <DownloadIcon />
      <span className="sr-only">{t("downloadFileSr")}</span>
    </a>
  );
}
