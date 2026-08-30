"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronsUpDownIcon, GlobeIcon, LogOutIcon, SettingsIcon } from "lucide-react";

import { logout } from "@/app/[locale]/(auth)/actions";
import { Link, usePathname } from "@/i18n/navigation";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { isSystemRoleKey, type Permission } from "@/lib/permissions";
import { useNavItems, type NavGroup, type NavItem } from "@/components/nav-items";
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

type SidebarUser = {
  email: string;
  /** Nombre del usuario; `null` mientras no lo haya rellenado. */
  fullName: string | null;
  /**
   * Roles de acceso, ya ordenados. De cada uno: la `key` (si es de sistema, la
   * etiqueta se traduce por ella) y el `name` guardado (para los que crea el
   * club, que no tienen traducción).
   */
  roles: { key: string; name: string }[];
  /** Array y no `Set`: cruza el límite servidor→cliente sin sorpresas. */
  permissions: Permission[];
};

type AppSidebarBodyProps = {
  user: SidebarUser;
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
  const t = useTranslations("Landing");
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
          <div className="leading-tight">
            <span className="block font-semibold">{t("brand")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("brandSubtitle")}
            </span>
          </div>
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

/** Orden y etiqueta de cada bloque temático del menú principal. */
const NAV_GROUPS: { group: NavGroup; labelKey: "groupPersonas" | "groupDeportivo" | "groupEconomico" | "groupClub" }[] = [
  { group: "personas", labelKey: "groupPersonas" },
  { group: "deportivo", labelKey: "groupDeportivo" },
  { group: "economico", labelKey: "groupEconomico" },
  { group: "club", labelKey: "groupClub" },
];

function federationInfo(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const key = Object.keys(FEDERATION_INFO).find((h) => host.endsWith(h));
    return key ? FEDERATION_INFO[key] : null;
  } catch {
    return null;
  }
}

/**
 * Iniciales para el avatar: del nombre (dos palabras como mucho) y, si no hay
 * nombre, del correo.
 */
function initialsOf(fullName: string | null, email: string) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return email.slice(0, 2).toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Contenido y pie del sidebar: navegación según el rol, accesos federativos y chip de usuario. */
export function AppSidebarBody({ user, federations = [] }: AppSidebarBodyProps) {
  const t = useTranslations("Sidebar");
  const tNav = useTranslations("Nav");
  const pathname = usePathname();
  // El correo solo hace de recambio: se muestra el nombre siempre que el
  // usuario lo tenga puesto.
  const displayName = user.fullName?.trim() || user.email;
  const initials = initialsOf(user.fullName, user.email);

  // Los roles de fábrica se traducen por su clave; los que crea el club se
  // muestran con el nombre que le hayan puesto. No se traducen, y es
  // deliberado: son datos del club, no cadenas de la aplicación.
  const roleLabels = user.roles.map((r) =>
    isSystemRoleKey(r.key) ? t(`roles.${r.key}` as "roles.admin") : r.name,
  );

  // El chip del pie es estrecho y va con `truncate`: encadenar ahí seis roles
  // no comunica nada, así que solo el primero y un contador. El desplegable,
  // que tiene sitio, los lista enteros.
  const roleSummary =
    roleLabels.length > 1
      ? `${roleLabels[0]} ${t("moreRoles", { count: roleLabels.length - 1 })}`
      : (roleLabels[0] ?? "");
  const roleLabel = roleLabels.join(" · ");

  const nav = useNavItems(user.permissions);
  const looseItems = nav.filter((item) => !item.group);
  const itemsByGroup = new Map<NavGroup, NavItem[]>();
  for (const item of nav) {
    if (!item.group) continue;
    itemsByGroup.set(item.group, [...(itemsByGroup.get(item.group) ?? []), item]);
  }

  const renderNavItem = (item: NavItem) => {
    const base = item.match ?? item.href;
    const active = pathname === base || pathname.startsWith(`${base}/`);
    return (
      <SidebarMenuItem key={item.href}>
        {item.disabled ? (
          <SidebarMenuButton disabled>
            <item.icon />
            <span>{item.title}</span>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton
            render={<HoverPrefetchLink href={item.href} />}
            isActive={active}
          >
            <item.icon />
            <span>{item.title}</span>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>{looseItems.map(renderNavItem)}</SidebarMenu>
        </SidebarGroup>

        {NAV_GROUPS.map(({ group, labelKey }) => {
          const items = itemsByGroup.get(group);
          if (!items || items.length === 0) return null;
          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{t(labelKey)}</SidebarGroupLabel>
              <SidebarMenu>{items.map(renderNavItem)}</SidebarMenu>
            </SidebarGroup>
          );
        })}

        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <HoverPrefetchLink href="/" target="_blank" rel="noreferrer noopener" />
                }
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
                        // sobre fondo claro), así ambos se ven bien. `--secondary`
                        // es el único token oscuro en los dos temas.
                        <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded bg-secondary">
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
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {roleSummary}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56"
                side="top"
                align="end"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="grid text-sm">
                      <span className="truncate font-medium">{displayName}</span>
                      {user.fullName ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      ) : null}
                      <span
                        className="truncate text-xs text-muted-foreground"
                        title={roleLabel}
                      >
                        {roleLabel}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link href="/ajustes" />}>
                    <SettingsIcon />
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
                      <LogOutIcon />
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
