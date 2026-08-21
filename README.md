# Areto

Aplicación web para la **gestión de un club de fútbol sala**: personas, equipos,
calendario, cuotas y comunicación en una sola herramienta.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (base-ui, estilo `nova`)
- **PostgreSQL** + **Drizzle ORM**
- **Supabase Auth** (email+contraseña + Google OAuth) con roles

## Entornos

El proyecto usa **dos proyectos Supabase separados**:

- **producción**: datos reales de socios y jugadores. Solo lo usa el entorno
  "Production" de Vercel.
- **areto-dev**: usado en local (`.env.local`) y por los entornos "Preview" y
  "Development" de Vercel (incluidos los Preview Deployments de cada PR).

Nunca apuntes `.env.local` al proyecto de producción. Ver [Puesta en
marcha](#puesta-en-marcha) para crear `areto-dev`.

Los PRs a `main` corren CI (`.github/workflows/ci.yml`): lint, typecheck,
`db:migrate` contra `areto-dev` y `next build`. Las migraciones a producción
se disparan a mano con el workflow `migrate-prod.yml` tras mergear.

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
4. Configura la autenticación (ver [Autenticación](#autenticación) más abajo):
   ejecuta `supabase/setup.sql` en el SQL Editor de Supabase y activa Google.
5. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Abre <http://localhost:3000>.

> La app arranca aunque Supabase no esté configurado: la landing pública funciona
> y las rutas internas redirigen a `/login`.

## Autenticación

Auth con **Supabase** (email+contraseña y Google OAuth). Los roles
(`admin` · `staff` · `coach` · `member`) viven en la tabla de perfil `users`,
enlazada por `id` con `auth.users`.

Pasos tras crear el proyecto Supabase:

1. **Esquema de auth**: ejecuta `supabase/setup.sql` en el SQL Editor. Crea el
   trigger que genera el perfil al registrarse (rol `member`) y activa RLS.
2. **Google OAuth**: en Supabase → Authentication → Providers → Google, añade las
   credenciales de Google Cloud y la URL de callback
   `https://[ref].supabase.co/auth/v1/callback`.
3. **Primer admin**: regístrate en `/login` y promociona tu usuario:
   ```sql
   update public.users
   set role = 'admin'
   where email = 'tu-email@ejemplo.com';
   ```

La autorización en servidor se hace con los helpers de `src/lib/auth.ts`
(`getCurrentUser`, `requireUser`, `requireRole`). El refresco de sesión y la
protección de rutas está en `src/proxy.ts`.

## Scripts

| Script            | Descripción                                            |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Servidor de desarrollo                                 |
| `npm run build`   | Build de producción                                    |
| `npm run db:generate` | Genera archivos de migración SQL desde el esquema  |
| `npm run db:migrate`  | Aplica las migraciones                             |
| `npm run db:push`     | Empuja el esquema directamente (rápido en dev)     |
| `npm run db:studio`   | Abre Drizzle Studio (explorador de la BD)          |
| `npm run db:seed`     | Datos iniciales (temporada y equipos de ejemplo)   |

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
│  └─ seed.ts             # Datos iniciales
└─ lib/utils.ts
```

## Modelo de datos

Aplicación de club único: `seasons`, `teams`, `persons`, `memberships`,
`events`, `attendances`, `fees`, `payments`, `announcements`, `users`. Sin capa
de multi-club ni catálogo de deportes — todo el modelo es específico de fútbol
sala.

**Temporadas:** la gestión es multi-temporada. `seasons` es el ancla de la que
cuelgan `teams.seasonId` y `fees.seasonId` — cada temporada tiene sus propios
equipos, jugadores (vía `memberships` → `teams`) y economía. Una única
temporada puede tener `isCurrent = true` (índice único parcial); la UI filtra
por ella por defecto y permite consultar temporadas pasadas.

## Roadmap

1. ✅ Cimientos: proyecto, UI, esquema de datos.
2. ✅ Autenticación con roles (admin / staff / coach / member).
3. CRUD de personas y equipos.
4. Calendario y convocatorias.
5. Económico + integración con Stripe.
6. Portal público (resultados y avisos).
7. Estadísticas de competición.
