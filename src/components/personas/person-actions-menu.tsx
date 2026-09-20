"use client";

import { DownloadIcon, EllipsisIcon, PrinterIcon, ShieldCheckIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Agrupa las acciones menos frecuentes de la cabecera de ficha (RGPD,
 * descargar foto, imprimir) para que solo el carné y editar queden sueltos.
 */
export function PersonActionsMenu({
  rgpdHref,
  rgpdLabel,
  photoDownloadUrl,
  photoDownloadName,
  downloadPhotoLabel,
  printLabel,
  triggerLabel,
}: {
  rgpdHref: string;
  rgpdLabel: string;
  photoDownloadUrl: string | null;
  photoDownloadName: string | null;
  downloadPhotoLabel: string;
  printLabel: string;
  triggerLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <EllipsisIcon data-icon="inline-start" />
        {triggerLabel}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={rgpdHref} />}>
          <ShieldCheckIcon />
          {rgpdLabel}
        </DropdownMenuItem>
        {photoDownloadUrl ? (
          <DropdownMenuItem
            render={<a href={photoDownloadUrl} download={photoDownloadName ?? undefined} />}
          >
            <DownloadIcon />
            {downloadPhotoLabel}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => window.print()}>
          <PrinterIcon />
          {printLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
