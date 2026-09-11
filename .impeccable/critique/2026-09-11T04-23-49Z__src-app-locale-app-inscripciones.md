---
target: inscripciones - flujo de aprobación sin equipo
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:C:\\Users\\Mikel\\Documents\\dev\\areto\\src\\app\\[locale]\\(app)\\inscripciones"
timestamp: 2026-09-11T04-23-49Z
slug: src-app-locale-app-inscripciones
---
## Design Health Score

| # | Heurística | Puntuación | Hallazgo clave |
|---|-----------|-------|-----------------|
| 1 | Visibilidad del estado del sistema | 1 | Tras aprobar, el panel de revisión no muestra si la persona tiene equipo. |
| 2 | Ajuste al mundo real | 3 | "Opcional" minimiza que saltárselo crea una persona huérfana sin aviso posterior. |
| 3 | Control y libertad del usuario | 2 | Rechazar se puede reabrir; aprobar no ofrece ningún siguiente paso de "asignar equipo ahora". |
| 4 | Consistencia y estándares | 3 | El alta rápida de socios explicita la consecuencia en su copy; el flujo de jugador no. |
| 5 | Prevención de errores | 1 | Con `teamId` vacío y kind=player no se ejecuta ninguna rama: ni membership, ni aviso, ni confirmación. |
| 6 | Reconocimiento antes que recuerdo | 1 | El enlace del dashboard va a `/personas` sin filtro pese a que `?equipo=none` ya existe. |
| 7 | Flexibilidad y eficiencia | 3 | Prev/next y formulario compartido son eficientes, pero amplifican la exposición al bug. |
| 8 | Diseño estético y minimalista | 3 | Campo de equipo con mismo peso visual que campos realmente opcionales. |
| 9 | Reconocer y recuperarse de errores | 1 | No existe ningún estado de error que reconocer; contraste con duplicados de email/DNI que sí tienen mensajes específicos. |
| 10 | Ayuda y documentación | 2 | El hint tranquiliza sin decir que nada recordará el hueco después. |
| **Total** | | **20/40** | **Poor — fallo concentrado en 1, 5, 6, 9** |

## Veredicto de especificidad de diseño

El resto del flujo está genuinamente pensado para el dominio (SEPA, tutores, aviso de edad-equipo, negativa deliberada a construir "desaprobar"). Pero la asignación de equipo está modelada como "un campo más opcional" en vez de como el paso final de una transacción en dos partes. El sistema ya tiene un detector (`countOrphanPlayers`) para este fallo exacto, probando que el equipo era consciente del riesgo a nivel de datos — pero esa consciencia nunca llegó al diseño de interacción.

Escaneo determinista (`impeccable detect`) sobre inscripciones: `[]`, exit 0 en ambos directorios — el problema es de arquitectura de información, no de patrones visuales. No se pudo inyectar overlay en vivo (sin herramienta de navegador en esta sesión); confirmado por lectura estática cruzada en dos evaluaciones independientes.

## Impresión general

El formulario está bien construido para todo lo que sí se atendió. En la única decisión que señala tu mensaje (¿tiene equipo o no?), el sistema trata "aprobar" como una operación atómica sin consecuencias parciales, cuando tiene dos resultados muy distintos y solo uno deja rastro visible. La oportunidad no es rediseñar el formulario: es cerrar el bucle que el backend ya sabe que existe pero que la interfaz nunca comunica.

## Qué funciona bien

- Formulario compartido edición+aprobación elimina la clase de bug "edité pero olvidé guardar antes de aprobar".
- El detector del problema ya existe (`countOrphanPlayers`) y es barato en SQL — falta solo mostrarlo en el sitio y momento adecuados.
- Negativa deliberada y bien razonada a construir "desaprobar" (comentario explícito sobre reconciliación de datos).

## Priority Issues

**[P0] Aprobar un jugador sin equipo crea un registro huérfano silencioso y permanentemente invisible**
- Por qué importa: `actions.ts:516-539` — con teamId vacío y kind=player, ninguna rama se ejecuta; mensaje de éxito idéntico al de una aprobación completa.
- Arreglo: aviso en línea en el panel de "ya revisada" cuando falta membership + confirmación explícita al aprobar sin equipo.
- Comando sugerido: `/impeccable harden` sobre review-form.tsx y actions.ts

**[P1] El enlace del dashboard va a `/personas` sin filtrar pese a que el filtro ya existe**
- Por qué importa: `data-integrity.ts:217` usa href "/personas" a secas; `?equipo=none` ya está implementado en person-list.ts/personas-browser.tsx.
- Arreglo: cambiar href a `/personas?equipo=none&rol=player`.
- Comando sugerido: `/impeccable polish` sobre data-integrity.ts

**[P2] Sin copy de consecuencia ni confirmación en el momento de la decisión de riesgo**
- Por qué importa: teamOptionalHint tranquiliza sin avisar de que nada recordará el hueco; contraste con el diálogo de alta rápida de socios que sí nombra la consecuencia.
- Arreglo: reforzar copy o, mejor, cerrar primero P0/P1.
- Comando sugerido: `/impeccable clarify` sobre review-form.tsx

**[P3] El panel de "ya revisada" nunca muestra el estado de equipo/plantilla**
- Por qué importa: es el sitio natural donde un revisor volvería días después a comprobar si terminó bien.
- Arreglo: añadir consulta de membership junto a la existente y renderizar "Sin equipo asignado" con enlace, solo para kind=player.
- Comando sugerido: `/impeccable harden` sobre reviewed-registration-panel.tsx y [registrationId]/page.tsx

## Persona red flags

**Riley (stress tester)**: en revisión por lotes con prev/next, es quien más probablemente deje "Equipo" en blanco — la propia mejora de eficiencia amplifica la exposición al bug.

**Jordan (primerizo)**: nada le enseña que "aprobar jugador" son dos cosas (persona + plantilla); el tono tranquilizador del hint refuerza el modelo mental equivocado.

## Observaciones menores

- `membershipRole` siempre parte en "player" independientemente del contexto.
- La tarjeta del dashboard trata `orphanPlayers` con el mismo badge genérico que issues menos accionables.
- Botones "Guardar cambios"/"Aprobar" con igual peso visual pese a que aprobar es irreversible.

## Preguntas para pensar

- Si `countOrphanPlayers` ya existe y es barato, ¿por qué solo aparece como contador en vez de avisar/bloquear en el momento de la creación?
- ¿"Aprobar sin equipo" es a veces legítimo (equipos aún no montados) o siempre un error? Si a veces es intencional, el arreglo es un estado real de "pendiente de asignar equipo", no solo un aviso.
