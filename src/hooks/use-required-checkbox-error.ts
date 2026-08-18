import { useEffect, useRef, useState } from "react";

/** Escucha el evento nativo `invalid` de un checkbox `required` para sustituir
 * el tooltip del navegador por un mensaje de error propio. */
export function useRequiredCheckboxError() {
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    function handleInvalid(event: Event) {
      event.preventDefault();
      setError(true);
    }
    input.addEventListener("invalid", handleInvalid);
    return () => input.removeEventListener("invalid", handleInvalid);
  }, []);

  return { inputRef, error, clear: () => setError(false) };
}
