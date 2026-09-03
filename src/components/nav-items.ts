"use client";

import {
  Building2Icon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  HandshakeIcon,
  IdCardIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  ShirtIcon,
  ShieldUserIcon,
  StethoscopeIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { Permission } from "@/lib/permissions";

export type NavGroup = "personas" | "deportivo" | "economico" | "club";

export type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboardIcon;
  /** Para las secciones cuyo enlace no es el prefijo de la sección. */
  match?: string;
  /** Sección anunciada pero todavía sin pantalla. */
  disabled?: boolean;
  /** Bloque temático del menú lateral; sin valor, el item va suelto (p. ej. "Panel"). */
  group?: NavGroup;
};

/**
 * Secciones de la aplicación visibles para unos permisos dados.
 *
 * Vive aparte del sidebar porque la paleta de comandos ofrece exactamente las
 * mismas: teniéndolo en un solo sitio, no hay forma de que una sección aparezca
 * en un sitio y no en el otro, ni de que el filtrado por permisos se relaje en
 * uno de los dos.
 */
export function useNavItems(permissions: readonly Permission[]): NavItem[] {
  const t = useTranslations("Nav");
  const can = (permission: Permission) => permissions.includes(permission);

  return [
    { title: t("dashboard"), href: "/dashboard", icon: LayoutDashboardIcon },
    ...(can("personas.view")
      ? [
          {
            title: t("personas"),
            href: "/personas",
            icon: UsersIcon,
            group: "personas" as const,
          },
        ]
      : []),
    ...(can("socios.view")
      ? [
          {
            title: t("socios"),
            href: "/socios",
            icon: IdCardIcon,
            group: "personas" as const,
          },
        ]
      : []),
    ...(can("inscripciones.view")
      ? [
          {
            title: t("inscripciones"),
            href: "/inscripciones",
            icon: ClipboardCheckIcon,
            group: "personas" as const,
          },
        ]
      : []),
    ...(can("personas.medical.view")
      ? [
          {
            title: t("medico"),
            href: "/medico",
            icon: StethoscopeIcon,
            group: "personas" as const,
          },
        ]
      : []),
    ...(can("temporadas.view")
      ? [
          {
            title: t("temporada"),
            href: "/temporadas",
            icon: ClipboardListIcon,
            group: "deportivo" as const,
          },
        ]
      : []),
    ...(can("equipos.view")
      ? [
          {
            title: t("equipos"),
            href: "/equipos",
            icon: ShirtIcon,
            group: "deportivo" as const,
          },
        ]
      : []),
    ...(can("calendario.view")
      ? [
          {
            title: t("calendario"),
            href: "/calendario",
            icon: CalendarDaysIcon,
            group: "deportivo" as const,
          },
        ]
      : []),
    ...(can("economia.official.view") || can("economia.internal.view")
      ? [
          {
            title: t("economia"),
            href: "/economia",
            icon: LandmarkIcon,
            group: "economico" as const,
          },
        ]
      : []),
    ...(can("patrocinadores.view")
      ? [
          {
            title: t("patrocinadores"),
            href: "/patrocinadores",
            icon: HandshakeIcon,
            group: "economico" as const,
          },
        ]
      : []),
    ...(can("cuotas.view")
      ? [
          {
            title: t("cuotas"),
            href: "/cuotas",
            icon: WalletIcon,
            group: "economico" as const,
          },
        ]
      : []),
    ...(can("club.view")
      ? [
          {
            title: t("club"),
            href: "/club",
            icon: Building2Icon,
            group: "club" as const,
          },
        ]
      : []),
    ...(can("sugerencias.view")
      ? [
          {
            title: t("sugerencias"),
            href: "/sugerencias",
            icon: LightbulbIcon,
            group: "club" as const,
          },
        ]
      : []),
    ...(can("usuarios.manage") || can("roles.manage")
      ? [
          {
            title: t("administracion"),
            href: "/administracion/usuarios",
            match: "/administracion",
            icon: ShieldUserIcon,
            group: "club" as const,
          },
        ]
      : []),
  ];
}
