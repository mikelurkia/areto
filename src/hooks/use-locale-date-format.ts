"use client";

import { useMemo } from "react";

/** Formatea fechas `YYYY-MM-DD` con el `Intl.DateTimeFormat` del locale activo. */
export function useLocaleDateFormat(locale: string) {
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  return (value: string) => dateFmt.format(new Date(`${value}T00:00:00`));
}
