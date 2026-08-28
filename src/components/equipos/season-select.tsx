"use client";

import { SectionPlaceholder } from "@/components/section-placeholder";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";

type Season = {
  id: string;
  name: string;
  isCurrent: boolean;
};

export function SeasonSelect({
  seasons,
  selectedId,
}: {
  seasons: Season[];
  selectedId: string;
}) {
  const t = useTranslations("Equipos");
  const tSeason = useTranslations("Temporadas");
  const router = useRouter();
  const pathname = usePathname();

  if (seasons.length === 0) {
    return <SectionPlaceholder size="compact" title={t("noSeasons")} />;
  }

  return (
    <Select
      value={selectedId}
      onValueChange={(value) => router.push(`${pathname}?season=${value}`)}
    >
      <SelectTrigger aria-label={tSeason("seasonLabel")}>
        <SelectValue>
          {(value: string) => {
            const season = seasons.find((s) => s.id === value);
            if (!season) return "";
            return `${season.name}${season.isCurrent ? ` · ${tSeason("currentBadge")}` : ""}`;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {seasons.map((season) => (
          <SelectItem key={season.id} value={season.id}>
            {season.name}
            {season.isCurrent ? ` · ${tSeason("currentBadge")}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
