import { Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SectionPlaceholder } from "@/components/section-placeholder";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("cuotas") };
}

export default async function CuotasPage() {
  const t = await getTranslations("Cuotas");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <SectionPlaceholder
        icon={Wallet}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        actionLabel={t("action")}
      />
    </div>
  );
}
