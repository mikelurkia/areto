-- ============================================================================
-- Areto · Configuración de Supabase Auth ↔ tabla de perfil `public.users`
-- ============================================================================
-- Ejecuta este script en el SQL Editor de Supabase UNA VEZ, DESPUÉS de haber
-- aplicado el esquema de Drizzle (`npm run db:push`).
--
-- Qué hace:
--   1. Crea un trigger que, al registrarse un usuario en Supabase Auth,
--      inserta automáticamente su fila de perfil en `public.users`
--      (rol por defecto: 'member'; un admin lo asciende cuando corresponda).
--   2. Activa RLS en `public.users` y permite a cada usuario leer su propio
--      perfil (las escrituras de la app van por el servidor con Drizzle).
--
-- Nota sobre RLS en el resto de tablas: todas las tablas de `public` tienen
-- RLS activado sin ninguna política propia (lo hace automáticamente una
-- función `rls_auto_enable()` creada directamente en el editor SQL de
-- Supabase, fuera de este repo, como red de seguridad ante cualquier tabla
-- nueva). Esto es intencionado, no un olvido: la aplicación accede a Postgres
-- vía `DATABASE_URL` con un rol que bypassa RLS (`src/db/index.ts`), y toda la
-- autorización real ocurre en las Server Actions vía `requireRole()`
-- (`src/lib/auth.ts`). Si en el futuro se empieza a consultar Supabase
-- directamente desde el navegador (cliente `anon`/`authenticated`) contra
-- estas tablas, hará falta escribir políticas explícitas en ese momento —
-- hasta entonces, PostgREST devolverá cero filas, que es lo deseado.
-- ============================================================================

-- 1) Trigger: crear perfil al registrarse -----------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;

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
  using (auth.uid() = id);

-- 3) Storage: fotos de personas ----------------------------------------------
-- Bucket privado (no público): las fotos se sirven con URLs firmadas y de
-- corta duración, generadas por el servidor tras comprobar la sesión.
insert into storage.buckets (id, name, public)
values ('person-photos', 'person-photos', false)
on conflict (id) do nothing;

drop policy if exists "person_photos_select_authenticated" on storage.objects;
create policy "person_photos_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'person-photos');

drop policy if exists "person_photos_write_staff" on storage.objects;
create policy "person_photos_write_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'person-photos'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "person_photos_update_staff" on storage.objects;
create policy "person_photos_update_staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'person-photos'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "person_photos_delete_staff" on storage.objects;
create policy "person_photos_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'person-photos'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- 4) Storage: titulaciones/certificaciones de personas -----------------------
-- Mismo patrón que person-photos: bucket privado, URLs firmadas de corta
-- duración generadas por el servidor.
insert into storage.buckets (id, name, public)
values ('person-qualifications', 'person-qualifications', false)
on conflict (id) do nothing;

drop policy if exists "person_qualifications_select_authenticated" on storage.objects;
create policy "person_qualifications_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'person-qualifications');

drop policy if exists "person_qualifications_write_staff" on storage.objects;
create policy "person_qualifications_write_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'person-qualifications'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "person_qualifications_update_staff" on storage.objects;
create policy "person_qualifications_update_staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'person-qualifications'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "person_qualifications_delete_staff" on storage.objects;
create policy "person_qualifications_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'person-qualifications'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- 4b) Storage: documentos genéricos de personas -------------------------------
-- Mismo patrón que person-qualifications: bucket privado, URLs firmadas de corta
-- duración generadas por el servidor.
insert into storage.buckets (id, name, public)
values ('person-documents', 'person-documents', false)
on conflict (id) do nothing;

drop policy if exists "person_documents_select_authenticated" on storage.objects;
create policy "person_documents_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'person-documents');

drop policy if exists "person_documents_write_staff" on storage.objects;
create policy "person_documents_write_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'person-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "person_documents_update_staff" on storage.objects;
create policy "person_documents_update_staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'person-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "person_documents_delete_staff" on storage.objects;
create policy "person_documents_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'person-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- 5) Storage: logos de patrocinadores -----------------------------------------
-- Mismo patrón que person-photos: bucket privado, URLs firmadas de corta
-- duración generadas por el servidor.
insert into storage.buckets (id, name, public)
values ('sponsorship-logos', 'sponsorship-logos', false)
on conflict (id) do nothing;

drop policy if exists "sponsorship_logos_select_authenticated" on storage.objects;
create policy "sponsorship_logos_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'sponsorship-logos');

drop policy if exists "sponsorship_logos_write_staff" on storage.objects;
create policy "sponsorship_logos_write_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sponsorship-logos'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "sponsorship_logos_update_staff" on storage.objects;
create policy "sponsorship_logos_update_staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sponsorship-logos'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "sponsorship_logos_delete_staff" on storage.objects;
create policy "sponsorship_logos_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'sponsorship-logos'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- 6) Storage: contratos de patrocinio -----------------------------------------
-- Mismo patrón que person-qualifications: bucket privado, URLs firmadas de
-- corta duración generadas por el servidor.
insert into storage.buckets (id, name, public)
values ('sponsorship-contracts', 'sponsorship-contracts', false)
on conflict (id) do nothing;

drop policy if exists "sponsorship_contracts_select_authenticated" on storage.objects;
create policy "sponsorship_contracts_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'sponsorship-contracts');

drop policy if exists "sponsorship_contracts_write_staff" on storage.objects;
create policy "sponsorship_contracts_write_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sponsorship-contracts'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "sponsorship_contracts_update_staff" on storage.objects;
create policy "sponsorship_contracts_update_staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sponsorship-contracts'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "sponsorship_contracts_delete_staff" on storage.objects;
create policy "sponsorship_contracts_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'sponsorship-contracts'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- 7) Storage: documentos de equipo ---------------------------------------------
-- Mismo patrón que person-documents: bucket privado, URLs firmadas de corta
-- duración generadas por el servidor.
insert into storage.buckets (id, name, public)
values ('team-documents', 'team-documents', false)
on conflict (id) do nothing;

drop policy if exists "team_documents_select_authenticated" on storage.objects;
create policy "team_documents_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'team-documents');

drop policy if exists "team_documents_write_staff" on storage.objects;
create policy "team_documents_write_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'team-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "team_documents_update_staff" on storage.objects;
create policy "team_documents_update_staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'team-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "team_documents_delete_staff" on storage.objects;
create policy "team_documents_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'team-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- 8) Storage: documentos de patrocinador -----------------------------------
-- Mismo patrón que team-documents: bucket privado, URLs firmadas de corta
-- duración generadas por el servidor.
insert into storage.buckets (id, name, public)
values ('sponsor-documents', 'sponsor-documents', false)
on conflict (id) do nothing;

drop policy if exists "sponsor_documents_select_authenticated" on storage.objects;
create policy "sponsor_documents_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'sponsor-documents');

drop policy if exists "sponsor_documents_write_staff" on storage.objects;
create policy "sponsor_documents_write_staff"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sponsor-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "sponsor_documents_update_staff" on storage.objects;
create policy "sponsor_documents_update_staff"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sponsor-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "sponsor_documents_delete_staff" on storage.objects;
create policy "sponsor_documents_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'sponsor-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- 9) Storage: documentos de solicitudes de inscripción ------------------------
-- Bucket privado. A diferencia de los anteriores, NO tiene política de
-- `insert`: el formulario público (sin sesión) sube fotos con la clave de
-- servicio desde el servidor (ver `uploadFileAsAdmin`), que bypassa RLS por
-- diseño. Abrir aquí una política de `insert` para `anon` permitiría a
-- cualquiera escribir en el bucket sin pasar por la Server Action. Solo
-- lectura para `admin`/`staff` (contienen fotos de DNI/NIE, más sensibles que
-- una foto de carné).
insert into storage.buckets (id, name, public)
values ('registration-documents', 'registration-documents', false)
on conflict (id) do nothing;

drop policy if exists "registration_documents_select_staff" on storage.objects;
create policy "registration_documents_select_staff"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'registration-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "registration_documents_delete_staff" on storage.objects;
create policy "registration_documents_delete_staff"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'registration-documents'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- ============================================================================
-- Bootstrap del primer administrador (ejecútalo tras registrarte por primera vez):
--
--   update public.users
--   set role = 'admin'
--   where email = 'TU_EMAIL_AQUI';
-- ============================================================================
