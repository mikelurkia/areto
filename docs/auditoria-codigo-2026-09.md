# Auditoría de código de Areto

**Fecha:** 2026-09-01 · **Alcance:** 399 ficheros TS/TSX, 52.177 líneas, 278 commits.
**Revisión:** 2026-09-20 — cada hallazgo verificado línea a línea contra `main`;
los ya corregidos quedan marcados en su sitio en vez de borrados, para no
perder el rastro de qué se hizo y cuándo.

Búsqueda de ineficiencias, duplicación, copia-pega, cuellos de botella, código
sucio y arquitectura fuera del estándar de Next.js. Cada hallazgo lleva ruta,
línea y por qué importa; el orden de ataque queda abierto.

Este documento **absorbe y sustituye** al plan de rendimiento previo, cuyas
etapas 4 y 5 nunca llegaron a ejecutarse (secciones C y E de aquí).

## Punto de partida

El código está **bien cuidado** — 2 usos de `any` en todo el repo, ningún
TODO/FIXME pendiente, comentarios que documentan el *porqué* de cada decisión no
obvia, y una capa de composición de UI ya extraída. La auditoría no encuentra un
proyecto desordenado; encuentra **deuda concentrada en sitios concretos** y, en
un caso, un bug real.

---

## A. Bug de corrección (lo único urgente)

**A1. ✅ Corregido.** Todos los cargos de una tanda salían como `FRST`.
`src/app/[locale]/(app)/cuotas/actions.ts:183` y `:266`

`nextSequenceType(mandate.id)` (`src/lib/sepa.ts:70-77`) decide `FRST`/`RCUR`
consultando si el mandato ya tiene algún cargo **en base de datos**. Pero el
bucle acumula en `rows[]` y no inserta hasta `:196`. Para un pagador nuevo con
10 periodos generados de golpe, las 10 filas consultan una tabla que todavía no
tiene ninguna: **las 10 se guardan como `FRST`**.

`src/lib/sepa-xml.ts:160-176` las agrupa después en el bloque `PmtInf` de
`FRST`. Un mandato SEPA admite exactamente un `FRST`; el banco rechaza el
resto. Verificado de punta a punta: no hay ningún paso posterior que corrija el
valor.

Es el único hallazgo de la auditoría que produce datos incorrectos, no solo
lentitud o duplicación.

---

## B. Rendimiento de base de datos

**B1. ✅ Corregido.** N+1 en la generación de cuotas
(`cuotas/actions.ts` — `generatePlayerCharges`/`generateMemberCharges`).
Los mandatos se resuelven ahora en una query previa por lote (`inArray`) y el
`sequenceType` se decide en memoria con `sequenceTypeAssigner` (`sepa.ts`),
lo que además corrigió **A1**.

**B2. ✅ Corregido.** Falta el índice `sepa_charges.mandate_id`.
`src/db/schema.ts:1830` ya define `sepa_charges_mandate_idx`.

**B3. ✅ Corregido.** `countMedicalCertMismatches` traía la tabla `persons`
entera. `src/lib/data-integrity.ts:135-150` calcula el desajuste con SQL
(`IS DISTINCT FROM` sobre una subquery del último reconocimiento), sin traer
filas a JS.

Matiz importante: `countExpiringMedicalPlayers`
(`src/lib/dashboard-alerts.ts:51-65`) **sí** lleva `WHERE` y trae un conjunto
pequeño. El plan anterior lo metía en el mismo saco que `data-integrity.ts`;
no lo merecía.

**B4. Obsoleto — descartado tras verificarlo.** La entrada original hablaba de
la campana de notificaciones disparando la agregación de B3 en toda la
aplicación. B3 ya está corregida (SQL puro), así que el argumento de "se paga
en toda la app" ya no aplica; el propio diseño de `notification-bell.tsx`
(fuera del árbol de render) sigue siendo correcto.

**B5. Inserts uno a uno en `importSponsors`.**
`patrocinadores/actions.ts:872-922`: dos inserts por línea pegada, sin
transacción y sin lote. Un fallo a mitad deja patrocinadores sin acuerdo.

**B6. ✅ Corregido.** Sobre-fetching de filas de persona completas
(`with: { person: true }` sin acotar `columns`). Los sitios representativos ya
listan `columns` explícitas (p. ej. `equipos/[teamId]/page.tsx`, que ahora
acota a los campos que la ficha realmente pinta, sin `iban` ni `sepaConsentAt`).

**B7. Detección de duplicados en el camino crítico del alta.**
`personas/actions.ts:391-408`: cada intento de crear una persona trae la tabla
`persons` entera (12 columnas, sin `where`) para `findCandidates`.

**B8. `assignNextMemberNumber` repite el agregado en cada reintento.**
`personas/actions.ts:1422-1454`: recalcula `max(memberNumber)` en cada vuelta
del bucle de 5 intentos. Impacto real bajo (solo en colisión).

---

## C. Bundle y payload cliente (era la etapa 4 del plan anterior)

**C1. ✅ Corregido (2026-09-20).** Los 115 KB de mensajes viajaban en toda
ruta: el `<NextIntlClientProvider>` del layout raíz (`[locale]/layout.tsx`)
sin `messages` mandaba `es.json`/`eu.json` completo a cualquier subárbol de
cliente, incluidas las rutas públicas. Se añadió `src/i18n/pick-messages.ts`
(subconjunto de mensajes por namespace) y un `NextIntlClientProvider` anidado
en el layout de cada grupo público — `(auth)/layout.tsx`,
`inscripcion/layout.tsx`, `patrocinadores-muro/layout.tsx`,
`auth-code-error/layout.tsx` — que solo manda los namespaces que sus
componentes cliente usan de verdad (`Login`+`Sidebar`+`AppLayout` en `(auth)`,
`Inscripciones`+`Equipos`+`AppLayout` en `inscripcion`, `AppLayout` en
`patrocinadores-muro`, nada en `auth-code-error`). El grupo `(app)` sigue
recibiendo el fichero completo sin cambios: necesita casi todos los
namespaces, así que acotarlo ahí no habría compensado el riesgo.
Verificado con `pnpm run build` y visitando cada ruta pública en dev sin
`MISSING_MESSAGE`.

**C2. Obsoleto — descartado tras verificarlo.** La entrada original decía que
`cmdk` (`ui/command.tsx`) se importaba de forma estática desde
`(app)/layout.tsx`. Ya no es así: la importación es dinámica, así que no hace
falta ningún `next/dynamic` adicional.

**C3. ✅ Corregido (2026-09-20).** La ficha de equipo serializaba todas las
personas del club: `equipos/[teamId]/page.tsx` traía `persons.findMany` sin
paginar y lo pasaba por props a `MembershipDialog` → `MembershipPersonCombobox`
para filtrar en el navegador. Ahora sigue el mismo patrón que `GuardianPicker`
(personas de la vista) y `personas/page.tsx`: `searchMembershipCandidates`
(`src/lib/person-list.ts`) busca en servidor por nombre, excluyendo con
`notExists` a quien ya es miembro del equipo, y `MembershipPersonCombobox`
llama a la Server Action `findMembershipCandidates` con debounce de 250 ms en
vez de recibir la lista completa. La página ya no consulta `persons` en
absoluto para este flujo.

> **Descartado tras verificarlo:** `findDuplicatePersonGroups`
> (`person-matching.ts:172-203`) es O(n²), y el plan anterior proponía
> optimizarla. El propio código explica que con unos cientos de personas el
> coste es insignificante, y es cierto: optimizarla sería complejidad
> especulativa contra la regla 2 de `CLAUDE.md`. No se recoge como hallazgo.

---

## D. Duplicación de UI

**D1. La capa de composición se extrajo pero solo la usa un fichero.**
Este es el hallazgo de UI más rentable. `FiltersBar`, `SearchInput` y
`BulkActionsBar` existen precisamente para deduplicar los browsers —sus propios
comentarios dicen que estaban *"copiados a mano en los ocho browsers"*— y
**los importa exactamente un fichero cada uno**: `personas-browser.tsx`.

Siguen con el bloque a mano: `equipos-browser.tsx:139-148`,
`registrations-browser.tsx:108-117`, `medical-panel-browser.tsx:255-264`,
`socios-browser.tsx:179-192` (y `:194-228` para la barra de acciones masivas),
`member-requests-browser.tsx`, `sponsors-browser.tsx:148-157`,
`temporadas-browser.tsx`. La extracción se hizo; la migración se quedó a medias.

**D2. ✅ Corregido.** `formatCents` existía y casi nadie la usaba; ahora la
importan 30 ficheros, cubriendo los sitios que antes construían
`Intl.NumberFormat` a mano.

**D3. ✅ Corregido.** `medical-panel-browser.tsx` reimplementaba `StatusBadge`
localmente; ahora importa el componente global (`@/components/status-badge`).

**D4. Bloque de "emails para BCC masivo" duplicado al carácter.**
`personas-browser.tsx:210-224` y `socios-browser.tsx:138-150`: mismo `useState`,
mismo `useEffect` con bandera `cancelled`, misma derivación de `href`, mismo
botón. Solo cambia el nombre de la Server Action. Junto con `hrefForPage`
(`personas:299-305` / `socios:169-175`, idéntica) y
`toggleSelected`/`toggleSelectAll` (`personas:226-241` / `socios:115-133`), son
tres bloques idénticos entre los mismos dos ficheros: falta el hook que junte
selección + email masivo + paginación por URL.

---

## E. Duplicación en Server Actions (era la etapa 5 del plan anterior)

**E1. No hay validación por esquema en ningún sitio.** `grep zod` → 0. Toda la
entrada se lee con `String(formData.get(x) ?? "").trim()`. Consecuencia
verificada: los `id` no se validan como UUID salvo en un sitio
(`personas/actions.ts:969`, usado solo en `:1035`); el resto
(`deletePersonTag:1367`, `deleteSponsorPayment:569`, `deleteSponsorContact:768`)
pasa el string crudo a `eq(...)` — un POST manipulado da **500 en vez de error
de formulario**, porque Postgres rechaza el cast a `uuid`.

**E2. 15 formas incompatibles de `ActionState`.** `PersonState`, `SponsorState`,
`RoleState`, `UserState`, `SettingsState`, `CourtEventState`, `ClubState`,
`CuotasState`, `TeamState`, `MembershipState`, `RegistrationReviewState`,
`QuickPersonState`, `MergeState`, `SeasonState`, `AuthState` — una por fichero
de actions, con campos distintos, consumidas por 151 `useActionState`.

**E3. 127 `await requirePermission` a mano.** Más el parseo de `FormData`, el
mapeo de constraint a mensaje y la revalidación, repetidos en cada action. Es lo
que justificaba el `defineAction` del plan anterior.

**E4. Constantes de fichero duplicadas 7 veces.** `ALLOWED_PHOTO_TYPES`,
`ALLOWED_QUALIFICATION_FILE_TYPES`, `ALLOWED_MEDICAL_FILE_TYPES`,
`ALLOWED_ID_SCAN_TYPES` (`personas/actions.ts:89,116,147,637`),
`ALLOWED_LOGO_TYPES`, `ALLOWED_CONTRACT_TYPES` (`patrocinadores/actions.ts:36,40`),
`ALLOWED_BRANDING_IMAGE_TYPES` (`club/actions.ts:191`),
`ALLOWED_FEDERATION_CARD_TYPES` (`equipos/[teamId]/actions.ts:183`) — todas la
misma lista `pdf/jpeg/png/webp`, con su pareja de tamaño máximo.

**E5. `today()` reimplementado 8 veces.** Definido como función en
`personas/actions.ts:260`, e inline en `cuotas/actions.ts:393,445`,
`inscripciones/actions.ts:490`, `patrocinadores/actions.ts:640`,
`lib/roster-health.ts:71`, `lib/sepa.ts:57,85`.

**E6. `isUniqueViolation` duplicada mirando un solo nivel de `.cause`.**
`inscripciones/actions.ts:62-69` reimplementa lo que `src/lib/db-errors.ts` ya
hace recorriendo la cadena entera (como sí usa `personas/actions.ts:224`).

**E7. ✅ Corregido en `updatePerson`; sigue abierto en `updateRegistration`.**
`personas/actions.ts:574` ya envuelve el update de `persons` +
`syncClubMembership` + `replaceGuardians` en un único `db.transaction`. Falta
revisar si `updateRegistration` (`inscripciones/actions.ts:159-227`) recibió
el mismo tratamiento — no verificado en esta pasada.

**E8. Permisos cruzados desalineados.** `bulkAddToTeam`
(`personas/actions.ts:1310`) escribe en `memberships` exigiendo solo
`personas.manage`, mientras `addMembership` (`equipos/[teamId]/actions.ts:46`)
exige `equipos.manage` para la misma escritura.

**E9. Guardas repetidas.** El ternario de permiso por tipo de inscripción
aparece 5 veces en `inscripciones/actions.ts` (`~170`, `~260`, `~582`, `~628`,
`~669`); el `findFirst` + `if (!target) return { error }` aparece 5 veces en
`administracion/usuarios/actions.ts` (`~207`, `~277`, `~334`, `~373`, `~406`).

---

## F. Componentes gigantes

**F1. `personas/[personId]/page.tsx` — 1293 líneas, 9 pestañas en línea.**
`TabsContent` en `:616`, `:870`, `:883`, `:940`, `:954`, `:1017`, `:1163`,
`:1229`, `:1273`. El propio fichero ya tiene el patrón resuelto para dos de
ellas (`FamilySection:138`, `CuotasSection:229`); falta aplicarlo al resto.

**F2. `inscripcion/jugador/jugador-form.tsx` — 947 líneas.** 22 campos repiten
el mismo molde `Field`/`FieldLabel`/`aria-invalid`/`FieldError` (22 apariciones
de `FieldError>{fieldErrors...}`, 13 de `aria-invalid`). Un `TextField` reduce
~170 líneas a ~50 y evita que un campo nuevo se olvide el `aria-invalid` — ya
pasa hoy. Además `FeeTable` y `PhotoField` (`:52-224`) son autocontenidos.

**F3. `approveRegistration` — 306 líneas, cinco responsabilidades.**
`inscripciones/actions.ts:233-539`, con un N+1 de tutores dentro del `tx`
(acotado a 1-2 tutores; impacto marginal). Igual `saveInjuryReportAndGenerate`
(`personas/actions.ts:1005-1157`).

---

## G. Menores

- **G1.** Dos carpetas hermanas para lo mismo: `src/components/temporada/`
  (3 ficheros) y `src/components/temporadas/` (1 fichero).
- **G2. ✅ Corregido.** `src/app/global-error.tsx` ya existe.
- **G3.** 14 rutas públicas sin `loading.tsx` (`inscripcion/**`, `(auth)/login`,
  `acceso-*`, `auth-code-error`). Todas leen de funciones `"use cache"`, así que
  no es un problema de rendimiento — es que la convención de `CLAUDE.md` no dice
  si "toda ruta de la app" incluye lo que está fuera del grupo `(app)`. Merece
  una frase que lo zanje en un sentido o en otro.
- **G4.** `STATUS_FILTER_VALUES` (`medical-panel-browser.tsx:70-77`) se mantiene
  a mano en vez de derivarse de `MedicalCertStatus` (`lib/medical-status.ts:4`):
  un estado nuevo en el tipo no llegaría al filtro, en silencio.
- **G5.** Dos `eslint-disable react-hooks/exhaustive-deps` para silenciar
  dependencias inestables en `useMemo`: `sponsors-browser.tsx:104-120` y
  `equipos-browser.tsx:93-104`.
- **G6.** `<img>` en vez de `next/image` en 14 sitios. Casi todos son URLs
  firmadas de Storage, previews de `createObjectURL` u hojas A4 imprimibles,
  donde `next/image` no aporta. La excepción que sí valdría evaluar es
  `patrocinadores-muro/page.tsx:214`, única página pública de tráfico.

---

## Lo que se revisó y está bien

Para no volver a mirarlo en la próxima auditoría:


- **`src/proxy.ts`** — no toca base de datos, excluye los prefetch de
  `getClaims()` con una justificación documentada, matcher correcto, lista
  blanca invertida para que toda ruta nueva nazca protegida.
- **`revalidatePath("/", "layout")`** — no se usa en ningún sitio.
  `src/lib/revalidate.ts` está acotada por ruta y etiqueta, y
  `revalidateAppShell()` queda reservada a roles/usuarios/ajustes.
- **La convención de concurrencia de `CLAUDE.md`** — se respeta en todas las
  páginas, con comentarios que citan el incidente del dashboard. Sin
  violaciones.
- **`"use cache"`** — los 6 usos coinciden exactamente con la línea base
  permitida. Ninguno de más.
- **APIs legacy** — sin `params`/`searchParams` sin `await`, sin `next/router`,
  sin `getServerSideProps`, sin exports `dynamic`/`revalidate`.
- **`src/lib/`** — 60 módulos con responsabilidad única; `entity-notes.ts` y
  `entity-documents.ts` ya factorizan CRUD reutilizado en tres módulos.
- **`src/lib/xlsx.ts`**, `pdf-lib`, `qrcode` — confinados correctamente.
- **`findDuplicatePersonGroups`** — O(n²) deliberado y justificado.
- **`importTeamsFromSeason`** (`equipos/actions.ts`) — corrige explícitamente su
  propio N+1; es el contraejemplo a seguir para B1 y B5.

---

## Anotado, fuera de alcance

**✅ Corregido (2026-09-20).** Las dos acciones públicas sin autenticar
(`inscripcion/actions.ts` — `submitTeamRegistration` y
`submitMemberRegistration`) escribían en BD y subían a Storage con la clave de
servicio, sin límite de tasa. Se añadió `checkRegistrationRateLimit()`
(`src/lib/registration-rate-limit.ts`), que cuenta envíos por IP
(`x-forwarded-for`) en una ventana de 10 minutos usando una tabla nueva
(`registration_attempts`, migración `0094_mature_karnak.sql`) y corta al
sexto intento con el mensaje `tooManyAttempts`. Sin infraestructura de
Redis/Upstash en el proyecto y con despliegue serverless en Vercel, un
contador en memoria no sobrevive entre invocaciones — por eso el contador vive
en Postgres y se comprueba dentro de la propia Server Action, no en
`src/proxy.ts` (que deliberadamente no toca base de datos).
