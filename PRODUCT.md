# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Junta directiva y entrenadores de un club de fútbol sala (4-8 personas con
cuenta: presidente/administrador, secretaría, responsable económico/tesorería,
responsable de patrocinadores, entrenadores). Jugadores y familias **no tienen
cuenta**: su único contacto con la app es el formulario público de
inscripción/renovación de ficha. El acceso a la app es por invitación, sin alta
pública.

## Product Purpose

Sustituir la gestión dispersa en Excel/Google Forms/WhatsApp de un club
monodeporte (fútbol sala) por una única herramienta que cubre: fichas de
personas y equipos por temporada, cuotas y domiciliación bancaria (remesas
SEPA), trámites federativos, patrocinadores, economía general (libro mayor,
presupuesto, conciliación), calendario, avisos, fichas médicas/de aptitud, y el
arranque de cada temporada nueva (crear temporada, categorías, equipos, fechas
de cobro).

## Positioning

Modela los procesos reales de este club concreto (fútbol sala, federación
vasca/gipuzkoana, remesas SEPA, trámites federativos por equipo) en vez de
forzar un software de gestión de clubes genérico y multi-deporte. Escala
deliberadamente pequeña: 4-8 equipos, 100-300 personas, sin costura para
multi-club ni multi-deporte.

## Operating Context

- Temporada = curso deportivo verano-verano; la gestión es multi-temporada,
  con `seasons.isCurrent` marcando la temporada activa que ve la UI por
  defecto.
- El asistente de "arranque de temporada" centraliza crear la temporada,
  activar categorías con su rango de edad, crear equipos con su cuota y fijar
  fechas de cobro, antes de anunciar la renovación a las familias.
- El formulario público de inscripción es el único punto de entrada de datos
  para familias: identifica la ficha existente (DNI, o nombre + fecha de
  nacimiento si aún no es obligatorio) y queda pendiente de validación manual
  por alguien con permiso de edición sobre personas.
- Cuotas (jugador, socio, "Areto Eskola") y patrocinios generan cobros por
  domiciliación bancaria (remesas SEPA); todo aterriza en el módulo económico
  para conciliación con el extracto bancario (importación manual hoy).
- Trámites federativos van por equipo (no por categoría): alta, envío de
  documento, inscripción en liga y copa (opcional), con pago y justificante.
- El módulo médico registra el estado de reconocimiento médico/aptitud por
  persona (vigente/caducado).
- "Sugerencias" es un canal interno para que la propia junta pida mejoras
  sobre la app, con estado de seguimiento — no es una funcionalidad de cara al
  club.
- Permisos por rol, configurables desde `/administracion/roles` sin tocar
  código (el catálogo de permisos vive en `src/lib/permissions.ts`; qué rol
  tiene cuál vive en base de datos). El club arranca con cuatro roles de
  fábrica (Administrador, Secretaría, Entrenador, Socio) que no se pueden
  borrar pero sí reconfigurar.
- Bilingüe ES/EU: interfaz estática + formulario público de inscripción, vía
  i18n. Datos libres introducidos por la junta no se duplican por idioma.
- Dos entornos Supabase separados (producción y `areto-dev`); las migraciones
  a producción se aplican automáticamente al mergear a `main`.

## Capabilities and Constraints

- Next.js (App Router) + React + TypeScript, Tailwind CSS v4 + shadcn/ui
  (estilo `nova`), PostgreSQL + Drizzle ORM, Supabase Auth.
- Descuentos de cuota (p. ej. hermanos): descartados explícitamente, no
  modelar salvo que se retome.
- Entrenador: alcance de permisos sin definir todavía más allá de acceso
  técnico mínimo — no construir nada específico para este rol sin pedirlo.
- Conexión bancaria directa (open banking): pospuesta a una versión futura; v1
  es importación manual del extracto.

## Brand Commitments

Nombre del producto: **Areto**. Sin más identidad de marca confirmada todavía
(logo, paleta, tono visual) más allá de lo ya construido en la UI actual.

## Evidence on Hand

Datos reales del club (personas, equipos, patrocinadores, movimientos
económicos) viven en el proyecto Supabase de producción; el desarrollo usa
`areto-dev` con datos de semilla inventados (`pnpm run db:seed:demo`) que
imitan un club completo, incluidas incoherencias a propósito para probar
avisos. No hay testimonios, casos de cliente ni prensa que fabricar — el
cliente es el propio club.

## Product Principles

- Modelar el proceso real del club, no un genérico de "gestión de clubes".
- Nunca hardcodear un rol o nombre de permiso en el código: todo pasa por el
  catálogo de permisos y `requirePermission`/`requireEdit`/`requireView`.
- Las familias nunca entran a la app: todo su contacto pasa por el formulario
  público y la validación manual de la junta.
- Cambios de esquema van siempre acompañados de su migración generada en el
  mismo PR.
