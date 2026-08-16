import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("login") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";
  const t = await getTranslations("Login");

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Link href="/" className="flex items-center gap-2 self-center">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            A
          </div>
          <span className="text-lg font-semibold">Areto</span>
        </Link>

        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <LoginForm next={safeNext} />
      </div>
    </div>
  );
}
