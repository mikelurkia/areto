/**
 * Credenciales públicas de Supabase (Storage).
 * Soporta la nueva "publishable key" (sb_publishable_...) y, por compatibilidad,
 * la clásica "anon key".
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
