# Módulo económico

## Cómo se ejecuta

Este documento **es** el plan, y vive en el repo siguiendo la convención que ya
existe (`docs/plan-club-pestanas.md`). El módulo se desarrolla por fases, una
sesión por fase, con `/clear` entre medias — que es lo que pide el
apartado "Coste de contexto" de `CLAUDE.md`: seis PRs en una sola sesión son
justamente el caso que ahí se desaconseja.

**Paso cero, antes de la fase 1**: este documento se mergea a `main` en su propia
rama `chore/plan-modulo-economico`. Si viviera solo en la rama de la fase 1, una
sesión nueva que arranque desde `main` no lo encontraría.

Rutina de cada fase, en sesión limpia:

1. Leer `docs/plan-modulo-economico.md` (contexto completo, sin releer el resto
   del proyecto).
2. Invocar la skill `/desarrollar-funcionalidad`, que cubre el ciclo de rama,
   migración y expand/contract.
3. Implementar **solo** esa fase.
4. Marcar la fase en la tabla de Estado del propio documento y commitearlo con
   el resto del PR.
5. `/clear`.

### Estado

| Fase | Qué entra | Estado |
|---|---|---|
| 0 | Este documento en `main` | hecha (este PR) |
| 1 | Cimientos: `ledger`, categorías, cuentas, permisos, shell de `/economia` | hecha |
| 2 | Movimientos: tabla, alta manual, listado | hecha |
| 3 | Importación Norma 43 + CSV, lotes y deduplicación | hecha |
| 4 | Facturas recibidas, proveedores y conciliación | hecha |
| 5 | Facturas emitidas, absorción de patrocinio, agregado de remesas | hecha |
| 6 | Presupuesto e informe presupuesto vs devengado vs caja | pendiente |
| 7 | *Contract*: retirar `invoiceNumber`/`invoicedOn` de `sponsor_payments` | pendiente |

## Contexto

Areto cubre hoy solo el **cobro**: `sepa_charges` (remesas de cuotas),
`sponsor_payments` (patrocinio) y el par `fees`/`payments`, que está inerte
(ninguna UI ni action los escribe). No existe nada del otro lado —ni gasto, ni
tesorería, ni presupuesto— y la exploración lo confirma tajantemente: **no hay
ninguna noción de caja, efectivo, subvenciones ni ingresos que no sean cuotas o
patrocinio** en todo el proyecto. La única aparición de "efectivo" es un
*placeholder* de traducción sobre el campo de texto libre
`sponsor_payments.method`.

La facturación emitida tampoco existe como entidad: son **dos columnas**
(`invoiceNumber`, `invoicedOn`) sobre `sponsor_payments`, más un contador anual
(`invoice_counters`) y un registro acoplado 1:1 a patrocinios.

Se quiere un módulo con cuatro piezas —**presupuesto por temporada**,
**movimientos bancarios**, **facturas recibidas** y **facturas emitidas**— con
las facturas enlazables a los movimientos, que es lo que pide la auditoría:
poder ir de un apunte del extracto al documento que lo justifica. Y con dos
ámbitos contables separados.

### Sobre el eje A/B

Se resuelve como un **eje de ámbito contable** genérico (`ledger`: `official` /
`internal`) presente en toda entidad económica, con la regla dura de que ningún
total mezcla los dos libros. Eso sirve al caso legítimo y frecuente en un club
—la caja de efectivo, la lotería, las rifas, los anticipos entre directivos, el
presupuesto de gestión frente al aprobado en asamblea—, que es como está pensado
aquí.

Lo que el diseño **no** incluye, y conviene decirlo una vez: nada orientado a
que un registro sea inaccesible o no deje rastro. Todo lo que entre en el libro
interno pasa por `audit_log` igual que el resto, y el permiso que lo protege
oculta información a un rol, no la borra. Qué se registra en cada libro es
decisión del club.

---

## La idea que sostiene el módulo

Cuatro sub-módulos que se tocan. El error sería hacer cuatro tablas
independientes; lo que los une es que **las cuatro cosas se clasifican con la
misma dimensión**: una línea de presupuesto, una factura y un apunte bancario
hablan todos de "material deportivo" o de "cuotas".

Por eso hay una tabla de categorías compartida, y por eso es posible el informe
que de verdad quiere un tesorero:

| Categoría | Presupuestado | Devengado (facturas) | Caja (banco) | Desviación |
|---|---|---|---|---|

Las dos columnas centrales son preguntas distintas —compromiso frente a caja— y
un club necesita las dos: "lo he gastado" y "ha salido del banco" no ocurren el
mismo día. Ese informe es lo que justifica que estas cuatro piezas vivan juntas
en vez de ser cuatro listados sueltos.

---

## Decisiones de diseño

### 1. Categorías en tabla, no `pgEnum` — primera excepción deliberada

`economic_categories` con `kind: income | expense`. En todo el proyecto no hay un
solo catálogo editable por el usuario, y romper esa costumbre necesita
justificación: **un presupuesto con categorías fijas no es usable**. La junta
añade "subvención de la diputación" o "gastos de la txosna" y no puede esperar a
un despliegue. Se siembran unas cuantas y se retiran con `isActive`, nunca
borrando, para no romper el histórico.

### 2. El ámbito contable es una columna, con permisos propios por libro

`ledger` en `financial_accounts`, `account_movements`, `received_invoices`,
`issued_invoices` y `season_budgets`.

**Cada libro tiene su propio par de permisos**, ortogonales y no jerárquicos,
igual que `personas.medical.*` frente a `personas.banking.*`:

```
economia.official.view     economia.official.manage
economia.internal.view     economia.internal.manage
```

No hay un `economia.view` general. Así, quien consulta el presupuesto oficial
desde fuera de la junta (un socio, un auditor, un patrocinador) lleva
únicamente `economia.official.view` y **el libro interno no existe para él**: ni
en el selector, ni en los totales, ni en las exportaciones. Y a la inversa, ver
un libro no da derecho a escribirlo.

Cuatro reglas sin excepción:

- **Ningún total agrega los dos libros.** Solo una vista "consolidado" —visible
  únicamente con las dos `view`— los enseña, en columnas separadas y
  etiquetadas.
- **El filtro va en servidor.** Un helper `visibleLedgers(user)` en
  `src/lib/economia.ts` deriva de los permisos qué libros entran en el `where`
  de **toda** query del módulo. Nada de ocultar en cliente — y hay precedente de
  que eso falla: `src/lib/person-list.ts:221` serializa el IBAN al cliente para
  cualquiera con `personas.view`, aunque no lo pinte (ver "Aparte", al final).
- **Escribir se comprueba contra el libro de la fila**, no contra un permiso
  global. Y si una edición cambia el `ledger` de una fila, hacen falta las dos
  `manage`: mover un apunte de un libro a otro es un alta y una baja.
- **El libro interno se ve a la legua.** Badge permanente en la cabecera del
  módulo y el libro en la URL (`?libro=`). Con un solo libro visible no se pinta
  selector.

Se aplica en las seis capas que el proyecto ya usa para lo médico y lo bancario:
nav, listado, ficha, diálogo, Server Action y proxy de storage. Añadir permisos
no lleva migración, solo `src/lib/permissions.ts` + `PERMISSION_MODULES` +
traducción con guiones bajos (`permissionKey` aplana los puntos:
`economia_official_view`).

**Consecuencia en storage que hay que respetar**: `BUCKET_READ_PERMISSION`
(`src/app/api/storage/[bucket]/[...path]/route.ts:19`) mapea **un bucket a un
solo permiso**. Si los PDF de los dos libros comparten bucket, quien solo tiene
`economia.official.view` podría descargar una factura interna. Por eso van **dos
buckets**, `invoice-files` e `invoice-files-internal`, cada uno con su permiso
en el mapa y en la tabla de políticas de `supabase/setup.sql`.

Presets de rol de fábrica: `admin` con los cuatro; `staff` solo con el par
`official`; el resto sin ninguno. La junta se modela como un rol al que se le
marcan los `internal` desde la matriz de administración.

### 3. Hacen falta cuentas

`financial_accounts` con `kind: bank | cash`. "Movimientos bancarios" presupone
al menos una cuenta, y un club tiene dos o tres: la principal, a veces una de
eventos/lotería, y la caja de efectivo — que es justamente donde vive buena
parte de la contabilidad de gestión. El saldo solo significa algo por cuenta, así
que `openingBalanceCents`/`openingBalanceOn` van aquí.

### 4. La temporada se resuelve con `seasonYearOf`, no con las fechas de `seasons`

`seasons.startsOn`/`endsOn` son nullable y **el seed base las deja vacías**
(`src/db/seed.ts:20`). El código que depende de ellas falla en silencio:
`carne/page.tsx:76` descarta la fila si `startsOn` es NULL, y `cuotas/actions.ts:112`
se salta la generación de periodos mensuales sin avisar.

El resto del proyecto no las usa: usa `seasonYearOf(date)` / `seasonLabel(year)`
de `src/lib/sponsorship.ts` (temporada sep–ago derivada aritméticamente).
**Esa es la vía.** El `seasonId` se guarda explícito en cada movimiento y
factura, resuelto al importar con `seasonYearOf` y editable después.

### 5. La conciliación es N:M con importe propio

`movement_links`: `movementId` + `amountCents` + exactamente uno de
`receivedInvoiceId` / `issuedInvoiceId` / `sepaRemittanceId` /
`sponsorPaymentId`, con `check` XOR como el que ya tiene `sepa_charges`
(`schema.ts:1313`).

Un `movementId` en la factura no modela la realidad: una transferencia paga
varias facturas, una factura se paga a plazos, y —lo confirma la exploración— una
remesa SEPA entra en el extracto como **un solo apunte agregado** mientras sus
devoluciones entran como apuntes negativos sueltos.

Estado de conciliación **derivado, no almacenado**: `suma(enlaces)` frente a
`amountCents` da pendiente / parcial / conciliado. Guardarlo sería un caché que
se desincroniza al primer borrado.

### 6. `sepa_remittances` necesita su agregado — y es la pieza que falta

Éste es el hallazgo que más condiciona la conciliación de ingresos. El banco
abona una remesa como un apunte único, pero Areto solo guarda N filas de cargo
con el mismo `collectedOn`, y **`sepa_remittances` no tiene importe total, ni
fecha real de abono, ni estado**. Peor: al devolverse un cargo, `updateChargeStatus`
le pone `remittanceId: null` (`cuotas/actions.ts:415-466`), así que **el vínculo
cargo↔remesa se pierde** y el agregado deja de poder reconstruirse sumando.

Arreglo, barato y necesario: añadir `totalCents` a `sepa_remittances`, calculado
y congelado al generar la remesa, más `settledOn`. Sin eso no hay nada a lo que
enlazar el apunte bancario de ingreso.

### 7. Las facturas emitidas absorben las de patrocinio (expand/contract)

**Un club no puede tener dos libros de facturas emitidas compartiendo
numeración.** La auditoría pide uno. `issued_invoices` pasa a ser el registro
único: crear la tabla → backfill desde `sponsor_payments` donde hay
`invoiceNumber` → añadir `issuedInvoiceId` a `sponsor_payments` → convertir
`/patrocinadores/facturas` en vista filtrada del registro nuevo → y solo en un
PR posterior retirar las columnas viejas.

Tres agujeros del modelo actual que hay que cerrar en ese mismo PR, porque son
incompatibles con un libro fiscal:

- **`deleteSponsorPayment` (`patrocinadores/actions.ts:612`) borra la anualidad
  sin mirar `invoiceNumber`**, destruyendo una factura emitida y dejando un hueco
  permanente en la numeración. Una factura emitida no se borra: se rectifica.
- **`nextInvoiceNumber` y el `UPDATE` no están en transacción**
  (`club.ts:101` + `actions.ts:677`): si el update falla, el número se quema.
- **No existe anulación ni rectificativa.** Hace falta `status: issued |
  rectified | cancelled` y una FK `rectifiesInvoiceId`.

El destinatario se guarda **desnormalizado** (`customerName`, `customerTaxId`,
`customerAddress`) con FK opcional a `sponsors`/`persons`. Hoy el recibo lee el
nombre fiscal en vivo, así que renombrar la empresa reescribe facturas pasadas —
exactamente lo que no debe pasar. Una factura congela los datos del cliente.

`invoice_counters` se reutiliza tal cual: es anual, atómico y agnóstico del
origen.

### 8. Desglose fiscal: base + IVA + retención + total

En las dos direcciones; hoy no hay ninguno (el recibo de patrocinio emite con
leyenda de exención). La **retención de IRPF** es específica de un club: árbitros,
preparador externo y gestoría facturan con retención, y sin esa columna el
importe pagado nunca cuadra con el extracto — que es justo lo que este módulo
resuelve. `totalCents` se guarda explícito en vez de derivarse: las facturas
reales no siempre cuadran al céntimo y la fila refleja el papel.

Sin líneas de detalle por factura: un club no las necesita y multiplican la UI.

### 9. Importación: Norma 43, con huella para no duplicar

Es lo que dan todos los bancos españoles. Ancho fijo, registros 11/22/23/33/88;
unas 150 líneas de parser a mano — no hay dependencia de parseo y `importSponsors`
(`patrocinadores/actions.ts:872`) ya parsea a mano.

**Es el punto técnicamente más delicado**, por dos motivos: el concepto viene
troceado en registros 23 complementarios, y el fichero suele venir en latin-1.

N43 no trae identificador de línea, así que la deduplicación al reimportar va por
huella: hash de `(accountId, bookedOn, amountCents, concepto normalizado, ordinal
dentro del día)`, con único `(accountId, fingerprint)`. El ordinal es lo que
evita colapsar dos apuntes idénticos legítimos del mismo día.

### 10. Los PDF, por `PrintableSheet`, no por `pdf-lib`

`pdf-lib` está en el proyecto pero solo rellena plantillas AcroForm
(`src/lib/injury-report-fields.ts`); no tiene layout, obligaría a posicionar por
coordenadas y trae solo las 14 fuentes estándar. El proyecto ya emite documentos
como **HTML A4 imprimible** (`PrintableSheet`: 210×297mm, escala en pt) y así se
hacen el recibo de patrocinio, el libro y los carnés. Se sigue esa vía.

---

## Esquema

Convenciones (`src/db/schema.ts`): identificadores TS en inglés, comentarios en
castellano, `uuid().primaryKey().defaultRandom()`, dinero en `integer` de
céntimos, `.enableRLS()`, sin soft-delete, sin `clubId`.

```
ledger                pgEnum: official | internal
economicCategoryKind  pgEnum: income | expense
movementSource        pgEnum: import | manual
receivedInvoiceStatus pgEnum: pending | paid | disputed
issuedInvoiceStatus   pgEnum: issued | rectified | cancelled
invoiceSource         pgEnum: manual | extracted      ← gancho del agente futuro
budgetStatus          pgEnum: draft | approved

economic_categories   kind, name, isActive, sortOrder
financial_accounts    name, kind(bank|cash), iban, ledger, opening*, isActive
account_movements     accountId→restrict, ledger, seasonId→restrict,
                      bookedOn, valueOn, amountCents(con signo), concept,
                      counterparty, balanceCents, categoryId→set null,
                      source, importBatchId→set null, fingerprint, notes
                      unique(accountId, fingerprint); idx (accountId, bookedOn)
movement_import_batches  accountId, fileName, format, importedAt,
                      importedByUserId, rowCount, fromDate, toDate
suppliers             name, taxId(unique parcial), iban, contacto,
                      defaultCategoryId, notes
received_invoices     supplierId→restrict, ledger, seasonId→restrict,
                      teamId→set null, invoiceNumber, issuedOn, dueDate,
                      categoryId, description, base/vat/withholding/totalCents,
                      status, source, filePath, fileName, notes
                      unique parcial (supplierId, invoiceNumber)
issued_invoices       number(unique), ledger, seasonId, issuedOn, dueDate,
                      customerName/TaxId/Address, sponsorId?, personId?,
                      categoryId, concept, base/vat/withholding/totalCents,
                      status, rectifiesInvoiceId?, filePath, notes
movement_links        movementId→cascade, amountCents,
                      XOR(receivedInvoiceId, issuedInvoiceId,
                          sepaRemittanceId, sponsorPaymentId)
season_budgets        seasonId, ledger, status, approvedOn, notes
                      unique(seasonId, ledger)
budget_lines          budgetId→cascade, categoryId, plannedCents, notes
                      unique(budgetId, categoryId)

ALTER  sepa_remittances  + totalCents, + settledOn        (ver decisión 6)
ALTER  sponsor_payments  + issuedInvoiceId                (ver decisión 7)
```

Más el bloque `relations()` al final del fichero.

---

## Rutas y layout

Módulo `/economia` con sub-navegación de siete páginas:

**Resumen · Presupuesto · Movimientos · Recibidas · Emitidas · Proveedores · Cuentas**

```
src/app/[locale]/(app)/economia/
  page.tsx                     Resumen: saldos por cuenta, presupuesto vs real,
                               pendiente de conciliar, vencimientos próximos
  movimientos/{page,loading,actions}.tsx  + importar/ + [movementId]/
  recibidas/{page,loading,actions}.tsx    + nueva/ + [invoiceId]/ + libro/
  emitidas/{page,loading,actions}.tsx     + nueva/ + [invoiceId]/ + libro/
  proveedores/{page,loading,actions}.tsx  + [supplierId]/
  presupuesto/{page,loading,actions}.tsx
  cuentas/{page,loading,actions}.tsx      cuentas + categorías
```

**Sub-navegación**: se copia `src/components/administracion/admin-section-nav.tsx`,
que es el único precedente real y está resuelto a conciencia — Server Component
`async` (no cliente: leer `usePathname` obligaría a un límite de cliente y un
`<Suspense>`), pestaña activa por prop `current` tipada como unión literal que
cada página se autodeclara, items con spread condicional por permiso, y
`aria-current` + `border-b-2` para marcar la activa. Como ya hay una barra
subrayada, cualquier pestaña de segundo nivel usa `TabsList variant="default"`
(píldoras): dos filas idénticas se leerían como el mismo nivel.

**Gráficas**: `ui/chart.tsx` (shadcn) + recharts, siguiendo el patrón exacto de
las dos existentes — componente cliente **tonto** que solo recibe
`{data, config, locale}`, toda la agregación y el `ChartConfig` con etiquetas ya
traducidas en el Server Component, colores **siempre** por token
`var(--chart-1..5)`, orden categórico fijo (nunca reordenar por valor) e importes
en euros formateados con `currencyFormatter`.

**Resumen y dashboard**: el dashboard no tiene hoy ni un solo importe, así que el
Resumen del módulo es donde vive todo. Cualquier sección que lea el reloj hace
`await connection()` primero — con Cache Components el prerender congelaría "hoy",
y está comentado así en las tres secciones del dashboard.

Cada ruta con su `loading.tsx` **con la geometría de su página**. Los libros
imprimibles reservan hoja con `PrintableSheetSkeleton`.

Se reutiliza sin tocar: `PageHeader`/`SectionHeading`, `StatTile`, `StatusBadge`
+ `status-tone.ts`, `FiltersBar`, `SearchInput`, `PaginationBar` +
`usePagedRows`, `useFilterParams`/`useSearchText`, `useTabParam`, `ExportMenu`
(+ `csv.ts`, `xlsx.ts`), `FormError`, `SubmitButton`, `useActionToast`,
`DeleteEntityDialog`, `PrintableSheet`, `formatCents`/`readAmountCents`,
`seasonYearOf`/`seasonLabel`, `entity-notes.ts`, `supabase/storage.ts`,
`skeletons.tsx`, `audit-log.ts`, `back-href.ts`.

Storage: dos buckets privados, `invoice-files` e `invoice-files-internal` (ver
decisión 2), declarados en `supabase/setup.sql` (bucket ~l. 187 + política en el
bucle `do $policies$` ~l. 242, con `economia.official.view`/`.manage` y
`economia.internal.view`/`.manage` respectivamente) y en
`BUCKET_READ_PERMISSION` de `src/app/api/storage/[bucket]/[...path]/route.ts`.

Volumen real (del seed y del comentario `assertScratchDatabase`): ~200 personas,
10 equipos, 14 patrocinadores, y del orden de **600 cargos SEPA por temporada**
si se generasen. Es pequeño: filtrado y paginación **en cliente** con
`usePagedRows`, como patrocinadores, salvo que movimientos crezca mucho.

---

## Reparto en PRs

Demasiado para un PR. Cada uno queda usable por sí solo. **Y van en serie, no en
paralelo**: los seis tocan `src/db/schema.ts`, y la regla del proyecto es que
solo una rama abierta a la vez toque el esquema (dos generarían el mismo número
de migración).

1. **Cimientos** — `ledger`, `economic_categories`, `financial_accounts`, los
   cuatro permisos por libro y `visibleLedgers()`, entrada de nav en el grupo
   `economico`, shell de `/economia` con sub-navegación y selector de libro,
   páginas de Cuentas y Categorías.
2. **Movimientos** — tabla, alta manual, listado con filtros y saldos. Sin
   importador.
3. **Importación** — parser Norma 43 + CSV, lotes, huella y deduplicación.
4. **Facturas recibidas** — proveedores, facturas, adjunto, libro, y el panel de
   conciliación contra movimientos (`movement_links`).
5. **Facturas emitidas** — registro único, absorción de las de patrocinio
   (expand: backfill + FK), cierre de los tres agujeros de la decisión 7, y
   `sepa_remittances.totalCents`/`settledOn` de la decisión 6.
6. **Presupuesto** — `season_budgets`/`budget_lines` y el informe presupuesto vs
   devengado vs caja.

Un PR posterior de *contract*: retirar `invoiceNumber`/`invoicedOn` de
`sponsor_payments`.

Rama `feat/…` por PR, creada **antes del primer commit** (`main` está protegida).

---

## Verificación

Por cada PR:

- `pnpm run db:generate` → **leer el `.sql` generado** antes de aplicar →
  `pnpm run db:migrate`. La migración y `drizzle/meta/` van en el mismo PR.
- `pnpm run lint` (las cuatro reglas propias entran como `error` y el árbol está
  limpio: cualquier aviso es nuevo) y `pnpm run typecheck`.
- `pnpm run build` — obligatorio, única forma fiable de detectar errores de Cache
  Components al añadir lecturas de datos en páginas nuevas.
- Concurrencia: ninguna agregación (presupuesto vs real, saldos por cuenta) va
  dentro del mismo `Promise.all` que las queries directas — a su propio `await` o
  a su `<Suspense>`. Es el patrón que ya colgó el dashboard una vez.

Pruebas end-to-end:

- Importar dos veces el mismo N43 → la segunda no crea ningún apunte duplicado y
  el lote queda registrado. Probar con fichero real en latin-1 y con dos apuntes
  idénticos el mismo día (no deben colapsar).
- Factura recibida con PDF, enlazada parcialmente a un apunte → "parcial";
  completar → "conciliado"; borrar el enlace → vuelve a "pendiente".
- Emitir factura → número correlativo sin huecos; intentar borrar una facturada
  → se rechaza; rectificarla → la rectificativa apunta a la original.
- Remesa SEPA con una devolución → el `totalCents` congelado sigue cuadrando con
  el apunte agregado del banco aunque el cargo devuelto haya perdido su
  `remittanceId`.
- Presupuestar una categoría y comprobar que el informe la cuadra contra facturas
  y contra banco **por separado**.
- Rol con **solo** `economia.official.view` (el caso de la consulta al
  presupuesto oficial desde fuera de la junta): no ve el selector de libro, ni
  una sola fila `internal`, sus totales y exportaciones no las incluyen,
  `?libro=internal` a mano no devuelve nada, no ve la vista consolidada, y el
  proxy de storage le da 403 sobre `invoice-files-internal`. Con
  `economia.official.view` pero sin `.manage`, ninguna acción de escritura pasa.
- Editar una fila cambiándole el `ledger` teniendo solo una de las dos `manage`
  → se rechaza.
- Vista previa de impresión de los dos libros (convención del proyecto).

**Datos de prueba**: `seed-demo.ts` **no genera ni un `sepaCharge` ni una
`sepaRemittance`**. Sin eso no se puede probar la conciliación de ingresos, así
que el PR 5 tiene que ampliar el seed.

---

## Aparte, sin tocar

`src/lib/person-list.ts:221` incluye `iban: true` en las columnas de `loadRows()`
y `personas-browser.tsx:71` lo declara en el tipo de fila, así que **el IBAN se
serializa al cliente para cualquiera con `personas.view`**, tenga o no
`personas.banking.view`. No se pinta en ninguna celda, pero viaja. La ficha lo
hace bien (`[personId]/page.tsx:359` ni consulta el mandato sin permiso). Es
ajeno a este módulo y no lo toco, pero conviene saberlo — y es el motivo de que
la regla del libro interno sea filtrar en servidor.
