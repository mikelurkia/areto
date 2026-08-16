import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("authError") };
}

export default async function AuthCodeErrorPage() {
  const t = await getTranslations("AuthCodeError");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="max-w-md text-muted-foreground">{t("description")}</p>
      <Button render={<Link href="/login" />} nativeButton={false}>
        {t("back")}
      </Button>
    </div>
  );
}
