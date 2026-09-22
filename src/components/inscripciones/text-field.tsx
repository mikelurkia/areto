import type { InputHTMLAttributes } from "react";

import { Req } from "@/components/inscripciones/required-asterisk";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Campo de texto simple con el molde repetido en los formularios de
 * inscripción: `Field` + `FieldLabel` (con `Req` si es obligatorio) +
 * `Input` no controlado + `aria-invalid`/`aria-describedby` + `FieldError`.
 *
 * No cubre campos con lógica propia (fecha, IBAN autoformateado, selects,
 * checkboxes, fotos): esos siguen escritos a mano donde ya estaban.
 */
export function TextField({
  id,
  name,
  label,
  type = "text",
  inputMode,
  required,
  placeholder,
  defaultValue,
  error,
  errorId,
  showError = true,
}: {
  id: string;
  name: string;
  label: React.ReactNode;
  type?: "text" | "tel" | "email";
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  /** Id del mensaje de error, cuando no coincide con `${id}-error` (p. ej. un
   * error compartido entre dos campos, como nombre/apellidos del tutor). */
  errorId?: string;
  /** Si es `false`, no pinta su propio `FieldError` aunque haya `error`
   * (para el caso de dos campos que comparten un único mensaje). */
  showError?: boolean;
}) {
  const resolvedErrorId = errorId ?? `${id}-error`;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? <Req /> : null}
      </FieldLabel>
      <Input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? resolvedErrorId : undefined}
      />
      {showError && error ? <FieldError id={resolvedErrorId}>{error}</FieldError> : null}
    </Field>
  );
}
