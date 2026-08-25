# Areto

Aplicación web para la **gestión de un club de fútbol sala**: personas, equipos,
calendario, cuotas y comunicación en una sola herramienta.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (base-ui, estilo `nova`)
- **PostgreSQL** + **Drizzle ORM**
- **Supabase Auth** (email+contraseña) con roles

## Entornos

El proyecto usa **dos proyectos Supabase separados**:

- **producción**: datos reales de socios y jugadores. Solo lo usa el entorno
  "Production" de Vercel.
- **areto-dev**: usado en local (`.env.local`) y por los entornos "Preview" y
  "Development" de Vercel (incluidos los Preview Deployments de cada PR).

Nunca apuntes `.env.local` al proyecto de producción. Ver [Puesta en
marcha](#puesta-en-marcha) para crear `areto-dev`.

Los PRs a `main` corren CI (`.github/workflows/ci.yml`): lint, typecheck,
`db:check`, comprobación de que `src/db/schema.ts` no tiene cambios sin
migración generada, `db:migrate` contra `areto-dev` y `next build`.

Las migraciones a producción se aplican **automáticamente al mergear** un PR
que traiga ficheros en `drizzle/` (`migrate-prod.yml`, que hace un backup
cifrado justo antes). El mismo workflow sigue siendo lanzable a mano desde
Actions para relanzarlo tras un fallo. El disparo es el push a `main` y no el
final del despliegue por una razón concreta: con `cacheComponents: true`,
`next build` ejecuta consultas reales, así que el esquema nuevo tiene que
estar aplicado antes de que Vercel termine de construir el código nuevo. Si
alguna vez el build sale antes que la migración, falla, producción sigue
sirviendo el despliegue anterior y basta con pulsar Redeploy en Vercel.

## Flujo de trabajo (ramas y PRs)

La rama `main` está **protegida**: no se puede empujar directamente a ella.
Todo desarrollo va en su propia rama y entra a `main` mediante un Pull Request:

```bash
git switch -c feat/nombre-corto   # o fix/…, chore/…
# … trabajo, commits …
git push -u origin feat/nombre-corto
```

Abre el PR contra `main` en GitHub, espera a que pase el CI y mergéalo. El PR
genera además un Preview Deployment en Vercel (contra `areto-dev`) para probar
los cambios antes de mergear.

El procedimiento detallado (comandos, decisión expand/contract al tocar el
esquema y recetas para cuando algo falla) vive en
`.claude/skills/desarrollar-funcionalidad/`, como skill de Claude Code.

## Puesta en marcha

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Crea un proyecto en [Supabase](https://supabase.com) llamado, por ejemplo,
   `areto-dev` (nunca reutilices el de producción para desarrollo local) y
   configura el entorno. Copia el ejemplo y rellena `DATABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_URL` y la clave pública:
   ```bash
   cp .env.example .env.local
   ```
3. Crea el esquema en la base de datos y siembra datos iniciales:
   ```bash
   npm run db:push
   npm run db:seed
   ```
   Con eso la app arranca, pero casi todas las pantallas salen vacías. Para
   trabajar con un club entero inventado (plantillas, socios, patrocinadores,
   calendario, inscripciones) siembra además el juego de demostración:
   ```bash
   npm run db:seed:demo
   ```
4. Configura la autenticación (ver [Autenticación](#autenticación) más abajo):
   ejecuta `supabase/setup.sql` en el SQL Editor de Supabase.
5. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Abre <http://localhost:3000>.

> La app arranca aunque Supabase no esté configurado: la landing pública funciona
> y las rutas internas redirigen a `/login`.

### Red corporativa y puerto 6543

Si al abrir cualquier página que lea datos ves un 500 con este error:

```
Failed query: select ... from "club_settings"
[cause]: write CONNECT_TIMEOUT aws-N-[region].pooler.supabase.com:6543
```

no es un problema del proyecto ni de Supabase: hay una red que **filtra toda
salida TCP que no sea 80/443**. Auth y Storage siguen funcionando (van por HTTPS
al dominio `[ref].supabase.co`), pero la conexión Postgres de Drizzle
(`src/db/index.ts`) no puede abrirse. Para comprobarlo:

```powershell
Test-NetConnection aws-1-eu-west-1.pooler.supabase.com -Port 6543   # falla
Test-NetConnection aws-1-eu-west-1.pooler.supabase.com -Port 443    # conecta
```

**Solución definitiva:** pedir al departamento de Sistemas la apertura de los
puertos 6543 y 5432 salientes hacia `*.pooler.supabase.com`.

**Apaño mientras tanto:** conectar un hotspot móvil y enrutar por él *solo* el
tráfico al pooler, con `scripts/dev-route-supabase.ps1`:

```powershell
# 1. Conecta el hotspot (sin desconectar el cable corporativo).
# 2. En PowerShell COMO ADMINISTRADOR, en la raíz del repo:
npm run dev:route
# 3. En tu terminal habitual:
npm run dev
```

El script crea rutas `/32` hacia las IPs actuales del pooler por el adaptador
Wi-Fi, así que el resto del tráfico —incluida la red interna— sigue saliendo por
el cable. Detalles a tener en cuenta:

- Las IPs del pooler son de un balanceador de AWS y **rotan**. Si vuelve el
  `CONNECT_TIMEOUT`, lo primero es re-ejecutar `npm run dev:route`.
- Reconectar el hotspot cambia el gateway → re-ejecutar.
- `postgres-js` reutiliza la conexión entre recargas, así que las rutas deben
  estar puestas **antes** de arrancar `next dev`; si no, reinicia el servidor.
- Para deshacerlo:
  `powershell -File scripts/dev-route-supabase.ps1 -Remove`.

Conectar el portátil corporativo a una red ajena conviene contrastarlo antes con
Sistemas, por si la política interna no permite el *dual-homing*.

## Autenticación y acceso

Auth con **Supabase** (email+contraseña). El acceso a la
aplicación es **por invitación**: no hay alta pública. Un administrador invita
desde `/administracion/usuarios` y la persona recibe un correo con un enlace
para poner su contraseña.

### Roles y permisos

Los roles viven en la tabla `roles` y se crean y editan desde
`/administracion/roles`. El club arranca con cuatro de fábrica —Administrador,
Secretaría, Entrenador y Socio—, que no se pueden borrar pero cuyos permisos sí
se ajustan.

El **catálogo de permisos** está en el código (`src/lib/permissions.ts`), no en
la base de datos: un permiso solo significa algo si hay un
`requirePermission()` que lo comprueba. La base de datos guarda únicamente qué
rol tiene cuál (`role_permissions`). Añadir un permiso nuevo es tocar ese array
y sus traducciones; no hace falta migración.

La autorización en servidor se hace con los helpers de `src/lib/auth.ts`
(`getCurrentUser`, `requireUser`, `requirePermission`, `hasPermission`). El
refresco de sesión y el corte de las rutas privadas está en `src/proxy.ts`, que
solo comprueba que haya sesión: los permisos se miran en cada página y en cada
Server Action, y el estado de la cuenta (activa, pendiente o desactivada) lo
comprueba `requireUser` en cada petición.

### Puesta en marcha del proyecto Supabase

1. **Migraciones primero**: `npm run db:migrate` (crea `roles`,
   `role_permissions` y siembra los cuatro roles de fábrica).
2. **Esquema de auth**: ejecuta `supabase/setup.sql` en el SQL Editor. Crea el
   trigger que genera el perfil al registrarse, publica
   `public.user_has_permission()` y escribe con ella las políticas de Storage.
   El propio fichero falla en claro si lo lanzas antes que las migraciones.
3. **Ajustes del dashboard** que el SQL no puede hacer, y sin los cuales las
   invitaciones no llegan: plantillas de correo apuntando a `/auth/confirm`,
   `/auth/confirm` en la lista de *Redirect URLs*, "Allow new users to sign up"
   apagado y un SMTP propio. Están detallados en la cabecera de
   `supabase/setup.sql`.
4. **Primer administrador**: regístrate una vez en `/login` y promociónate a
   mano (es la última operación en SQL que queda; a partir de ahí, el alta del
   resto se hace desde la aplicación):
   ```sql
   update public.users
   set role_id = (select id from public.roles where key = 'admin'),
       status  = 'active'
   where email = 'tu-email@ejemplo.com';
   ```

## Scripts

| Script            | Descripción                                            |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Servidor de desarrollo                                 |
| `npm run build`   | Build de producción                                    |
| `npm run db:generate` | Genera archivos de migración SQL desde el esquema  |
| `npm run db:migrate`  | Aplica las migraciones                             |
| `npm run db:check`    | Valida el historial de migraciones (colisiones)    |
| `npm run db:push`     | Empuja el esquema directamente (rápido en dev)     |
| `npm run db:studio`   | Abre Drizzle Studio (explorador de la BD)          |
| `npm run db:seed`     | Datos iniciales (temporada y equipos de ejemplo)   |
| `npm run db:seed:demo` | Juego de datos completo inventado, para desarrollo |

### Datos de demostración

`npm run db:seed:demo` llena `areto-dev` con un club entero inventado —dos
temporadas, seis equipos, 116 personas con sus tutores, 39 socios, 14
patrocinadores con sus facturas, la temporada de cancha y once inscripciones—
para poder ver las pantallas con datos delante en vez de vacías.

Todo es inventado: los nombres, los DNI, los IBAN y las empresas los genera
`src/db/seed-data.ts`, y los DNI e IBAN llevan su dígito de control correcto
para que la app no los marque como erróneos. Los emails van sobre el dominio
reservado `.test`, que no resuelve.

- Cada fila lleva un id determinista, así que el seed reconoce lo suyo: correrlo
  dos veces deja exactamente el mismo estado y no duplica nada.
- `npm run db:seed:demo -- --clean` borra lo que sembró y no siembra nada.
- Corta si la base de datos tiene más de 25 fichas que no son del seed (eso son
  datos de verdad, no un entorno de pruebas). `-- --force` se lo salta.
- Siembra cinco incoherencias a propósito (fichas sin DNI, dorsales duplicados,
  dos capitanes, un jugador huérfano y un duplicado por errata) para que las
  tarjetas del dashboard y los avisos de plantilla se puedan probar. Están
  numeradas en la cabecera de `src/db/seed-demo.ts`.

## Estructura

```
src/
├─ app/
│  ├─ page.tsx            # Portal público (landing)
│  ├─ layout.tsx          # Layout raíz
│  └─ (app)/              # App interna (con barra lateral)
│     ├─ layout.tsx
│     ├─ dashboard/
│     ├─ personas/
│     ├─ equipos/
│     ├─ calendario/
│     ├─ cuotas/
│     └─ avisos/
├─ components/
│  ├─ app-sidebar.tsx     # Navegación de la app interna
│  ├─ section-placeholder.tsx
│  └─ ui/                 # Componentes shadcn/ui
├─ db/
│  ├─ schema.ts           # Esquema de datos
│  ├─ index.ts            # Cliente de base de datos
│  ├─ seed.ts             # Datos iniciales
│  ├─ seed-demo.ts        # Juego de datos de demostración
│  └─ seed-data.ts        # Catálogos y generadores del seed de demostración
└─ lib/utils.ts
```

## Modelo de datos

Aplicación de club único: `seasons`, `teams`, `persons`, `memberships`,
`events`, `attendances`, `fees`, `payments`, `announcements`, `users`, `roles`
y `role_permissions`. Sin capa de multi-club ni catálogo de deportes — todo el
modelo es específico de fútbol sala.

**Temporadas:** la gestión es multi-temporada. `seasons` es el ancla de la que
cuelgan `teams.seasonId` y `fees.seasonId` — cada temporada tiene sus propios
equipos, jugadores (vía `memberships` → `teams`) y economía. Una única
temporada puede tener `isCurrent = true` (índice único parcial); la UI filtra
por ella por defecto y permite consultar temporadas pasadas.

## Roadmap

1. ✅ Cimientos: proyecto, UI, esquema de datos.
2. ✅ Autenticación, roles editables y gestión de usuarios.
3. CRUD de personas y equipos.
4. Calendario y convocatorias.
5. Económico + integración con Stripe.
6. Portal público (resultados y avisos).
7. Estadísticas de competición.
