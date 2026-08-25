import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

type AuthBrandProps = {
  /**
   * Pinta el nombre del club como `h1` en lugar de como texto suelto.
   *
   * Es para el login, la única de las cuatro pantallas sin titular propio:
   * sin esto se quedaría sin ningún encabezado, y quien navega con lector de
   * pantalla se queda sin saber dónde ha aterrizado. Las otras tres ya tienen
   * su `h1` —su mensaje— y aquí no debe haber un segundo.
   */
  asHeading?: boolean;
};

/**
 * Marca del club en las cuatro pantallas de acceso.
 *
 * Es el mismo bloque que el sidebar y la cabecera pública —logo, nombre del
 * club y "Areto Futbol Saila" debajo— y bebe de las mismas cadenas
 * (`Landing.brand` y `Landing.brandSubtitle`), así que el club se cambia en un
 * único sitio. Antes cada pantalla llevaba su propia copia con el nombre del
 * producto escrito a mano.
 */
export async function AuthBrand({ asHeading = false }: AuthBrandProps) {
  const t = await getTranslations("Landing");
  const Name = asHeading ? "h1" : "span";

  return (
    <Link href="/" className="flex items-center gap-2 self-center">
      <Image
        src="/logo.png"
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 object-contain"
        priority
      />
      <div className="leading-tight">
        <Name className="block font-heading font-semibold">{t("brand")}</Name>
        <span className="block text-xs text-muted-foreground">
          {t("brandSubtitle")}
        </span>
      </div>
    </Link>
  );
}
