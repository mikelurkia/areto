/**
 * Credenciales públicas de Supabase.
 * Soporta la nueva "publishable key" (sb_publishable_...) y, por compatibilidad,
 * la clásica "anon key".
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * ¿Están las variables de Supabase presentes? Permite que la app funcione
 * (landing pública, login renderizado) antes de configurar Supabase, sin caídas.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
