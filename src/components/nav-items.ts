"use client";

import {
  Building2,
  CalendarDays,
  ClipboardCheckIcon,
  ClipboardList,
  HandshakeIcon,
  IdCard,
  LayoutDashboard,
  Megaphone,
  Shirt,
  ShieldUser,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { Permission } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** Para las secciones cuyo enlace no es el prefijo de la sección. */
  match?: string;
  /** Sección anunciada pero todavía sin pantalla. */
  disabled?: boolean;
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
    { title: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    ...(can("personas.view")
      ? [{ title: t("personas"), href: "/personas", icon: Users }]
      : []),
    ...(can("socios.view")
      ? [{ title: t("socios"), href: "/socios", icon: IdCard }]
      : []),
    ...(can("inscripciones.view")
      ? [
          {
            title: t("inscripciones"),
            href: "/inscripciones",
            icon: ClipboardCheckIcon,
          },
        ]
      : []),
    ...(can("personas.medical.view")
      ? [{ title: t("medico"), href: "/medico", icon: Stethoscope }]
      : []),
    ...(can("temporadas.view")
      ? [{ title: t("temporada"), href: "/temporadas", icon: ClipboardList }]
      : []),
    ...(can("equipos.view")
      ? [{ title: t("equipos"), href: "/equipos", icon: Shirt }]
      : []),
    ...(can("calendario.view")
      ? [{ title: t("calendario"), href: "/calendario", icon: CalendarDays }]
      : []),
    ...(can("patrocinadores.view")
      ? [
          {
            title: t("patrocinadores"),
            href: "/patrocinadores",
            icon: HandshakeIcon,
          },
        ]
      : []),
    { title: t("cuotas"), href: "/cuotas", icon: Wallet, disabled: true },
    { title: t("avisos"), href: "/avisos", icon: Megaphone, disabled: true },
    ...(can("club.view")
      ? [{ title: t("club"), href: "/club", icon: Building2 }]
      : []),
    ...(can("usuarios.manage") || can("roles.manage")
      ? [
          {
            title: t("administracion"),
            href: "/administracion/usuarios",
            match: "/administracion",
            icon: ShieldUser,
          },
        ]
      : []),
  ];
}
