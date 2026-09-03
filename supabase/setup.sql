-- ============================================================================
-- Areto · Configuración de Supabase Auth ↔ tabla de perfil `public.users`
-- ============================================================================
-- Ejecuta este script en el SQL Editor de Supabase, DESPUÉS de haber aplicado
-- las migraciones de Drizzle (`npm run db:migrate`). Es idempotente: se puede
-- reejecutar entero tantas veces como haga falta.
--
-- Qué hace:
--   1. Crea el trigger que, al aparecer un usuario en Supabase Auth, inserta su
--      fila de perfil en `public.users` con el rol por defecto y el estado
--      `pending` (sin acceso hasta que alguien lo active).
--   2. Activa RLS en `public.users` y permite a cada usuario leer su propio
--      perfil (las escrituras de la app van por el servidor con Drizzle).
--   3. Publica `public.user_has_permission(text)` y escribe con ella todas las
--      políticas de Storage.
--
-- Nota sobre RLS en el resto de tablas: todas las tablas de `public` tienen
-- RLS activado sin ninguna política propia (lo hace automáticamente una
-- función `rls_auto_enable()` creada directamente en el editor SQL de
-- Supabase, fuera de este repo, como red de seguridad ante cualquier tabla
-- nueva). Esto es intencionado, no un olvido: la aplicación accede a Postgres
-- vía `DATABASE_URL` con un rol que bypassa RLS (`src/db/index.ts`), y toda la
-- autorización real ocurre en las Server Actions vía `requirePermission()`
-- (`src/lib/auth.ts`). Si en el futuro se empieza a consultar Supabase
-- directamente desde el navegador (cliente `anon`/`authenticated`) contra
-- estas tablas, hará falta escribir políticas explícitas en ese momento —
-- hasta entonces, PostgREST devolverá cero filas, que es lo deseado.
--
-- ---------------------------------------------------------------------------
-- CONFIGURACIÓN MANUAL DEL DASHBOARD
-- Esto no lo hace el SQL, y sin ello las invitaciones no funcionan:
--
--   a) Authentication → Email Templates. Hay que tocar TRES plantillas, y en
--      las tres se sustituye el `href` de {{ .ConfirmationURL }} por:
--
--        Invite user     → {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite
--        Magic Link      → {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink
--        Reset Password  → {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery
--
--      Motivo: `inviteUserByEmail` no soporta PKCE (el navegador que invita no
--      es el que acepta la invitación), así que el enlace tiene que llegar a
--      `/auth/confirm`, que verifica el token con `verifyOtp`, y no al
--      `/auth/callback` de OAuth, que hace `exchangeCodeForSession`.
--
--      La de "Magic Link" es fácil de pasar por alto: reenviar una invitación
--      a alguien que ya existe usa `signInWithOtp`, porque `inviteUserByEmail`
--      falla con `email_exists` en cuanto la cuenta está creada. Sin esa
--      plantilla, el reenvío manda a un enlace que no funciona.
--
--      Se usa {{ .RedirectTo }} y no {{ .SiteURL }} a propósito: lleva el
--      `redirectTo` que ha calculado la aplicación a partir de `SITE_URL`, y ya
--      trae el `?next=…` puesto (de ahí que se encadene con `&`). Así el mismo
--      proyecto de Supabase sirve para local y para los Preview Deployments,
--      que tienen dominios distintos; con {{ .SiteURL }} todos los enlaces
--      irían al dominio fijo configurado en el dashboard.
--
--   b) Authentication → URL Configuration → Redirect URLs: añade
--      `http://localhost:3000/**` y el equivalente de preview y producción.
--      Con comodín porque el `redirectTo` que envía la aplicación lleva query
--      (`/auth/confirm?next=…`). Si el destino no está en la lista, Supabase lo
--      ignora, {{ .RedirectTo }} se queda con el Site URL y el enlace no lleva
--      a ninguna parte útil.
--
--   c) Authentication → Sign In / Providers → Email → "Allow new users to sign
--      up" = OFF. Es la barrera de verdad del alta cerrada: con eso, el alta
--      por email de alguien a quien nadie ha invitado falla en el propio
--      Supabase. El estado `pending` del trigger es la red por debajo.
--
--   d) Authentication → Emails → SMTP Settings: configura un SMTP propio
--      (Resend, Brevo, SendGrid…) antes de dar de alta al club entero. El SMTP
--      por defecto de Supabase está limitado a unos pocos correos por hora, así
--      que invitar a veinte personas seguidas no va a funcionar sin esto.
-- ============================================================================

-- 0) Guarda de orden ---------------------------------------------------------
-- Este script da por hecho el esquema de roles y permisos. Si se ejecuta antes
-- que las migraciones, falla aquí y en claro en vez de a mitad.
do $guard$
begin
  if to_regclass('public.role_permissions') is null then
    raise exception
      'Falta la tabla public.role_permissions: aplica antes las migraciones de Drizzle (npm run db:migrate).';
  end if;
  if to_regclass('public.user_roles') is null then
    raise exception
      'Falta la tabla public.user_roles: aplica antes las migraciones de Drizzle (npm run db:migrate).';
  end if;
end $guard$;

-- 1) Trigger: crear perfil al registrarse -------------------------------------
-- La cuenta nace SIN acceso (`pending`) y con el rol marcado como
-- predeterminado. Quien invita desde /administracion/usuarios la pasa a
-- `active` con el rol que corresponda; un alta que no venga de una invitación
-- se queda esperando aprobación.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  default_role_id uuid;
begin
  select id into default_role_id from public.roles where is_default limit 1;

  -- DEUDA EXPAND: `role_id` desaparece de este insert cuando se retire la
  -- columna. La verdad son las filas de `public.user_roles` de abajo.
  insert into public.users (id, email, role_id, status)
  values (new.id, new.email, default_role_id, 'pending')
  on conflict (id) do nothing;

  if default_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, default_role_id)
    on conflict do nothing;
  end if;

  return new;
end;
$fn$;

-- Cierra el aviso "SECURITY DEFINER ejecutable por anon/authenticated" del
-- linter de seguridad de Supabase: al ser una función de trigger (`returns
-- trigger`), Postgres ya rechaza invocarla directamente fuera de su contexto
-- de disparo, así que esto no cambia el comportamiento — solo revoca el
-- `EXECUTE` implícito que PostgREST expone para cualquier función del schema
-- `public`. El disparo del trigger en sí no depende de este permiso.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) RLS en public.users -----------------------------------------------------
alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users for select
  to authenticated
  using ((select auth.uid()) = id);

-- 3) Permisos del usuario de la sesión ---------------------------------------
-- Una sola función, usada por todas las políticas de Storage. Cuatro detalles
-- que no son opcionales:
--
--   · `security definer`: `public.role_permissions` y `public.user_roles` tienen
--     RLS activado y ninguna política, así que una función `invoker` devolvería
--     siempre falso para todo el mundo. La alternativa sería abrir políticas de
--     lectura sobre esas tablas para `authenticated`, pero eso expondría la
--     matriz de permisos entera a través de PostgREST.
--   · `stable`: la política se evalúa por fila de `storage.objects`; sin esto
--     el planificador no puede reutilizar el resultado.
--   · `set search_path = ''` con todos los nombres cualificados: requisito
--     estándar de `security definer`, para que nadie pueda secuestrar la
--     función colocando objetos con el mismo nombre en otro esquema.
--   · `(select auth.uid())`: hace que se evalúe una vez por sentencia en lugar
--     de una vez por fila.
create or replace function public.user_has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  -- Los permisos son la UNIÓN de los de todos sus roles: basta con que UNO de
  -- ellos conceda `perm`. El `exists` corta en el primero que lo haga.
  select exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    where u.id = (select auth.uid())
      and u.status = 'active'
      and rp.permission = perm
  );
$fn$;

revoke execute on function public.user_has_permission(text) from public, anon;
grant execute on function public.user_has_permission(text) to authenticated;

-- 4) Storage: buckets ---------------------------------------------------------
-- Todos privados salvo `sponsorship-logos`: los ficheros privados se sirven con
-- URLs firmadas de corta duración generadas por el servidor tras comprobar la
-- sesión (ver `src/app/api/storage/[bucket]/[...path]/route.ts`).
insert into storage.buckets (id, name, public) values
  ('person-photos',            'person-photos',            false),
  ('person-documents',         'person-documents',         false),
  ('person-qualifications',    'person-qualifications',    false),
  ('person-medical-checkups',  'person-medical-checkups',  false),
  ('person-injury-reports',    'person-injury-reports',    false),
  ('team-documents',           'team-documents',           false),
  ('membership-documents',     'membership-documents',     false),
  ('sponsor-documents',        'sponsor-documents',        false),
  ('sponsorship-contracts',    'sponsorship-contracts',    false),
  ('registration-documents',   'registration-documents',   false),
  -- Plantillas de documentos oficiales que la aplicación rellena (hoy solo el
  -- parte de lesión de la Mutualidad). Privado: es un impreso federativo, no
  -- material público, y `public/` se sirve sin sesión.
  ('document-templates',       'document-templates',       false),
  -- Adjuntos del módulo económico, en DOS buckets —uno por libro— porque
  -- `BUCKET_READ_PERMISSION` mapea un bucket a un solo permiso: si los PDF de
  -- los dos libros compartieran bucket, quien solo tiene
  -- `economia.official.view` podría descargar una factura interna (ver
  -- decisión 2 de `docs/plan-modulo-economico.md`).
  ('invoice-files',            'invoice-files',            false),
  ('invoice-files-internal',   'invoice-files-internal',   false)
on conflict (id) do nothing;

-- `sponsorship-logos` es PÚBLICO a diferencia del resto: los logos no son datos
-- sensibles y se muestran en el muro público de patrocinadores sin sesión. Al
-- ser público, Supabase los sirve por una URL estable y cacheable por el
-- navegador entre visitas (con bucket privado + URL firmada, el token cambia en
-- cada render y cada visita se vuelve a descargar el logo completo — ver
-- `getPublicUrl` en `src/lib/supabase/storage.ts`).
insert into storage.buckets (id, name, public)
values ('sponsorship-logos', 'sponsorship-logos', true)
on conflict (id) do update set public = true;

-- 5) Storage: políticas --------------------------------------------------------
-- Antes había cuatro bloques `create policy` casi idénticos por bucket, todos
-- repitiendo `role in ('admin','staff')`. Ahora el criterio es un permiso, así
-- que la tabla de abajo es la única fuente de verdad y el bucle escribe las
-- políticas. Debe coincidir con `BUCKET_READ_PERMISSION` en
-- `src/app/api/storage/[bucket]/[...path]/route.ts`.
do $policies$
declare
  b record;
  prefix text;
begin
  -- Políticas de la versión anterior (criterio por rol), que ya no se recrean.
  for b in
    select unnest(array[
      'person_photos', 'person_documents', 'person_qualifications',
      'person_medical_checkups', 'person_injury_reports', 'team_documents',
      'sponsor_documents', 'sponsorship_contracts', 'sponsorship_logos',
      'registration_documents'
    ]) as name
  loop
    execute format('drop policy if exists %I on storage.objects', b.name || '_select_authenticated');
    execute format('drop policy if exists %I on storage.objects', b.name || '_select_staff');
    execute format('drop policy if exists %I on storage.objects', b.name || '_write_staff');
    execute format('drop policy if exists %I on storage.objects', b.name || '_update_staff');
    execute format('drop policy if exists %I on storage.objects', b.name || '_delete_staff');
  end loop;

  for b in
    select * from (values
      ('person-photos',           'personas.view',         'personas.manage'),
      ('person-documents',        'personas.view',         'personas.manage'),
      ('person-qualifications',   'personas.view',         'personas.manage'),
      ('person-medical-checkups', 'personas.medical.view', 'personas.medical.manage'),
      ('person-injury-reports',   'personas.medical.view', 'personas.medical.manage'),
      ('team-documents',          'equipos.view',          'equipos.manage'),
      ('membership-documents',    'equipos.view',          'equipos.manage'),
      ('sponsor-documents',       'patrocinadores.view',   'patrocinadores.manage'),
      ('sponsorship-contracts',   'patrocinadores.view',   'patrocinadores.manage'),
      ('document-templates',      'club.view',             'club.manage'),
      ('invoice-files',           'economia.official.view', 'economia.official.manage'),
      ('invoice-files-internal',  'economia.internal.view', 'economia.internal.manage')
    ) as t(bucket, read_perm, write_perm)
  loop
    prefix := replace(b.bucket, '-', '_');

    execute format('drop policy if exists %I on storage.objects', prefix || '_read');
    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and public.user_has_permission(%L))',
      prefix || '_read', b.bucket, b.read_perm);

    execute format('drop policy if exists %I on storage.objects', prefix || '_insert');
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L and public.user_has_permission(%L))',
      prefix || '_insert', b.bucket, b.write_perm);

    execute format('drop policy if exists %I on storage.objects', prefix || '_update');
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L and public.user_has_permission(%L))',
      prefix || '_update', b.bucket, b.write_perm);

    execute format('drop policy if exists %I on storage.objects', prefix || '_delete');
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L and public.user_has_permission(%L))',
      prefix || '_delete', b.bucket, b.write_perm);
  end loop;
end $policies$;

-- 5b) `registration-documents`: la excepción de escritura ----------------------
-- NO tiene política de `insert` a propósito: el formulario público de
-- inscripción (sin sesión) sube fotos de DNI/NIE con la clave de servicio desde
-- el servidor (`uploadFileAsAdmin`), que bypassa RLS por diseño. Abrir aquí una
-- política de `insert` para `anon` permitiría a cualquiera escribir en el bucket
-- sin pasar por la Server Action.
drop policy if exists "registration_documents_read" on storage.objects;
create policy "registration_documents_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'registration-documents'
    and public.user_has_permission('inscripciones.view')
  );

drop policy if exists "registration_documents_delete" on storage.objects;
create policy "registration_documents_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'registration-documents'
    and public.user_has_permission('inscripciones.manage')
  );

-- 5c) `sponsorship-logos`: la excepción de lectura -----------------------------
-- Lectura pública (el bucket lo es); solo se restringe la escritura.
drop policy if exists "sponsorship_logos_insert" on storage.objects;
create policy "sponsorship_logos_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sponsorship-logos'
    and public.user_has_permission('patrocinadores.manage')
  );

drop policy if exists "sponsorship_logos_update" on storage.objects;
create policy "sponsorship_logos_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sponsorship-logos'
    and public.user_has_permission('patrocinadores.manage')
  );

drop policy if exists "sponsorship_logos_delete" on storage.objects;
create policy "sponsorship_logos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'sponsorship-logos'
    and public.user_has_permission('patrocinadores.manage')
  );

-- ============================================================================
-- Bootstrap del primer administrador (ejecútalo tras registrarte por primera vez):
--
--   update public.users
--   set role_id = (select id from public.roles where key = 'admin'),
--       status  = 'active'
--   where email = 'TU_EMAIL_AQUI';
--
-- A partir de ahí, el alta del resto se hace desde /administracion/usuarios.
-- ============================================================================
