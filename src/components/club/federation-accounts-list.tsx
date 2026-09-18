"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FederationAccount = {
  id: string;
  name: string;
  url: string;
  username: string | null;
  password: string | null;
};

/** Copia al portapapeles y avisa si se pudo. El navegador puede bloquearlo;
 * no es crítico. */
async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      aria-label={label}
      onClick={async () => {
        if (!(await copyToClipboard(value))) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-success" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </Button>
  );
}

function ReadOnlyRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const t = useTranslations("Club");

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={`flex-1 truncate text-sm ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
      <CopyButton value={value} label={t("copyValue", { label })} />
    </div>
  );
}

/**
 * Abre el portal y deja el usuario en el portapapeles de un solo gesto.
 *
 * ORDEN DE OPERACIONES, no negociable: primero se lanza la escritura al
 * portapapeles SIN `await` y acto seguido el `window.open`. Si se abriera la
 * pestaña antes, el documento perdería el foco y Safari/Firefox rechazarían la
 * escritura; y si se esperase a la promesa antes de abrir, se perdería la
 * activación de usuario y el `open` acabaría en el bloqueador de pop-ups.
 */
function OpenAndCopyUserButton({ url, username }: { url: string; username: string }) {
  const t = useTranslations("Club");
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        const copying = copyToClipboard(username);
        window.open(url, "_blank", "noopener,noreferrer");
        void copying.then((ok) => {
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? t("federationUserCopied") : t("federationOpenAndCopyUser")}
      {copied ? (
        <CheckIcon className="size-3.5 text-success" />
      ) : (
        <ExternalLinkIcon className="size-3.5" />
      )}
    </Button>
  );
}

function PasswordRow({ password }: { password: string }) {
  const t = useTranslations("Club");
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">
        {t("federationPasswordLabel")}
      </span>
      <span className="flex-1 truncate font-mono text-sm">
        {shown ? password : "••••••••••"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label={shown ? t("federationHidePassword") : t("federationShowPassword")}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={async () => {
          if (!(await copyToClipboard(password))) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? (
          <>
            {t("federationCopied")}
            <CheckIcon className="size-3.5 text-success" />
          </>
        ) : (
          <>
            {t("federationCopyPassword")}
            <CopyIcon className="size-3.5" />
          </>
        )}
      </Button>
    </div>
  );
}

export function FederationAccountsList({
  accounts,
}: {
  accounts: FederationAccount[];
}) {
  const t = useTranslations("Club");

  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("federationsEmpty")}</p>;
  }

  return (
    <div className="grid gap-4">
      {accounts.map((account) => (
        <Card key={account.id} className="px-(--card-spacing)">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-medium">{account.name}</h3>
            {account.username ? (
              <OpenAndCopyUserButton url={account.url} username={account.username} />
            ) : (
              <a
                href={account.url}
                target="_blank"
                rel="noreferrer noopener"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                {t("federationOpen")}
                <ExternalLinkIcon className="size-3.5" />
              </a>
            )}
          </div>
          <div className="grid gap-2">
            <ReadOnlyRow label={t("federationUrlLabel")} value={account.url} />
            {account.username ? (
              <ReadOnlyRow
                label={t("federationUsernameLabel")}
                value={account.username}
                mono
              />
            ) : null}
            {account.password ? <PasswordRow password={account.password} /> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
