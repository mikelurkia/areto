"use client";

import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

type SubmitIconButtonProps = Omit<React.ComponentProps<typeof Button>, "type"> & {
  /** Texto para lectores de pantalla; el botón solo muestra el icono. */
  label: string;
};

/**
 * Botón de envío de una acción en línea dentro de una tabla o lista (marcar
 * cobrado, emitir factura, renovar, borrar nota). A diferencia de
 * `SubmitButton`, sustituye el icono por el spinner en lugar de añadirlo: así
 * el botón no cambia de tamaño y la fila no se descoloca.
 *
 * Debe ir dentro del `<form>` cuya acción ejecuta (usa `useFormStatus`).
 */
export function SubmitIconButton({
  children,
  label,
  disabled,
  size = "icon-sm",
  variant = "ghost",
  ...props
}: SubmitIconButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size={size}
      variant={variant}
      disabled={disabled || pending}
      {...props}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : children}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
