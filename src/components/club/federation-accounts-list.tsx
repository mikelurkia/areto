"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, CopyIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FederationAccount = {
  id: string;
  name: string;
  url: string;
  username: string | null;
  password: string | null;
};

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
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // El navegador puede bloquear el portapapeles; no es crítico.
        }
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
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={`flex-1 truncate text-sm ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
      <CopyButton value={value} label={`${label}: copiar`} />
    </div>
  );
}

export function FederationAccountsList({
  accounts,
}: {
  accounts: FederationAccount[];
}) {
  const t = useTranslations("Club");
  const [shown, setShown] = useState<Record<string, boolean>>({});

  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("federationsEmpty")}</p>;
  }

  return (
    <div className="grid gap-4">
      {accounts.map((account) => {
        const isShown = shown[account.id] ?? false;
        return (
          <Card key={account.id} className="px-(--card-spacing)">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-medium">{account.name}</h3>
              <a
                href={account.url}
                target="_blank"
                rel="noreferrer noopener"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                {t("federationOpen")}
                <ExternalLinkIcon className="size-3.5" />
              </a>
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
              {account.password ? (
                <div className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-sm text-muted-foreground">
                    {t("federationPasswordLabel")}
                  </span>
                  <span className="flex-1 truncate font-mono text-sm">
                    {isShown ? account.password : "••••••••••"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={
                      isShown ? t("federationHidePassword") : t("federationShowPassword")
                    }
                    onClick={() =>
                      setShown((prev) => ({ ...prev, [account.id]: !isShown }))
                    }
                  >
                    {isShown ? (
                      <EyeOffIcon className="size-3.5" />
                    ) : (
                      <EyeIcon className="size-3.5" />
                    )}
                  </Button>
                  <CopyButton
                    value={account.password}
                    label={`${t("federationPasswordLabel")}: copiar`}
                  />
                </div>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
