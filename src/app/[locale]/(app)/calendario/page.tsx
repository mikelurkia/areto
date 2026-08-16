import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SectionPlaceholder } from "@/components/section-placeholder";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("calendario") };
}

export default async function CalendarioPage() {
  const t = await getTranslations("Calendario");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <SectionPlaceholder
        icon={CalendarDays}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        actionLabel={t("action")}
      />
    </div>
  );
}
