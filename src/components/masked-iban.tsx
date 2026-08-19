"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/** Oculta todo salvo los últimos 4 caracteres, agrupados de 4 en 4 como en
 * los placeholders de IBAN ya usados en los formularios públicos. */
function maskIban(value: string): string {
  const clean = value.replace(/\s+/g, "");
  const masked = clean.length > 4 ? "•".repeat(clean.length - 4) + clean.slice(-4) : clean;
  return (masked.match(/.{1,4}/g) ?? [masked]).join(" ");
}

/**
 * IBAN de solo lectura, oculto salvo los últimos 4 caracteres, con botón para
 * revelarlo temporalmente. Úsalo en cualquier vista de solo lectura (ficha,
 * diffs de `MatchSelect`) — la página RGPD lo muestra completo a propósito
 * (es el ejercicio del derecho de acceso de la propia persona), así que no
 * debe pasar por aquí.
 */
export function MaskedIbanText({ value }: { value: string }) {
  const t = useTranslations("Inscripciones");
  const [revealed, setRevealed] = useState(false);

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm">
      {revealed ? value : maskIban(value)}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-5 text-muted-foreground print:hidden"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? t("hideIban") : t("revealIban")}
      >
        {revealed ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
      </Button>
    </span>
  );
}

/** Igual que un `Input` de IBAN, pero oculto por defecto (tipo password) con
 * botón para revelarlo mientras se edita. */
export function MaskedIbanInput({
  id,
  name,
  defaultValue,
  placeholder,
  required,
  "aria-invalid": ariaInvalid,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  "aria-invalid"?: boolean;
}) {
  const t = useTranslations("Inscripciones");
  const [revealed, setRevealed] = useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        name={name}
        type={revealed ? "text" : "password"}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        aria-invalid={ariaInvalid}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={revealed ? t("hideIban") : t("revealIban")}
          onClick={() => setRevealed((r) => !r)}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
