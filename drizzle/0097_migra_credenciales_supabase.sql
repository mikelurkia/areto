-- Paso a Better Auth: trae de Supabase Auth (`auth.users`) lo que la aplicación
-- necesita para seguir funcionando sin él.
--
-- * La contraseña: el hash bcrypt se copia tal cual a `auth_accounts` como
--   cuenta `credential`. `src/lib/better-auth.ts` lo reconoce por el prefijo
--   `$2` y lo verifica con bcrypt, así que nadie tiene que resetearla.
-- * Si el correo estaba confirmado y cuándo entró por última vez, que hasta
--   ahora se leían de la Admin API.
--
-- Idempotente: se puede aplicar dos veces sin duplicar nada. Si el esquema
-- `auth` no existe (una base de datos que no es de Supabase), no hace nada.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.auth_accounts (user_id, account_id, provider_id, password, created_at, updated_at)
  SELECT u.id, u.id::text, 'credential', a.encrypted_password, now(), now()
  FROM auth.users a
  JOIN public.users u ON u.id = a.id
  WHERE a.encrypted_password IS NOT NULL AND a.encrypted_password <> ''
  ON CONFLICT (provider_id, account_id) DO NOTHING;

  UPDATE public.users u
  SET email_verified = a.email_confirmed_at IS NOT NULL,
      last_sign_in_at = coalesce(u.last_sign_in_at, a.last_sign_in_at)
  FROM auth.users a
  WHERE a.id = u.id;
END $$;
