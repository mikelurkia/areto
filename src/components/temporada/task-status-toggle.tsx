"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { setSeasonTaskStatus } from "@/app/[locale]/(app)/temporadas/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SeasonTaskStatus } from "@/lib/season-tasks";

const STATUSES: SeasonTaskStatus[] = ["pending", "in_progress", "done"];

/**
 * Selector en línea del estado de un trámite (checklist). Al cambiar, despacha
 * la server action con un FormData construido a mano (evita depender del DOM del
 * formulario). Optimista: el valor mostrado cambia al instante.
 */
export function TaskStatusToggle({
  id,
  status,
  disabled,
}: {
  id: string;
  status: SeasonTaskStatus;
  disabled?: boolean;
}) {
  const t = useTranslations("Temporadas");
  const [, action] = useActionState(setSeasonTaskStatus, {});
  const [, startTransition] = useTransition();
  const [value, setValue] = useState<SeasonTaskStatus>(status);
  const [prevStatus, setPrevStatus] = useState<SeasonTaskStatus>(status);

  // Reconcilia en render si el valor del servidor cambia por revalidación
  // (patrón de "estado derivado de props" sin useEffect).
  if (status !== prevStatus) {
    setPrevStatus(status);
    setValue(status);
  }

  function onChange(next: SeasonTaskStatus) {
    setValue(next);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("status", next);
    startTransition(() => action(formData));
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as SeasonTaskStatus)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" aria-label={t("statusLabel")} className="w-36">
        <SelectValue>{(v: string) => t(`status.${v}`)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {t(`status.${s}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
