---
target: inscripciones/[id]
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\Mikel\\Documents\\dev\\areto\\src\\app\\[locale]\\(app)\\inscripciones\\[registrationId]"
timestamp: 2026-09-08T21-19-36Z
slug: src-app-locale-app-inscripciones-registrationid
---
# Crítica de diseño: `inscripciones/[id]` (detalle de revisión de inscripción)

**Method: dual-agent (A: revisión de diseño en agente aislado · B: escaneo determinista en agente aislado)**

Nota de alcance: sin navegador ni servidor de desarrollo activo en esta sesión; Assessment A trabajó solo con lectura de código fuente, Assessment B con el detector determinista sobre los ficheros reales.

## Design Health Score

| # | Heurística | Puntuación | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2/4 | Aprobar dispara una operación server-side potencialmente lenta sin indicador de progreso. |
| 2 | Match System / Real World | 2/4 | Lenguaje de CRUD en vez del modelo mental real del revisor. |
| 3 | User Control and Freedom | 2/4 | Rechazar dispara sin confirmación, a diferencia de borrar en el mismo módulo. |
| 4 | Consistency and Standards | 3/4 | Buen uso del sistema de componentes; una caja de documento ausente rompe el patrón. |
| 5 | Error Prevention | 1/4 | Sin confirmación al rechazar, sin aviso de discrepancias sin resolver. |
| 6 | Recognition Rather Than Recall | 2/4 | Comparación fotográfica para el jugador pero solo texto para tutores. |
| 7 | Flexibility and Efficiency of Use | 1/4 | Sin siguiente/anterior; nada acelera el trabajo en lote. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Formulario largo homogéneo, sin distinción entre campo rutinario y decisión de alto riesgo. |
| 9 | Error Recovery | 2/4 | FormError consistente, solo tras envío. |
| 10 | Help and Documentation | 1/4 | La razón del posible duplicado se calcula pero nunca llega al revisor. |
| **Total** | | **18/40** | **Poor** |

## Veredicto de especificidad de diseño

Pantalla de edición genérica con un widget de comparación de identidad pegado encima, no diseñada para la tarea real de verificar identidad con consecuencias legales. El detector determinista dio 0 hallazgos en las 6 pasadas (exit 0) — el sistema de diseño se respeta al pie de la letra; el problema es de diseño específico para la tarea, no de conformidad con tokens.

## Priority Issues

**[P0] Rechazar no pide confirmación** (review-form.tsx:328-330) — inconsistente con el borrado, que sí confirma. Fix: AlertDialog. → /impeccable harden

**[P0] La razón del posible duplicado nunca llega al revisor** (person-matching.ts:213-236) — DuplicateMatchReason se calcula y se descarta. Fix: propagarla al badge/tooltip. → /impeccable clarify

**[P1] Sin siguiente/anterior entre inscripciones pendientes** (page.tsx:175) — penaliza revisión en lote en arranque de temporada. → /impeccable shape

**[P1] Tutores candidatos sin comparación fotográfica** (guardian-review-fields.tsx:174-196) — los tutores firman el consentimiento legal. → /impeccable harden

**[P2] Acciones de decisión lejos de los datos que las justifican** — sin barra de acción persistente. → /impeccable layout

## Persona Red Flags

**Alex (power user)**: sin siguiente/anterior, sin atajo "todo correcto, aprobar".
**Sam (accesibilidad)**: comparación foto actual→nuevo solo por glifo y posición; imágenes con alt="" — descalificante para una tarea de comparación visual.
**Riley (stress tester)**: findCandidates sin fuzzy matching (DNI mal transcrito = cero candidatos, duplicado silencioso); sin persistencia de borrador.

## Minor Observations

- page.tsx:213-221: caja a mano en vez de SectionPlaceholder.
- page.tsx:25-29: riesgo de operación lenta documentado en comentario, no reflejado en UI.
- loading.tsx:11: no replica el flex-wrap real de las miniaturas.
- match-select.tsx:229: centinela "—" frágil.

## Questions to Consider

- ¿Y si aprobar/rechazar fuera el encuadre principal desde el primer segundo, no el final del formulario?
- ¿Por qué findCandidates usa matching más débil que otras utilidades de duplicados del propio código?
- ¿Debería la verificación de identidad ser un paso obligatorio que desbloquea el resto del formulario?
