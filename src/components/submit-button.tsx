"use client";

import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

type SubmitButtonProps = React.ComponentProps<typeof Button>;

/**
 * Botón de envío que muestra un spinner mientras su <form> ejecuta la Server
 * Action (vía useFormStatus, así que debe ir dentro del <form>). El `disabled`
 * que le pases se combina con el estado de carga, no lo sustituye.
 */
export function SubmitButton({
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
      {children}
    </Button>
  );
}
