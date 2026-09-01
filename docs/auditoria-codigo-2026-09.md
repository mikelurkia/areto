# Auditoría de código de Areto

**Fecha:** 2026-09-01 · **Alcance:** 399 ficheros TS/TSX, 52.177 líneas, 278 commits.

Búsqueda de ineficiencias, duplicación, copia-pega, cuellos de botella, código
sucio y arquitectura fuera del estándar de Next.js. Cada hallazgo lleva ruta,
línea y por qué importa; el orden de ataque queda abierto.

Este documento **absorbe y sustituye** al plan de rendimiento previo, cuyas
etapas 4 y 5 nunca llegaron a ejecutarse (secciones C y E de aquí). Verificado
contra el código actual: `NextIntlClientProvider` sigue sin `messages`, no hay
ningún `next/dynamic`, `countDuplicateCaptains` sigue viva, y `grep zod` da 0.

## Punto de partida

El código está **bien cuidado** — 2 usos de `any` en todo el repo, ningún
TODO/FIXME pendiente, comentarios que documentan el *porqué* de cada decisión no
obvia, y una capa de composición de UI ya extraída. La auditoría no encuentra un
proyecto desordenado; encuentra **deuda concentrada en sitios concretos** y, en
un caso, un bug real.

---

## A. Bug de corrección (lo único urgente)

**A1. Todos los cargos de una tanda salen como `FRST`.**
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

**B1. N+1 en la generación de cuotas.**
`cuotas/actions.ts:171-193` (`generatePlayerCharges`) y `:254-266`
(`generateMemberCharges`). Dentro del bucle se llama a `getOrCreateMandate()` y
`nextSequenceType()`, una query cada una. 20 jugadores × 10 periodos = hasta
400 round-trips secuenciales en una sola invocación. Los mandatos se pueden
resolver en una query previa por lote (`inArray`) y el `sequenceType` se decide
en memoria — lo que además arregla **A1**.

**B2. Falta el índice `sepa_charges.mandate_id`.**
`src/db/schema.ts:1288-1289` define índices en `remittanceId` y `payerPersonId`,
pero no en `mandateId`, que es justo por lo que filtra `nextSequenceType`
(`sepa.ts:73`). Cada una de las ~400 llamadas de B1 hace seq scan sobre una
tabla que crece sin techo con el histórico de recibos.

**B3. `countMedicalCertMismatches` trae la tabla `persons` entera.**
`src/lib/data-integrity.ts:91-100`: `findMany` **sin `where`**, con
`medicalCheckups` y `memberships→team` anidados, para filtrar después en JS por
jugador activo y devolver **un número**. Está cacheada (`cacheLife("derivados")`),
así que solo se paga en cache-miss — pero el coste escala con el tamaño total
del club, no con el subconjunto relevante. Es un `COUNT` con `GROUP BY`.

Mismo patrón, menor calibre, en el resto del fichero: `countMissingNationalId`
(`:62-78`), `countDuplicateCaptains` (`:126-139`, trae capitanes de *todas* las
temporadas para filtrar una) y `countDuplicatePersonGroups` (`:192-202`, tabla
`persons` completa).

Matiz importante: `countExpiringMedicalPlayers`
(`src/lib/dashboard-alerts.ts:51-65`) **sí** lleva `WHERE` y trae un conjunto
pequeño. El plan anterior lo metía en el mismo saco que `data-integrity.ts`;
no lo merece. Solo el primero justifica el cambio.

**B4. La campana de notificaciones dispara toda la agregación en cada carga.**
`src/components/notification-bell.tsx:39-41` llama a `fetchNotifications()` al
montar, y `src/lib/notifications.ts:48-60` encadena `countPendingRegistrations`,
`countExpiringMedicalPlayers`, `loadSeasonRenewals`, `loadDataIntegrityIssues` y
`countDuplicatePersonGroups`. Está bien diseñado (fuera del árbol de render,
para no repetir el patrón que colgó el dashboard), pero significa que B3 se
paga en **toda la aplicación**, no solo en `/dashboard`.

**B5. Inserts uno a uno en `importSponsors`.**
`patrocinadores/actions.ts:872-922`: dos inserts por línea pegada, sin
transacción y sin lote. Un fallo a mitad deja patrocinadores sin acuerdo.

**B6. Sobre-fetching de filas de persona completas: 13 sitios.**
`with: { person: true }` trae las ~30 columnas de `persons` —incluidos `iban`,
`nationalId`, `address`, `sepaConsentAt`— donde la vista pinta un nombre.
Representativos: `equipos/[teamId]/page.tsx:103`, `cuotas/page.tsx:69-70`,
`cuotas/[remittanceId]/page.tsx:52-53`, `equipos/[teamId]/acta/page.tsx:58`,
`personas/[personId]/page.tsx:103,159`. Además de payload, es exposición
innecesaria de datos sensibles en el payload RSC.
Contraejemplo a seguir, ya en el repo: `personas/actions.ts:1354` acota
`columns` explícitamente.

**B7. Detección de duplicados en el camino crítico del alta.**
`personas/actions.ts:391-408`: cada intento de crear una persona trae la tabla
`persons` entera (12 columnas, sin `where`) para `findCandidates`.

**B8. `assignNextMemberNumber` repite el agregado en cada reintento.**
`personas/actions.ts:1422-1454`: recalcula `max(memberNumber)` en cada vuelta
del bucle de 5 intentos. Impacto real bajo (solo en colisión).

---

## C. Bundle y payload cliente (era la etapa 4 del plan anterior)

**C1. Los 115 KB de mensajes viajan en toda ruta.**
`src/app/[locale]/layout.tsx:58`: `<NextIntlClientProvider>` sin `messages`
manda `es.json` completo. Medido por namespace: una ruta pública de inscripción
necesita `Inscripciones` (15 KB) + `Landing` + `Metadata` + errores ≈ 18 KB, y
recibe 115 KB. Los namespaces grandes que no pinta nunca: `Personas` (21 KB),
`Administracion` (12 KB), `Patrocinadores` (12 KB), `Equipos` (9 KB).
`src/i18n/request.ts` ya cachea la carga con `"use cache"`; no hay que tocarlo.

**C2. `cmdk` en el bundle inicial.**
`CommandPalette` ya monta su cuerpo solo al abrirse, pero
`src/components/ui/command.tsx` se importa estáticamente desde
`(app)/layout.tsx:5`. ~15-20 KB gz. Sería el único `next/dynamic` del repo —
`pdf-lib`, `qrcode` y `write-excel-file` ya están bien confinados
(`src/lib/xlsx.ts:17` usa `import()` dinámico, correctamente).

**C3. La ficha de equipo serializa todas las personas del club.**
`equipos/[teamId]/page.tsx:110-113` trae `persons.findMany` sin paginar y lo
pasa por props a `MembershipDialog` → `MembershipPersonCombobox`
(`"use client"`), que filtra en el navegador.
La página hermana ya abandonó ese patrón: `personas/page.tsx:52-54` documenta
que *"el diálogo de alta ya no recibe la lista de personas del club; la busca
al escribir"* (ver `GuardianPicker`, búsqueda por Server Action).
`equipos/[teamId]` quedó descolgado de ese cambio.

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

**D2. `formatCents` existe y casi nadie la usa.**
`src/lib/money.ts:22-27` es "el único sitio donde se convierte entre céntimos y
texto" según su propio comentario. La importan 3 ficheros. Hay **15 sitios** que
construyen `new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" })`
a mano: `cuotas/page.tsx:75`, `cuotas/[remittanceId]/page.tsx:61`,
`patrocinadores/page.tsx:87`, `patrocinadores/[sponsorId]/page.tsx:166`,
`.../recibo/[paymentId]/page.tsx:50`, `personas/[personId]/rgpd/page.tsx:109`,
`inscripcion/socio/page.tsx:34`, `pending-charge-group-card.tsx:43`,
`remittance-charges-table.tsx:42`, `invoice-register.tsx:55`,
`sponsors-browser.tsx:94`, `tier-breakdown-chart.tsx:23`, y otros.

**D3. `StatusBadge` reimplementada con el mismo nombre.**
`medical-panel-browser.tsx:79-95` define una `StatusBadge` local con
`if/else` sobre variantes de `Badge` — exactamente el "no" de la tabla de
`CLAUDE.md`— mientras 14 ficheros usan la global. Colisión de nombre, además.

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

**E7. Transacciones que faltan.** `updatePerson` (`personas/actions.ts:497-552`)
no tiene ninguna: update de `persons` + `syncClubMembership` +
`replaceGuardians` (que es DELETE+INSERT). Un fallo en medio **deja a la persona
sin tutores**. En `createPerson` (`:410-449`) el `tx` envuelve solo el insert.
Mismo patrón en `updateRegistration` (`inscripciones/actions.ts:159-227`).

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
- **G2.** No existe `src/app/global-error.tsx`. Como el layout raíz real es
  `[locale]/layout.tsx` (monta `<html>`, fuentes, providers) y `error.tsx` no
  cubre el layout que lo contiene, un fallo en ese setup no lo captura nadie.
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

Las dos acciones públicas sin autenticar (`inscripcion/actions.ts:81` y `:267`)
escriben en BD y suben a Storage con la clave de servicio, sin límite de tasa ni
de número de líneas. El registro de fallos está bien resuelto; falta la
contención previa. Es seguridad, no calidad de código — merece su propia tarea.
