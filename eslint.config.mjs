import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Cerrojo de la capa de composición de UI (etapa B9 de la armonización).
 *
 * Las cuatro reglas de abajo no son estilo: cada una cierra una deuda que ya se
 * pagó una vez. La tabla de "si necesitas X, usa Y" está en `CLAUDE.md`; aquí
 * están solo las cuatro cosas que un linter sí puede vigilar.
 *
 * Entran directamente como `error` porque el árbol está limpio: cero
 * violaciones al mergear B9. Si alguna se pone insoportable, se discute la
 * regla — no se añade un `eslint-disable` suelto.
 */

/** Paletas crudas de Tailwind. Los tokens semánticos viven en `globals.css`. */
const RAW_COLOR =
  "(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";

/** Utilidades de color a las que se les puede colgar una paleta cruda. */
const COLOR_UTILITY = "(bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|divide|shadow|accent|caret|placeholder)";

/** Clases dentro de un mismo `className`, entre dos utilidades cualesquiera. */
const CLASSES_BETWEEN = "[a-z0-9:./ -]*";

const noRawPalette = {
  selector: `JSXAttribute[name.name='className'] Literal[value=/\\b${COLOR_UTILITY}-${RAW_COLOR}-[0-9]{2,3}\\b/]`,
  message:
    "Color crudo de Tailwind: usa un token semántico (primary, muted, destructive, success, warning…). Si el estado no tiene token, añádelo en globals.css y mapéalo en status-tone.ts.",
};

const noManualDarkColor = {
  selector: `JSXAttribute[name.name='className'] Literal[value=/dark:${COLOR_UTILITY}-(${RAW_COLOR}-[0-9]{2,3}|white|black)\\b/]`,
  message:
    "Variante `dark:` con color a mano: un token semántico ya cambia solo entre claro y oscuro. Reserva `dark:` para ajustes de opacidad sobre un token.",
};

const noManualPageHeader = {
  selector: `JSXAttribute[name.name='className'] Literal[value=/text-(xl|2xl)${CLASSES_BETWEEN}font-semibold|font-semibold${CLASSES_BETWEEN}text-(xl|2xl)/]`,
  message:
    "Cabecera de página a mano: usa `PageHeader` (`size=\"compact\"` para sub-páginas y fichas) o `SectionHeading` para un rótulo de sección.",
};

const noBareLucideIcon = {
  selector:
    "ImportDeclaration[source.value='lucide-react'] > ImportSpecifier[imported.name!=/Icon$/][imported.name!=/^Lucide/]",
  message:
    "Importa el alias con sufijo `Icon` de lucide-react (`GlobeIcon`, no `Globe`): así el icono no colisiona con un componente del mismo nombre y se lee como icono en el JSX.",
};

/*
 * Pantallas donde `text-2xl font-semibold` no es una cabecera de página sino el
 * título de una tarjeta centrada (login, errores de acceso) o de un documento
 * legal. `PageHeader` es una fila con acciones a la derecha: no encaja, y
 * forzarlo sería peor que la clase a mano. Las tres reglas de color sí aplican.
 */
const CARD_TITLE_SCREENS = [
  "src/app/**/acceso-no-autorizado/page.tsx",
  "src/app/**/acceso-revocado/page.tsx",
  "src/app/**/contrasena/page.tsx",
  "src/app/**/auth-code-error/page.tsx",
  "src/components/inscripciones/legal-info-page.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    name: "areto/composicion-ui",
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        noRawPalette,
        noManualDarkColor,
        noManualPageHeader,
        noBareLucideIcon,
      ],
    },
  },
  {
    name: "areto/composicion-ui-titulos-de-tarjeta",
    files: CARD_TITLE_SCREENS,
    rules: {
      "no-restricted-syntax": [
        "error",
        noRawPalette,
        noManualDarkColor,
        noBareLucideIcon,
      ],
    },
  },
]);

export default eslintConfig;
