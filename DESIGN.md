---
name: Areto
description: Gestión de club de fútbol sala — grotesca única Archivo, acento petróleo saturado, forma rectangular
colors:
  petrol-primary:
    light: "oklch(0.4 0.15 195)"
    dark: "oklch(0.78 0.14 195)"
  petrol-accent-soft:
    light: "oklch(0.9 0.035 195)"
    dark: "oklch(0.32 0.05 195)"
  neutral-bg:
    light: "oklch(0.985 0.005 200)"
    dark: "oklch(0.15 0.016 200)"
  neutral-card:
    light: "oklch(0.995 0.004 200)"
    dark: "oklch(0.19 0.018 200)"
  neutral-foreground:
    light: "oklch(0.16 0.02 200)"
    dark: "oklch(0.96 0.008 200)"
  neutral-muted:
    light: "oklch(0.955 0.01 200)"
    dark: "oklch(0.26 0.018 200)"
  neutral-border:
    light: "oklch(0.85 0.015 200)"
    dark: "oklch(1 0 0 / 12%)"
  success:
    light: "oklch(0.55 0.12 145)"
    dark: "oklch(0.74 0.13 145)"
  warning:
    light: "oklch(0.62 0.13 75)"
    dark: "oklch(0.78 0.13 75)"
  destructive:
    light: "oklch(0.58 0.215 25)"
    dark: "oklch(0.7 0.2 25)"
  gold:
    light: "oklch(0.55 0.16 75)"
    dark: "oklch(0.68 0.16 75)"
typography:
  sans:
    fontFamily: "Archivo, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "Archivo, sans-serif"
    fontWeight: 800
    lineHeight: 1.2
rounded:
  sm: "0.225rem"
  md: "0.3rem"
  lg: "0.375rem"
  xl: "0.525rem"
  2xl: "0.675rem"
  3xl: "0.825rem"
  4xl: "0.975rem"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "0.625rem"
  lg: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.petrol-primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.petrol-primary}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-foreground}"
    rounded: "{rounded.lg}"
  badge-default:
    backgroundColor: "{colors.petrol-primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.neutral-foreground}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: Areto

## Overview

**Creative North Star: "El acta con convicción tipográfica"**

Areto es la herramienta de gestión interna de la junta directiva y los
entrenadores de un club de fútbol sala: papeleo federativo, cuotas y
personas, usada a diario y a menudo bajo prisa. El rediseño (segunda tirada,
tras rechazar explícitamente un primer mundo temático de "pizarra de
vestuario" con cinta adhesiva) elimina toda metáfora de objeto físico y toda
decoración: la personalidad viene solo de la tipografía, la paleta y la
forma. Una sola familia — Archivo, una grotesca geométrica con carácter
propio, no Inter/Work Sans genérica — cubre cuerpo (400/500) y titulares/
cifras (700/800), sin segunda tipografía condensada de adorno. El acento es
un azul-petróleo saturado y con convicción, no el azul-gris apenas
distinguible del azul institucional que precedió a este mundo.

El sistema sigue siendo **plano y preciso** (herencia explícita del mundo
anterior: sin sombras a nivel de reposo, superficies delimitadas por un
anillo, densidad de datos por encima del adorno), pero suma una anillo algo
más presente (`ring-foreground/15`, antes `/10`) y controles que hablan todos
en el mismo registro de peso (`font-semibold`, no `font-medium`) para que
botones, badges y pestañas activas sumen convicción tipográfica en vez de
apoyarse en el color solo.

**Key Characteristics:**
- Una sola familia tipográfica (Archivo) para toda la interfaz — sin pareja display/body.
- Acento azul-petróleo saturado (`oklch(0.4 0.15 195)` claro / `oklch(0.78 0.14 195)` oscuro), no un azul-gris institucional apagado.
- Controles interactivos (botones, badges, pestaña activa) en `font-semibold`, nunca `font-medium`.
- Badges rectangulares (`rounded-sm`), nunca píldora.
- Cero sombras a nivel de reposo: el anillo (`ring-1 ring-foreground/15`) delimita las superficies.
- Cabeceras de tabla y de menú en versalitas pequeñas con tracking ancho, apagadas en `text-muted-foreground`.
- Sidebar sin cromo propio: sigue el fondo del tema activo, la personalización vive en el componente, no en la región.

## Colors

Una sola familia de gris fría (hue ~200) recorre fondo, texto y bordes, para que el acento petróleo (hue ~195) suene a la misma paleta y no a un tinte superpuesto sobre un gris neutro genérico.

### Primary
- **Petróleo Saturado** (`oklch(0.4 0.15 195)` claro / `oklch(0.78 0.14 195)` oscuro): color de marca y acción — botones primarios, enlaces, anillo de foco, indicador de pestaña activa, iniciales de `Avatar`, checks de `Select`/`DropdownMenu`/`Combobox`. Con convicción deliberada: no es un azul-gris apenas distinguible del institucional que reemplaza.

### Secondary
- **Ámbar** (`oklch(0.55 0.16 75)` claro / `oklch(0.68 0.16 75)` oscuro, `gold` en el código): tono `highlight` del vocabulario semántico (`lib/status-tone.ts`) — reservado a lo que de verdad destaca, nunca decorativo suelto.

### Neutral
- **Fondo** (`oklch(0.985 0.005 200)` claro / `oklch(0.15 0.016 200)` oscuro): fondo de página, del mismo hue frío que el acento.
- **Tarjeta** (`oklch(0.995 0.004 200)` claro / `oklch(0.19 0.018 200)` oscuro): fondo de `Card`, ligeramente distinto del fondo de página.
- **Texto** (`oklch(0.16 0.02 200)` claro / `oklch(0.96 0.008 200)` oscuro): texto principal.
- **Borde** (`oklch(0.85 0.015 200)` claro / `oklch(1 0 0 / 12%)` oscuro): borde y anillo de `Card`, divisores de tabla.

### Semánticos (estado)
- **Éxito** (`oklch(0.55 0.12 145)`): cobrado, aprobado, vigente.
- **Aviso** (`oklch(0.62 0.13 75)`): pendiente, por vencer.
- **Peligro** (`oklch(0.58 0.215 25)`): rechazado, caducado, error.

### Named Rules
**The Same-Hue Rule.** La escala de grises (fondo, tarjeta, texto, borde) comparte el mismo hue frío (~200) que el acento petróleo (~195), para que todo el sistema suene a una sola paleta en vez de a dos tintes superpuestos.

**The Conviction-Not-Grayscale Rule.** El acento primario es un azul-petróleo saturado, no una versión atenuada casi indistinguible de un azul institucional genérico. La saturación es la decisión, no un descuido.

**The Ring-Not-Shadow Rule.** `Card` y los popovers (`Select`, `DropdownMenu`, `Combobox`) se delimitan con `ring-1 ring-foreground/15`, nunca con `box-shadow` visible en reposo. En impresión el anillo se sustituye por un borde real, porque los navegadores no imprimen sombras ni la mayoría de anillos.

## Typography

**Font (única):** Archivo, peso variable (con `sans-serif` de reserva) — misma variable (`--font-sans`) sirve tanto `font-sans` como `font-heading`; no hay una segunda familia de titulares.

**Character:** Una sola grotesca geométrica con rango de peso amplio (400 a 800) sustituye la pareja anterior de condensada + humanista. La jerarquía se lee por peso y tamaño, no por cambio de familia.

### Hierarchy
- **Título de página** (extrabold 800, `text-3xl`, `font-heading`): `PageHeader` en su tamaño por defecto — un h1 por página de listado o dashboard.
- **Título de página compacto** (semibold, `text-xl`): `PageHeader size="compact"` — fichas y sub-páginas de detalle.
- **Título de tarjeta** (semibold, `text-base`/`text-sm` en `size="sm"`, `font-heading`): `CardTitle`.
- **Cifra destacada** (bold 700, `text-2xl`, `tabular-nums`, `font-heading`): `StatTile` — antes `text-lg`, ahora lee como titular de dato, no como texto corrido.
- **Encabezado de sección** (semibold, `text-xs`, versalitas, tracking ancho): `SectionHeading`, cabeceras de tabla (`TableHead`) y de menú (`SelectLabel`/`DropdownMenuLabel`/`ComboboxLabel`), todo apagado en `text-muted-foreground`.
- **Controles** (semibold, `text-sm`): `Button`, `Badge`, pestaña activa de `Tabs` — antes `font-medium`, ahora en el mismo registro de convicción que los títulos.
- **Cuerpo** (regular/medium, `text-sm`): tablas, descripciones, texto corrido.

### Named Rules
**The One-Voice Rule.** Toda la interfaz usa una sola familia (Archivo); `font-heading` y `font-sans` resuelven a la misma variable. La jerarquía nunca se marca con un cambio de familia, solo de peso y tamaño.

**The Semibold-Controls Rule.** Cualquier control interactivo con texto propio (`Button`, `Badge`, pestaña activa) usa `font-semibold`, nunca `font-medium`. Excepción conocida y deliberada: `SelectTrigger`/`ComboboxTrigger` se dejan en peso por defecto porque muestran un valor de formulario ya elegido, no actúan como botón — fuera de alcance de este pase, no una inconsistencia a corregir sin más contexto.

## Layout

Raíz de página: `flex flex-1 flex-col gap-6`, invariante en toda la app interna. Sidebar de navegación fijo en escritorio (colapsa a `Sheet` en móvil). Tablas envueltas en un contenedor con scroll horizontal propio (`data-slot="table-container"`) — la página nunca hace scroll horizontal. Columnas de tabla con prioridad (`primary`/`secondary`/`tertiary`) que ocultan las de apoyo en pantallas estrechas, pero siempre presentes en impresión vía `data-priority`. Vistas imprimibles reservan una hoja A4 con `PrintableSheet`, padding de 14mm, sin margen de documento por defecto.

## Elevation & Depth

Sistema plano por defecto, heredado y reforzado: no hay vocabulario de sombras para estado de reposo. `Card` y los popovers de overlay (`Select`, `DropdownMenu`, `Combobox`) usan un anillo (`ring-1 ring-foreground/15`, subido desde `/10`) para delimitarse en vez de elevación. `shadow-md`/`shadow-lg` aparece en los popovers junto al anillo como refuerzo de separación del fondo al abrir, no como jerarquía de reposo — se combina siempre con el anillo, nunca lo sustituye.

### Named Rules
**The Flat-By-Default Rule.** Ninguna superficie usa `box-shadow` para indicar jerarquía o estado de reposo. El anillo hace ese trabajo y es lo único que sobrevive a la impresión (sustituido por `border: 1px solid var(--border)`, porque los navegadores no imprimen sombras).

## Shapes

Radios de esquina progresivos pero pequeños en la base (`--radius: 0.375rem`), escalados con `calc()` para `sm`/`md`/`lg`/`xl`/`2xl`/`3xl`/`4xl` — nunca radios arbitrarios sueltos. `Card` y popovers usan `rounded-xl`/`rounded-lg`, botones e inputs `rounded-lg`, `Badge` y `ComboboxChip` **rectangulares** (`rounded-sm`) — la píldora completa del mundo anterior desaparece: ninguna forma del sistema es completamente redonda salvo `Avatar` (circular por convención universal de foto de perfil). Bordes de 1px en todo, salvo el anillo de foco (`ring-3`).

## Components

### Buttons
- **Shape:** `rounded-lg`, altura `h-8` por defecto (`h-7` en `sm`, `h-6` en `xs`).
- **Primary:** fondo `--primary` (petróleo saturado), texto `--primary-foreground`, hover atenuado (`bg-primary/90`).
- **Outline / Ghost / Secondary:** fondo transparente o `--secondary`, mismo radio y altura; `outline` y `ghost` responden en hover/aria-expanded con `border-primary/40` y `bg-muted`.
- **Destructive:** fondo `destructive/10`, texto `destructive` — nunca fondo sólido rojo.
- **Texto:** `font-semibold` (antes `font-medium`) — mismo registro que badges y pestaña activa.
- **Estado activo:** `translate-y-px` al pulsar, sin sombra.

### Chips / Badges
- **Style:** rectangular (`rounded-sm`, no píldora), altura fija `h-5`, texto `text-xs font-semibold` (antes `font-medium`).
- **State:** color por tono semántico compartido (`lib/status-tone.ts`) — nunca un componente elige su propio color.

### Cards / Containers
- **Corner Style:** `rounded-xl`.
- **Background:** `--card`, ligeramente distinto de `--background`.
- **Shadow Strategy:** ninguna en reposo — ver Elevation & Depth. Delimitado por `ring-1 ring-foreground/15` (subido desde `/10`).
- **Densidad:** `size="sm"` reduce el padding interno para KPIs y contextos densos como `StatTile`.

### Inputs / Fields
- **Style:** `rounded-lg`, borde `border-input`, fondo transparente (`bg-input/30` en oscuro), altura `h-8`.
- **Focus:** anillo de 3px (`ring-3 ring-ring/50`) más borde a `--ring` (petróleo).
- **Error:** borde y anillo a `--destructive`.
- **Excepción conocida:** `SelectTrigger`/`ComboboxTrigger` muestran el valor elegido en peso por defecto, no `font-semibold` — se comportan como campo de formulario, no como botón; deliberadamente fuera de alcance en este pase.

### Navigation
- Sidebar shadcn con tokens propios (`--sidebar*`) que en este mundo replican de cerca el fondo/texto del tema activo (claro/oscuro) en vez de un cromo de herramienta fijo — decisión explícita: la personalización vive en los componentes individuales (pestaña activa, `Avatar`, checks de menú), no en regiones enteras del layout con su propio esquema de color; esa alternativa se probó y el usuario la rechazó.
- Ítem activo en `font-semibold`, resaltado con el acento petróleo saturado.

### Tabs
- Indicador de pestaña activa: barra `after:bg-primary` (petróleo saturado), no un tono neutro — la única señal de estado activo además del peso `font-semibold`.

### Select / Combobox / DropdownMenu
- Contenido flotante (`SelectContent`, `DropdownMenuContent`, `ComboboxContent`): `rounded-lg`, `ring-1 ring-foreground/15` + `shadow-md`.
- Checks de item seleccionado (`SelectItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `ComboboxItem`): `CheckIcon` en `text-primary` (acento saturado), no en color neutro/apagado.
- Cabeceras de grupo (`SelectLabel`, `DropdownMenuLabel`, `ComboboxLabel`): versalitas pequeñas, `text-xs font-semibold tracking-wide text-muted-foreground uppercase` — mismo patrón que `TableHead`.

### Avatar
- Circular (`rounded-full`), única forma redonda del sistema. `AvatarFallback` (iniciales) sobre fondo `--accent`; `AvatarBadge` (indicador) sobre fondo `--primary`.

### Alert
- `border` + `bg-*/10` por variante semántica (`warning`, `success`, `destructive`); el color va en borde e icono, nunca en el texto del cuerpo (los tonos `warning`/`success` no contrastan lo suficiente como color de texto sobre fondo claro). `AlertTitle` en `font-semibold`.

### Tables
- Contenedor con scroll horizontal propio; filas con hover (`hover:bg-muted/70`); celdas con prioridad de columna (`data-priority`) que se ocultan en pantallas estrechas pero vuelven siempre en impresión.
- `TableHead` en versalitas pequeñas y tracking ancho (`text-xs font-semibold tracking-wide text-muted-foreground uppercase`) — deliberadamente de menor peso visual que el dato, para que la tabla lea como herramienta y no compita con el contenido.
- Valores atómicos (fechas, importes, DNI) usan `nowrap` + `tabular-nums`, opt-in por celda.

### Dialogs
- `DialogContent` por defecto `sm:max-w-sm` (384px); con una o más filas `grid grid-cols-2` (5-10 campos), `sm:max-w-lg`; formularios muy densos (≥12 campos), `sm:max-w-2xl`.
- El error de la Server Action (`FormError`) va como primer hijo de `FieldGroup`, nunca justo antes de `DialogFooter`.

### Empty States (`SectionPlaceholder`)
- `default`: icono, caja con borde punteado — para una sección real sin datos.
- `compact`: sin icono ni borde, texto apagado en `font-sans` normal (nunca `font-heading`) — para "sin resultados" dentro de tarjeta, pestaña o columna estrecha.

## Do's and Don'ts

### Do:
- **Do** usar Archivo (`font-sans`/`font-heading`, misma variable) en toda la interfaz — nunca introducir una segunda familia para titulares.
- **Do** usar `font-semibold` en botones, badges y pestaña activa — nunca `font-medium`.
- **Do** usar el vocabulario de tono semántico (`StatusTone`) para cualquier color de estado — nunca un color de badge o icono elegido ad hoc.
- **Do** delimitar contenedores y popovers con `ring-1 ring-foreground/15`, no con `box-shadow` de reposo.
- **Do** dar a los badges y chips forma rectangular (`rounded-sm`) — nunca píldora.
- **Do** poner cabeceras de tabla y de menú en versalitas pequeñas y tracking ancho, apagadas en `text-muted-foreground`.

### Don't:
- **Don't** introducir sombras (`box-shadow`) para jerarquía o estado de reposo — el sistema es plano por definición.
- **Don't** mezclar una segunda familia tipográfica (condensada, monoespaciada de adorno, o cualquier combo Inter/Space Grotesk genérico) con Archivo.
- **Don't** usar un azul-gris apagado como acento primario — el petróleo saturado (`oklch(0.4 0.15 195)`/`oklch(0.78 0.14 195)`) es la decisión, no un valor de compromiso.
- **Don't** dar a los badges cualquier radio que no sea rectangular (`rounded-sm`) — la píldora completa (`rounded-4xl`) queda descartada de este mundo.
- **Don't** añadir metáforas de objeto físico o decoración temática a la interfaz — la personalidad viene solo de tipografía, paleta y forma (restricción explícita del usuario, tras rechazar un primer mundo temático).
- **Don't** dejar el sidebar con un cromo de color fijo distinto del tema activo — se probó y se rechazó; la personalización vive en el componente, no en la región.
