"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Muestra un toast de éxito cada vez que una Server Action (useActionState) devuelve un mensaje. */
export function useActionToast(message: string | undefined) {
  useEffect(() => {
    if (message) toast.success(message);
  }, [message]);
}
