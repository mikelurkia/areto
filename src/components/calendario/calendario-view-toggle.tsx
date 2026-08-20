import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function buildHref(view: "list" | "month", team: string | undefined, monthKey: string) {
  const params = new URLSearchParams();
  if (team) params.set("team", team);
  params.set("view", view);
  if (view === "month") params.set("month", monthKey);
  return `/calendario?${params.toString()}`;
}

export async function CalendarioViewToggle({
  view,
  team,
  monthKey,
}: {
  view: "list" | "month";
  team?: string;
  monthKey: string;
}) {
  const t = await getTranslations("Calendario");

  return (
    <div className="inline-flex gap-0.5 rounded-lg border border-border p-0.5 print:hidden">
      <Link
        href={buildHref("list", team, monthKey)}
        className={cn(
          buttonVariants({ variant: view === "list" ? "secondary" : "ghost", size: "sm" }),
        )}
      >
        {t("viewList")}
      </Link>
      <Link
        href={buildHref("month", team, monthKey)}
        className={cn(
          buttonVariants({ variant: view === "month" ? "secondary" : "ghost", size: "sm" }),
        )}
      >
        {t("viewMonth")}
      </Link>
    </div>
  );
}
