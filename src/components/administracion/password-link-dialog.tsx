"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { UserState } from "@/app/[locale]/(app)/administracion/usuarios/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useActionResult } from "@/hooks/use-action-toast";

/**
 * Enseña el enlace de invitación o de recuperación que acaba de generar una
 * acción, para copiarlo y pasárselo a su destinatario. Sin SMTP es la única
 * forma de que le llegue; con SMTP sirve de respaldo si el correo no aparece.
 */
export function PasswordLinkDialog({ state }: { state: UserState }) {
  const t = useTranslations("Administracion");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useActionResult(state, (result) => {
    if (result.link) {
      setLink(result.link);
      setCopied(false);
    }
  });

  return (
    <Dialog open={link !== null} onOpenChange={(open) => !open && setLink(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("passwordLinkTitle")}</DialogTitle>
          <DialogDescription>{t("passwordLinkDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={link ?? ""}
            aria-label={t("passwordLinkTitle")}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("copyLink")}
            onClick={async () => {
              if (!link) return;
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                // El navegador puede bloquear el portapapeles; el campo sigue
                // ahí para copiarlo a mano.
              }
            }}
          >
            {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
          </Button>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" />}>{t("close")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
