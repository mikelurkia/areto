# /club en pestañas

## Contexto

`/club` es hoy una sola columna con cuatro `Card` apiladas
(`src/app/[locale]/(app)/club/page.tsx`). Funciona, pero mezcla en una misma
pantalla cosas de naturaleza distinta: identidad fiscal del club, quién firma
los papeles, dos interruptores operativos de inscripción, una plantilla PDF de
la mutualidad y unas credenciales de intranet federativa. El capítulo además va
a crecer (firma del directivo y sello del club como imágenes), y añadir más
tarjetas a la pila lo empeora.

El objetivo de esta tarea es **solo la reorganización en pestañas**: dejar el
capítulo con sitios claros donde caiga lo que venga después. No hay cambio de
esquema ni migración.

## Estructura elegida: 5 pestañas

| Pestaña | Contenido | Origen hoy |
|---|---|---|
| **Datos del club** (por defecto) | `legalName`, `taxId`, `address`, `email`, `phone`, `iban` | `ClubSettingsForm` |
| **Firmantes** | `signatoryName`, `signatoryNationalId` | `ClubSettingsForm` |
| **Inscripciones** | `playerRegistrationOpen`, `memberRegistrationOpen` | `RegistrationAvailabilityForm` (sin cambios) |
| **Médico** | `federationDelegation` (Delegación Territorial de la mutualidad) + plantilla del parte de lesión | `ClubSettingsForm` + `InjuryReportTemplateForm` |
| **Federaciones** | `federationCode` + listado de cuentas de intranet | `ClubSettingsForm` + `FederationAccountsList` |

Nota sobre "Médico": `/medico` ya existe como panel **operativo** (reconocimientos
y partes por persona). La pestaña de `/club` es solo **configuración** del área
médica, y por eso lleva la delegación y la plantilla, no listados.

## Implementación

### 1. Envoltorio de pestañas

Copiar el patrón canónico de `src/components/administracion/roles-tabs.tsx`:
client component que recibe el contenido ya renderizado en servidor como
`React.ReactNode` por props, y usa `useTabParam` (`src/hooks/use-tab-param.ts`)
para derivar la pestaña de la URL en vez de `useState`.

Nuevo `src/components/club/club-tabs.tsx`:

```
const VIEWS = ["datos", "firmantes", "inscripciones", "medico", "federaciones"] as const;
```

`TabsList variant="default"` (píldoras) no aplica aquí: en `/club` no hay una
segunda fila de navegación por encima como en Administración, así que va el
subrayado por defecto — igual que `personas/[personId]` o `equipos/[teamId]`.

`page.tsx` sigue siendo server component: carga los mismos tres datos en
paralelo (`getClubSettings`, `getFederationAccounts`, `fileExists`) y pasa cada
`Card` ya montada como prop a `ClubTabs`.

### 2. Trocear el formulario grande

`ClubSettingsForm` es un único `<form>` y `updateClubSettings`
(`club/actions.ts:30`) escribe **las diez columnas de golpe**. Al repartir los
campos en pestañas, un formulario parcial vaciaría las columnas que no muestra:
hay que trocear también la acción.

Es el mismo razonamiento que ya justifica `updateRegistrationAvailability`
(comentario en `actions.ts:73-77`: se separó "para no tener que reenviar los
datos fiscales solo para tocar un interruptor").

- Extraer en `actions.ts` un helper privado `upsertClubSettings(values)` con el
  UPSERT singleton + `updateTag(CLUB_SETTINGS_TAG)` + `revalidateRoutes(ROUTE.club)`
  que hoy está copiado en las tres acciones.
- Sustituir `updateClubSettings` por cuatro acciones, cada una escribiendo solo
  su subconjunto y reusando el helper: `updateClubIdentity` (con la validación
  `isValidIban` que ya existe), `updateClubSignatories`, `updateClubMedicalSettings`
  (`federationDelegation`), `updateClubFederationSettings` (`federationCode`).
  `updateRegistrationAvailability` y `uploadInjuryReportTemplate` se quedan como
  están, solo pasan a usar el helper.

En `src/components/club/`, `club-settings-form.tsx` se divide en cuatro
componentes del mismo estilo (`useActionState` + `useActionToast` +
`SubmitButton` + `key={revision}` para refrescar los `defaultValue`), moviendo
los `Field` tal cual: `club-identity-form.tsx` (mantiene `useIbanField`),
`club-signatories-form.tsx`, `club-medical-form.tsx`, `club-federation-form.tsx`.

La vista de solo lectura (sin `club.manage`) del `<dl>` con `InfoRow` se reparte
igual entre las pestañas correspondientes.

### 3. Traducciones

`messages/es.json` y `messages/eu.json`, namespace `Club`: las 46 claves
actuales se conservan. Añadir los rótulos de pestaña (`tabData`, `tabSignatories`,
`tabRegistration`, `tabMedical`, `tabFederations`) y un mensaje de guardado por
sección (`clubSignatoriesSaved`, `clubMedicalSaved`, `clubFederationSaved`) más
sus botones si no basta con reutilizar `saveClubData`.

## Verificación

- `npm run lint` y `npm run build` (obligatorio: `getClubSettings` usa
  `"use cache"`, y los errores de Cache Components solo salen en el build).
- En la app: `/club` con usuario `club.manage` → las cinco pestañas navegan y
  dejan `?vista=` en la URL (menos la primera); guardar en "Firmantes" no borra
  el IBAN ni el CIF, y viceversa; el toast de guardado aparece en cada pestaña.
- Con un usuario con `club.view` pero sin `club.manage`: se ven los valores en
  modo lectura, sin formularios.
- Comprobar que sigue saliendo bien un documento que consume `getClubSettings`,
  p. ej. `/personas/[id]/parte-lesion/[reportId]` (usa `signatoryName`,
  `signatoryNationalId` y `federationDelegation`).

---

## Anexo: qué más cabe en este capítulo (para PRs siguientes)

Ordenado por lo que más rendimiento da. Nada de esto entra en esta tarea.

**1. Firma del directivo y sello del club (pestaña Firmantes).** La
infraestructura ya está: bucket `document-templates` (privado, ya mapeado a
`club.view` en `src/app/api/storage/[bucket]/[...path]/route.ts`),
`uploadFile` + `resizeImageToWebp` (`src/lib/image-resize.ts`), y el patrón de UI
del logo de patrocinador (`src/components/patrocinadores/sponsor-dialog.tsx`:
previsualización + `Input type=file` + casilla "eliminar"). Rutas fijas tipo
`club/firma.webp` y `club/sello.webp`, como ya hace la plantilla del parte.

El destino elegido es **estamparlas en el parte de lesión**:
`src/lib/injury-report-fields.ts:294` dice hoy que "el parte se firma y se sella
en papel", y ya rellena y aplana el AcroForm con `pdf-lib` — `embedPng`/`drawImage`
antes del `flatten` cierra el círculo. Segundo consumidor evidente: el acta de
equipo (`equipos/[teamId]/acta/page.tsx`), que ya pinta líneas de firma vacías.

**2. Cuota anual de socio.** `memberAnnualFeeCents` ya existe en la tabla y lo
lee el formulario público (`src/lib/registration-settings.ts`), pero **no tiene
UI**: solo se puede cambiar por SQL. Es el hueco más barato de tapar (pestaña
Inscripciones).

**3. Identidad visual.** El club no tiene logo/escudo propio en la base de datos
(los patrocinadores sí). Serviría para las cabeceras imprimibles, el carné
(`personas/[id]/carne`), el muro de patrocinadores y el pie público.

**4. Identificador de acreedor SEPA.** No existe en ningún sitio, y hay mandatos
SEPA (`sepaConsentAt` en las inscripciones). Es obligatorio en el mandato; sin él
la domiciliación no es válida. Iría junto al IBAN, en Datos del club.

**5. Datos de la mutualidad (pestaña Médico).** Número de póliza, centro médico
concertado (nombre, dirección, teléfono) y vigencia del reconocimiento en meses
—hoy el criterio de caducidad vive en `src/lib/medical-status.ts` en vez de ser
configurable.

**6. CRUD de federaciones.** `federation_accounts` es hoy solo lectura: añadir,
editar y borrar cuentas sin pasar por SQL.

**7. Junta directiva.** Convertir el firmante único en una lista de cargos
(presidente, secretario, tesorero) con DNI, firma y vigencia, para que cada
documento elija quién lo firma. Solo si aparece la necesidad real de más de un
firmante.
