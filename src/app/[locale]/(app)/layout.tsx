import { getTranslations } from "next-intl/server";

import { AppSidebar } from "@/components/app-sidebar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { requireUser } from "@/lib/auth";
import { getFederationAccounts } from "@/lib/club";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const t = await getTranslations("AppLayout");
  const canManageClub = user.role === "admin" || user.role === "staff";
  const federations = canManageClub
    ? (await getFederationAccounts()).map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
      }))
    : [];

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ email: user.email, role: user.role }}
        federations={federations}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">
            {t("headerTitle")}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <LocaleSwitcher persist />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
