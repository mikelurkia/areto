"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Building2,
  CalendarDays,
  ChevronsUpDown,
  ClipboardCheckIcon,
  ClipboardList,
  GlobeIcon,
  HandshakeIcon,
  IdCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  Shirt,
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

type Federation = { id: string; name: string; url: string };

type AppSidebarBodyProps = {
  user: { email: string; role: UserRole };
  federations?: Federation[];
};

/**
 * Marco del sidebar: se renderiza sin esperar a nada.
 *
 * `Sidebar` elige entre dos árboles distintos —un `Sheet` en móvil, un `<div>`
 * fijo en escritorio— a partir de `useIsMobile`, que solo puede saber el ancho
 * en cliente. Por eso el marco tiene que hidratar en la misma pasada que
 * `SidebarProvider`, que es quien publica ese valor: si quedara dentro de un
 * <Suspense>, hidrataría más tarde, cuando el proveedor ya hubiera cambiado a
 * móvil, y el árbol elegido no coincidiría con el HTML del servidor.
 *
 * Lo que necesita la sesión va en `children`, envuelto en su propio <Suspense>.
 */
export function AppSidebar({ children }: { children: React.ReactNode }) {
  return (
    <Sidebar>
      <SidebarHeader>
        {/* La marca es estática: se pinta ya, sin esperar a nada. */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 object-contain"
            priority
          />
          <span className="font-semibold">Areto</span>
        </div>
      </SidebarHeader>
      {children}
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * Logos oficiales (versión blanca, para fondo oscuro) descargados a /public.
 * Se resuelven por el host de la URL de la federación, para no depender del
 * nombre exacto de la fila.
 */
const FEDERATION_INFO: Record<
  string,
  { src: string; width: number; height: number; titleKey: string }
> = {
  "gipuzkoafutbola.eus": {
    src: "/federations/gipuzkoana.png",
    width: 450,
    height: 554,
    titleKey: "federationGipuzkoana",
  },
  "euskadifutbol.eus": {
    src: "/federations/vasca.png",
    width: 512,
    height: 512,
    titleKey: "federationVasca",
  },
};

function federationInfo(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const key = Object.keys(FEDERATION_INFO).find((h) => host.endsWith(h));
    return key ? FEDERATION_INFO[key] : null;
  } catch {
    return null;
  }
}

/** Contenido y pie del sidebar: navegación según el rol, accesos federativos y chip de usuario. */
export function AppSidebarBody({ user, federations = [] }: AppSidebarBodyProps) {
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

  const canManageClub = user.role === "admin" || user.role === "staff";
  // El calendario es de gestión interna (peticiones de horario), no algo que
  // un socio/jugador consulte: mismo criterio que canManageClub, pero
  // incluyendo también a los entrenadores.
  const canViewCalendario = user.role !== "member";

  const nav = [
    { title: tNav("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { title: tNav("personas"), href: "/personas", icon: Users },
    ...(canManageClub
      ? [
          { title: tNav("socios"), href: "/socios", icon: IdCard },
          { title: tNav("inscripciones"), href: "/inscripciones", icon: ClipboardCheckIcon },
        ]
      : []),
    { title: tNav("temporada"), href: "/temporadas", icon: ClipboardList },
    { title: tNav("equipos"), href: "/equipos", icon: Shirt },
    ...(canViewCalendario
      ? [{ title: tNav("calendario"), href: "/calendario", icon: CalendarDays }]
      : []),
    { title: tNav("patrocinadores"), href: "/patrocinadores", icon: HandshakeIcon },
    { title: tNav("cuotas"), href: "/cuotas", icon: Wallet, disabled: true },
    { title: tNav("avisos"), href: "/avisos", icon: Megaphone, disabled: true },
    ...(canManageClub
      ? [{ title: tNav("club"), href: "/club", icon: Building2 }]
      : []),
  ];

  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("groupLabel")}</SidebarGroupLabel>
          <SidebarMenu>
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <SidebarMenuItem key={item.href}>
                  {item.disabled ? (
                    <SidebarMenuButton disabled>
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/" target="_blank" rel="noreferrer noopener" />}
              >
                <GlobeIcon />
                <span>{tNav("publicSite")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {federations.length > 0 ? (
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>{tNav("federations")}</SidebarGroupLabel>
            <SidebarMenu>
              {federations.map((federation) => {
                const info = federationInfo(federation.url);
                const title = info ? tNav(info.titleKey) : federation.name;
                return (
                  <SidebarMenuItem key={federation.id}>
                    <SidebarMenuButton
                      tooltip={title}
                      render={
                        <a
                          href={federation.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        />
                      }
                    >
                      {info ? (
                        // Chip oscuro: el logo gipuzkoano es blanco (invisible
                        // sobre fondo claro), así ambos se ven bien.
                        <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-900">
                          <Image
                            src={info.src}
                            alt=""
                            width={info.width}
                            height={info.height}
                            className="size-full object-contain p-px"
                          />
                        </span>
                      ) : null}
                      <span>{title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
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
                  {/*
                    Salida con recarga completa: `logout` solo cierra la sesión y
                    dice a dónde ir, y el navegador va ahí de cero. Así no queda
                    en memoria el estado de las pantallas del usuario anterior,
                    que React conserva montadas entre navegaciones.
                  */}
                  <form
                    action={async () => {
                      const { redirectTo } = await logout();
                      window.location.href = redirectTo;
                    }}
                  >
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
    </>
  );
}
