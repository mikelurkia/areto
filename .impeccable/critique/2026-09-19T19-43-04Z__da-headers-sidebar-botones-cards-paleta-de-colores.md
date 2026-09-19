---
target: "app privada: headers, sidebar, botones, cards - paleta de colores"
total_score: 11
max_score: 16
na_heuristics: 1,2,3,5,7,10
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\Mikel\\Documents\\dev\\areto\\app privada: headers, sidebar, botones, cards - paleta de colores"
timestamp: 2026-09-19T19-43-04Z
slug: da-headers-sidebar-botones-cards-paleta-de-colores
---
## Crítica de color — headers, sidebar, botones, cards (Areto)

**Method:** dual-agent (A: aec08150528706127 · B: a6a4b9c5ed3f54697)

### Salud del diseño (heurísticas aplicables)

| # | Heurística | Puntuación | Hallazgo clave |
|---|---|---|---|
| 4 | Consistencia y estándares | 3 | Ítem activo del sidebar reparte el acento de forma desigual entre icono y texto |
| 6 | Reconocimiento antes que recuerdo | 3 | Vocabulario semántico centralizado (status-tone.ts) |
| 8 | Estética y diseño minimalista | 3 | Estructural = gris, acción = petróleo; jerarquía clara |
| 9 | Recuperación de errores | 2 | Botón destructive por debajo de AA en claro (4.04:1) |
| Resto (1,2,3,5,7,10) | n/a | No son cuestiones de color en este alcance |
| **Total** | **11/16 aplicables** | **69% — Bueno** |

### Veredicto de especificidad
Voz propia (croma 0.14-0.15 vs 0.06-0.09 típico de SaaS), gold separado de warning por hue. 0 hallazgos del detector, 0 colores crudos en 7 piezas auditadas. Riesgo: en oscuro el acento se percibe como cian pastel, no petróleo denso (paridad matemática, no perceptual).

### Fortalezas
- Un solo valor de acento alimenta foco, sidebar y gráficos (--primary → --ring/--sidebar-ring/--chart-1).
- Vocabulario semántico centralizado (status-tone.ts), 5 tonos fijos.
- Cards/contenedores solo con ring-foreground/15 (neutro); color reservado a lo accionable.
- Cero deuda de color crudo (detector + grep en 7 piezas y todas las páginas de (app)/).

### Problemas priorizados

[P1] Contraste insuficiente en botón destructive (claro): text-destructive sobre bg-destructive/10 da 4.04:1 (bajo AA 4.5:1). Dark pasa (4.76:1). Fix: oscurecer --destructive en :root (~L 0.5) o añadir peso/borde.

[P2] Demarcación sidebar/contenido depende de un ring casi imperceptible: --sidebar vs --background (contraste 1.04 entre fondos), única frontera es ring-1 ring-foreground/15. Riesgo para baja visión/alto contraste del SO. Fix: ring-foreground/20-25 o diferencia de fondo perceptible.

[P2] Acento del ítem activo del sidebar inconsistente: icono usa text-sidebar-primary (saturado), etiqueta usa data-active:text-sidebar-accent-foreground (casi neutro). Fix: unificar ambos al mismo nivel de saturación.

[P3] El acento cambia de carácter perceptual en oscuro (cian pastel vs petróleo denso) — pendiente confirmación visual, no hubo navegador disponible en esta pasada.

[P3] Hover sutil en botones outline/ghost: bg-muted + border-primary/40, sin fondo de acento. Fricción de velocidad para power-users en tablas de acciones densas.

### Banderas de persona
Sam: contraste destructive (P1) y demarcación sidebar (P2) son los puntos a verificar antes de dar el sistema por accesible.
Alex: hover sutil de outline/ghost (P3), fricción no bloqueante.

### Observaciones menores
- sidebar-accent claro (croma 0.04) muy pálido junto al acento saturado de botones — riesgo de "dos petróleos" de intensidad distinta.
- chart-1 reutiliza literalmente --primary: riesgo de confundir barra de gráfico con elemento interactivo.
- Verificación B sin capturas de navegador (herramienta no disponible en el subagente); P3 de oscuro sin confirmar visualmente.
