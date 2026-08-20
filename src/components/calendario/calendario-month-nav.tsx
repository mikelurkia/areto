import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { addMonthsToMonthKey, parseMonthKey } from "@/lib/calendar-grid";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function buildHref(monthKey: string, team: string | undefined) {
  const params = new URLSearchParams();
  if (team) params.set("team", team);
  params.set("view", "month");
  params.set("month", monthKey);
  return `/calendario?${params.toString()}`;
}

export async function CalendarioMonthNav({
  monthKey,
  team,
  locale,
}: {
  monthKey: string;
  team?: string;
  locale: string;
}) {
  const t = await getTranslations("Calendario");
  const monthDate = parseMonthKey(monthKey, new Date());
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    monthDate,
  );

  return (
    <div className="flex items-center gap-2">
      <Link
        href={buildHref(addMonthsToMonthKey(monthKey, -1), team)}
        aria-label={t("monthPrevAriaLabel")}
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
      >
        <ChevronLeftIcon />
      </Link>
      <span className="min-w-40 text-center text-sm font-medium capitalize">{monthLabel}</span>
      <Link
        href={buildHref(addMonthsToMonthKey(monthKey, 1), team)}
        aria-label={t("monthNextAriaLabel")}
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
      >
        <ChevronRightIcon />
      </Link>
    </div>
  );
}
