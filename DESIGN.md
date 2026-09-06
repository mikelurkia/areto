---
name: Areto
description: Gestión de club de fútbol sala — azul institucional, acento ámbar, tipografía condensada atlética
colors:
  institutional-navy:
    light: "oklch(0.32 0.09 258)"
    dark: "oklch(0.68 0.13 258)"
  warm-amber:
    light: "oklch(0.55 0.16 75)"
    dark: "oklch(0.68 0.16 75)"
  neutral-bg:
    light: "oklch(0.985 0.004 250)"
    dark: "oklch(0.17 0.014 258)"
  neutral-card:
    light: "oklch(0.995 0.003 250)"
    dark: "oklch(0.22 0.016 258)"
  neutral-foreground:
    light: "oklch(0.22 0.02 258)"
    dark: "oklch(0.96 0.008 250)"
  neutral-muted:
    light: "oklch(0.95 0.012 245)"
    dark: "oklch(0.28 0.016 258)"
  neutral-border:
    light: "oklch(0.88 0.012 250)"
    dark: "oklch(1 0 0 / 10%)"
  success:
    light: "oklch(0.55 0.12 145)"
    dark: "oklch(0.74 0.13 145)"
  warning:
    light: "oklch(0.78 0.13 75)"
    dark: "oklch(0.78 0.13 75)"
  destructive:
    light: "oklch(0.58 0.215 25)"
    dark: "oklch(0.7 0.2 25)"
typography:
  heading:
    fontFamily: "Barlow Condensed, sans-serif"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Work Sans, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "0.24rem"
  md: "0.32rem"
  lg: "0.4rem"
  xl: "0.56rem"
  pill: "9999px"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "0.625rem"
  lg: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.institutional-navy}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.institutional-navy}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-foreground}"
    rounded: "{rounded.lg}"
  badge-highlight:
    backgroundColor: "{colors.warm-amber}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.neutral-foreground}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: Areto

## Overview

**Creative North Star: "Secretaría de Federación"**

Areto es una herramienta de gestión interna para la junta y los entrenadores
de un club de fútbol sala — no un producto de cara al público, sino el
cuaderno operativo del club. La estética responde a eso: seria pero cálida,
con carácter deportivo contenido en vez de gráfico corporativo genérico o
deportivo estridente. El azul institucional es el color del papeleo
federativo serio (actas, sellos, credenciales), no un azul de startup; el
ámbar cálido es el detalle de medalla, reservado para lo que de verdad
destaca. La tipografía condensada de los títulos (Barlow Condensed) aporta
carácter atlético sin caer en la plantilla Inter/Space Grotesk que domina el
software B2B genérico — decisión tomada explícitamente al construir el
sistema.

El sistema es **plano y preciso**: sin sombras a nivel de reposo (las tarjetas
se delimitan con un anillo fino, no con elevación), esquinas apenas
suavizadas, densidad de datos por encima del adorno. Todo está optimizado para
que una junta de 4-8 personas lea tablas, cifras y estados de un vistazo —
nunca para impresionar a un visitante.

**Key Characteristics:**
- Azul institucional como color de marca y acción, nunca un azul "SaaS" saturado.
- Ámbar cálido como acento raro, reservado para lo que destaca de verdad (`highlight`).
- Cero sombras a nivel de reposo: los bordes y el anillo (`ring-1`) hacen el trabajo de delimitar.
- Radios de esquina pequeños y consistentes, salvo en badges (píldora completa).
- Titulares en tipografía condensada; cuerpo en una humanista cálida — nunca la misma familia para ambos.
- Todas las vistas imprimibles (actas, listados médicos) comparten exactamente los mismos tokens que la pantalla, con overrides puntuales para lo que el papel no puede reproducir (sombras, colores oscuros).

## Colors

Paleta de gestión federativa: azul institucional como base de marca, ámbar cálido como acento raro, y un fondo neutro casi blanco (con un matiz frío apenas perceptible) para el resto.

### Primary
- **Azul Institucional** (`oklch(0.32 0.09 258)` claro / `oklch(0.68 0.13 258)` oscuro): color de marca y acción — botones primarios, anillo de foco, enlaces, iconografía de navegación activa.

### Secondary
- **Ámbar Cálido** (`oklch(0.55 0.16 75)` claro / `oklch(0.68 0.16 75)` oscuro): acento `highlight` del vocabulario de tono semántico (`lib/status-tone.ts`) — solo para lo que de verdad destaca (una cifra clave, un badge de estado especial). Nunca decorativo suelto.

### Neutral
- **Fondo** (`oklch(0.985 0.004 250)` claro / `oklch(0.17 0.014 258)` oscuro): fondo de página — casi blanco, con un matiz azulado apenas perceptible, nunca gris neutro puro.
- **Tarjeta** (`oklch(0.995 0.003 250)` claro / `oklch(0.22 0.016 258)` oscuro): fondo de `Card`, ligeramente distinto del fondo de página.
- **Texto** (`oklch(0.22 0.02 258)` claro / `oklch(0.96 0.008 250)` oscuro): texto principal.
- **Borde** (`oklch(0.88 0.012 250)` claro / `oklch(1 0 0 / 10%)` oscuro): borde y anillo de `Card`, divisores de tabla.

### Semánticos (estado)
- **Éxito** (`oklch(0.55 0.12 145)`): cobrado, aprobado, vigente.
- **Aviso** (`oklch(0.78 0.13 75)`): pendiente, por vencer.
- **Peligro** (`oklch(0.58 0.215 25)`): rechazado, caducado, error.

### Named Rules
**The Ring-Not-Shadow Rule.** `Card` se delimita con `ring-1 ring-foreground/10`, nunca con `box-shadow`. En impresión el anillo se sustituye por un borde real (`border: 1px solid var(--border)`), porque los navegadores no imprimen sombras ni la mayoría de anillos.

**The Rare Amber Rule.** El ámbar cálido (`gold` en el código) es el tono `highlight` del vocabulario semántico compartido — se usa en menos casos que éxito/aviso/peligro, nunca como color decorativo de fondo.

## Typography

**Display/Heading Font:** Barlow Condensed (con `sans-serif` de reserva)
**Body Font:** Work Sans, peso variable (con `sans-serif` de reserva)

**Character:** Pareo deliberado de una condensada "atlética" para títulos con una humanista cálida para el cuerpo — evita a propósito el combo por defecto Inter/Space Grotesk del software de plantilla.

### Hierarchy
- **Título de página** (semibold, `text-2xl`/`text-xl` en modo `compact`): `PageHeader`, un h1/h2 por página.
- **Título de tarjeta** (medium, `text-base`/`text-sm` en `size="sm"`): `CardTitle`, en `font-heading`.
- **Cifra destacada** (bold, `text-lg`, `tabular-nums`): `StatTile`, en `font-heading` para que se lea como dato y no como texto corrido.
- **Encabezado de sección** (semibold, `text-xs`, versalitas, tracking ancho): `SectionHeading`, apagado en `text-muted-foreground`.
- **Cuerpo** (regular, `text-sm`): tablas, descripciones, texto corrido — en Work Sans.

### Named Rules
**The Heading-Is-Condensed Rule.** Cualquier texto en `font-heading` (títulos de página, de tarjeta, cifras de `StatTile`) usa Barlow Condensed. El cuerpo nunca hereda esta fuente.

## Layout

Raíz de página: `flex flex-1 flex-col gap-6`, invariante en toda la app interna. Sidebar de navegación fijo en escritorio (colapsa a `Sheet` en móvil, decisión de hidratación tomada en el servidor). Tablas envueltas en un contenedor con scroll horizontal propio (`data-slot="table-container"`) — la página nunca hace scroll horizontal. Columnas de tabla con prioridad (`primary`/`secondary`/`lg`/`tertiary`) que ocultan las de apoyo en pantallas estrechas, pero siempre presentes en impresión vía `data-priority`. Vistas imprimibles reservan una hoja A4 con su propio componente (`PrintableSheet`), padding de 14mm, sin margen de documento por defecto.

## Elevation & Depth

Sistema plano por defecto: no hay vocabulario de sombras para estado de reposo. `Card` usa un anillo (`ring-1 ring-foreground/10`) para delimitarse en vez de elevación — la profundidad no es una dimensión que este sistema use. La única sombra real es la del anillo de foco (`focus-visible:ring-3`), que es de accesibilidad, no de jerarquía visual.

### Named Rules
**The Flat-By-Default Rule.** Ninguna superficie usa `box-shadow` para indicar jerarquía o estado de reposo. Los anillos y bordes hacen ese trabajo, y son lo único que sobrevive a la impresión.

## Shapes

Radios de esquina progresivos pero pequeños en la base (`--radius: 0.4rem`), escalados con `calc()` para `sm`/`md`/`lg`/`xl`/`2xl`/`3xl`/`4xl` — nunca radios arbitrarios sueltos. `Card` usa `rounded-xl` (~9px), botones e inputs `rounded-lg` (~6.4px), badges `rounded-4xl` (píldora completa, la única forma redonda del sistema). Sin bordes gruesos: 1px en todo, salvo el anillo de foco.

## Components

### Buttons
- **Shape:** `rounded-lg` (~6.4px), altura `h-8` por defecto (`h-7` en `sm`, `h-6` en `xs`).
- **Primary:** fondo `--primary` (azul institucional), texto `--primary-foreground`, hover atenuado (`bg-primary/80`).
- **Outline / Ghost / Secondary:** fondo transparente o `--secondary`, mismo radio y altura.
- **Destructive:** fondo `destructive/10`, texto `destructive` — nunca fondo sólido rojo (coherente con "el color raro se reserva").
- **Estado activo:** `translate-y-px` al pulsar — un feedback táctil sutil, sin sombra.

### Chips / Badges
- **Style:** píldora completa (`rounded-4xl`), altura fija `h-5`, texto `text-xs`.
- **State:** color por tono semántico compartido (`lib/status-tone.ts` → `TONE_VARIANT`) — nunca un componente elige su propio color, siempre pasa por el tono.

### Cards / Containers
- **Corner Style:** `rounded-xl`.
- **Background:** `--card`, ligeramente distinto de `--background`.
- **Shadow Strategy:** ninguna — ver Elevation & Depth. Delimitado por `ring-1 ring-foreground/10`.
- **Densidad:** `size="sm"` reduce el padding interno (`--card-spacing` de 1rem a 0.625rem) para KPIs y contextos densos como `StatTile`.

### Inputs / Fields
- **Style:** `rounded-lg`, borde `border-input`, fondo transparente (`bg-input/30` en oscuro), altura `h-8`.
- **Focus:** anillo de 3px (`ring-3 ring-ring/50`) más borde a `--ring`.
- **Error:** borde y anillo a `--destructive`.

### Navigation
- Sidebar shadcn con tokens propios (`--sidebar*`), fijo en escritorio, `Sheet` en móvil. Ítem activo resaltado por el href más largo que coincide con la ruta (para rutas con prefijo compartido). Marca estática (logo + nombre) pintada sin esperar a datos de sesión.

### Empty States (`SectionPlaceholder`)
- `default`: icono, caja con borde punteado, ocupa el espacio disponible — para una sección real sin datos.
- `compact`: sin icono ni borde, texto apagado en `font-sans` normal (nunca en la tipografía de encabezado) — para "sin resultados" dentro de una tarjeta, pestaña o columna estrecha.

### Tables
- Contenedor con scroll horizontal propio; filas con hover (`hover:bg-muted/70`); celdas con prioridad de columna (`data-priority`) que se ocultan en pantallas estrechas pero vuelven siempre en impresión.
- Valores atómicos (fechas, importes, DNI) usan `nowrap` + `tabular-nums`, opt-in por celda — el resto del texto rompe línea por defecto para caber en móvil.

## Do's and Don'ts

### Do:
- **Do** usar el vocabulario de tono semántico (`StatusTone`: neutral/positive/warning/danger/highlight) para cualquier color de estado — nunca un color de badge o icono elegido ad hoc.
- **Do** delimitar contenedores con `ring-1 ring-foreground/10`, no con `box-shadow`.
- **Do** usar Barlow Condensed (`font-heading`) solo en títulos y cifras destacadas; Work Sans en todo lo demás.
- **Do** marcar columnas de tabla de apoyo con `priority` en vez de esconderlas con clases de anchura sueltas.

### Don't:
- **Don't** introducir sombras (`box-shadow`) para jerarquía o estado de reposo — el sistema es plano por definición.
- **Don't** usar el ámbar cálido (`gold`/`highlight`) como color decorativo suelto — está reservado al tono semántico "destacado".
- **Don't** mezclar Inter o Space Grotesk (o cualquier combo de plantilla genérica) con la pareja Barlow Condensed / Work Sans ya establecida.
- **Don't** dar a los badges cualquier radio que no sea la píldora completa (`rounded-4xl`) — es la única forma completamente redonda del sistema.
