"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";

import { formatIbanInput } from "@/lib/iban";

/**
 * Campo de IBAN controlado que se autoformatea mientras se teclea
 * ("XXXX XXXX XXXX XX XXXXXXXXXX"), conservando la posición del cursor tras
 * cada pulsación (si no se corrige, insertar un espacio delante del cursor lo
 * empujaría siempre al final del campo).
 *
 * Nota sobre el falso positivo `react-hooks/refs` de eslint-plugin-react-hooks
 * (facebook/react#34954, #34775): marca cualquier acceso a una propiedad de
 * este objeto devuelto (`iban.value`, `iban.onChange`...) como "acceso a ref
 * durante el render", aunque ninguna lo sea, solo por convivir con un ref en
 * el mismo objeto. Usa siempre el resultado con spread en el consumidor
 * (`<Input {...iban} .../>`) en vez de propiedades sueltas — así se evita.
 */
export function useIbanField(initialValue: string) {
  const [value, setValue] = useState(() => formatIbanInput(initialValue));
  const node = useRef<HTMLInputElement | null>(null);
  const pendingCursor = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingCursor.current !== null && node.current) {
      node.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [value]);

  const inputRef = useCallback((el: HTMLInputElement | null) => {
    node.current = el;
  }, []);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const prevLength = e.target.value.length;
    const cursor = e.target.selectionStart ?? prevLength;
    const formatted = formatIbanInput(e.target.value);
    pendingCursor.current = Math.max(0, cursor + (formatted.length - prevLength));
    setValue(formatted);
  }

  return { value, onChange, ref: inputRef };
}
