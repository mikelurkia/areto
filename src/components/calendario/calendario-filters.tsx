"use client";

import { useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TeamOption = { id: string; name: string };

export function CalendarioFilters({
  teams,
  selectedTeamId,
  from,
  to,
}: {
  teams: TeamOption[];
  selectedTeamId: string;
  from: string;
  to: string;
}) {
  const t = useTranslations("Calendario");
  const router = useRouter();
  const pathname = usePathname();

  function updateParam(key: string, value: string) {
    // Se lee de `window.location` y no de `usePathname`/hooks para no
    // pisar los demás filtros al cambiar solo uno.
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="calendario-filter-team"
          className="text-xs text-muted-foreground"
        >
          {t("filterTeamLabel")}
        </label>
        <Select
          value={selectedTeamId || "all"}
          onValueChange={(value) => updateParam("team", value === "all" || !value ? "" : value)}
        >
          <SelectTrigger id="calendario-filter-team" className="w-48">
            <SelectValue>
              {(value: string) =>
                value === "all"
                  ? t("filterTeamAll")
                  : (teams.find((team) => team.id === value)?.name ?? "")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterTeamAll")}</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="calendario-filter-from"
          className="text-xs text-muted-foreground"
        >
          {t("filterFromLabel")}
        </label>
        <Input
          id="calendario-filter-from"
          type="date"
          className="w-40"
          defaultValue={from}
          onChange={(e) => updateParam("from", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="calendario-filter-to"
          className="text-xs text-muted-foreground"
        >
          {t("filterToLabel")}
        </label>
        <Input
          id="calendario-filter-to"
          type="date"
          className="w-40"
          defaultValue={to}
          onChange={(e) => updateParam("to", e.target.value)}
        />
      </div>
    </div>
  );
}
