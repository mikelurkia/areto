"use client";

import { useTranslations } from "next-intl";
import {
  CalendarDays,
  ChevronsUpDown,
  ClipboardList,
  HandshakeIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  ShieldHalf,
  Users,
  Wallet,
} from "lucide-react";

import { logout } from "@/app/[locale]/(auth)/actions";
import { Link, usePathname } from "@/i18n/navigation";
import type { UserRole } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type AppSidebarProps = {
  user: { email: string; role: UserRole };
};

export function AppSidebar({ user }: AppSidebarProps) {
  const t = useTranslations("Sidebar");
  const tNav = useTranslations("Nav");
  const pathname = usePathname();
  const initials = user.email.slice(0, 2).toUpperCase();

  const roleLabels: Record<UserRole, string> = {
    admin: t("roles.admin"),
    staff: t("roles.staff"),
    coach: t("roles.coach"),
    member: t("roles.member"),
  };

  const nav = [
    { title: tNav("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { title: tNav("personas"), href: "/personas", icon: Users },
    { title: tNav("equipos"), href: "/equipos", icon: ShieldHalf },
    { title: tNav("temporada"), href: "/temporadas", icon: ClipboardList },
    { title: tNav("calendario"), href: "/calendario", icon: CalendarDays },
    { title: tNav("patrocinadores"), href: "/patrocinadores", icon: HandshakeIcon },
    { title: tNav("cuotas"), href: "/cuotas", icon: Wallet },
    { title: tNav("avisos"), href: "/avisos", icon: Megaphone },
  ] as const;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            A
          </div>
          <span className="font-semibold">Areto</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("groupLabel")}</SidebarGroupLabel>
          <SidebarMenu>
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={active}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" />}
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.email}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {roleLabels[user.role]}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56"
                side="top"
                align="end"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="grid text-sm">
                      <span className="truncate font-medium">{user.email}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {roleLabels[user.role]}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link href="/ajustes" />}>
                    <Settings />
                    {t("settings")}
                  </DropdownMenuItem>
                  <form action={logout}>
                    <DropdownMenuItem
                      nativeButton
                      render={
                        <button type="submit" className="w-full" />
                      }
                    >
                      <LogOut />
                      {t("logout")}
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
