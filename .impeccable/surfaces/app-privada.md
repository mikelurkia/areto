---
version: 1
slug: "app-privada"
primary_target: "app-privada"
related_targets: []
---

---
version: 1
slug: "app-privada"
primary_target: "app-privada"
related_targets: []
---

# App privada — Areto (junta directiva y entrenadores)

Scope: `(app)` route group, modo Operate. Piloto: dashboard + ficha de equipo.
Audience: junta directiva y entrenadores de un club de fútbol sala,
trabajando entre partidos, gestionando papeleo federativo, cuotas y
personas. No es un público consumer; es gente que usa la herramienta a
diario para tareas administrativas, a menudo bajo prisa.

Restricción explícita del usuario (segunda tirada, tras rechazar un primer
intento de mundo temático "pizarra de vestuario" con cinta adhesiva):
cero metáforas de objeto físico, cero decoración temática. La personalidad
viene solo de tipografía, paleta y forma.

Nota (tercera tirada, descartada): se probó una dirección basada en el
escudo real del club (verde/rojo de Aroña Mendi K.E., numeral condensado
tipo dorsal, badges con esquina cortada, cabecera con bloque de color
sólido). El usuario la rechazó sin llegar a build completo ni finish
review — "no me gusta estos últimos cambios, vuelve atrás" — y pidió en su
lugar un ajuste mucho más acotado sobre el mundo ya enviado: menos radio de
esquina y más densidad. No repetir la dirección de escudo/colores del club
sin que el usuario la pida de nuevo explícitamente.

## Direction contract

**THESIS:** La app deja de parecer una plantilla de dashboard genérica
porque tiene una sola voz tipográfica con carácter propio y un acento de
color con convicción — no porque simule ser otra cosa. Rechaza tanto el
"azul institucional + Inter" por defecto como cualquier tema decorativo.

**OWN-WORLD:** Una sola familia, Archivo (grotesca geométrica con carácter,
no Inter/Work Sans genérica), en pesos 400/500 para cuerpo y 700/800 para
títulos y cifras — sin segunda tipografía de titulares. Botones y controles
en `font-semibold`, no `font-medium`: la interfaz entera habla en el mismo
registro de convicción tipográfica. Acento saturado azul-petróleo real
(`oklch(0.4 0.15 195)` en claro, `oklch(0.78 0.14 195)` en oscuro — no un
azul-gris apenas distinguible del institucional original) que carga
botones primarios, enlaces, estado activo/hover y foco, con una escala de
grises que comparte su mismo matiz frío (hue ~200) para que todo el
sistema suene a la misma paleta, no a dos tintes distintos superpuestos.
Radios pequeños y consistentes (0.375rem base); badges como etiqueta
rectangular (`rounded-sm`), no píldora. Cifras clave en tabular-nums
dentro de la misma grotesca, nunca en monoespaciada de adorno. Cabeceras
de tabla en versalitas pequeñas y tracking ancho (`text-xs uppercase
tracking-wide text-muted-foreground`), no del mismo peso que el dato, para
que la tabla lea como herramienta de datos. Superficies planas, sin
sombra, delimitadas por un ring de 1px (`ring-1 ring-foreground/15`, algo
más presente que el sistema heredado, sobre el "flat-by-default" ya
existente).

**STORY:** Quien entra ve de inmediato una herramienta seria y propia del
club, no una plantilla SaaS ni un tema con disfraz. La jerarquía se lee por
peso tipográfico y por el acento de color en lo accionable, nunca por
decoración.

**FIRST VIEWPORT:** Dashboard — sidebar de navegación que sigue el tema de
la página (claro/oscuro, no un cromo de herramienta fijo: eso se probó y
el usuario lo rechazó — la personalización vive en los componentes, no en
regiones enteras del layout con su propio esquema de color), con el ítem
activo en `font-semibold` y resaltado con el mismo acento saturado.
Cabecera de página con el título en Archivo 800 a `text-3xl` (antes
`text-2xl`, para que lea como titular real y no como encabezado de
plantilla), KPIs en `StatGrid` con la cifra en Archivo 700 tabular a
`text-2xl` (antes `text-lg`), avisos con el mismo acento azul-petróleo
reservado a lo que requiere acción. La personalización se busca ahora a
nivel de componente shadcn individual: indicador de pestaña activa en
`Tabs` con el acento (no neutro), iniciales de `Avatar` sobre fondo de
acento, checks de `Select`/`DropdownMenu` coloreados con el acento,
cabeceras de menú y `Alert` con el mismo `font-semibold` que el resto de
controles. Nada adicional decorativo alrededor de las tarjetas.

**FORM:** Grotesca + acento azul-petróleo, elegida por el usuario entre
tres combinaciones concretas presentadas tras rechazar el mundo temático;
seed key `a9ad6178` (ronda de dirección, índice asignado 3, no adoptado —
la decisión final fue una elección directa del usuario entre 3 propuestas
concretas de tipografía+color+forma, no un candidato del catálogo).

**FINISH:** unreviewed and undocumented is unfinished; this build ends
with the finish review, the verdict, DESIGN.md, and every shipping raster
carrying its provenance.
