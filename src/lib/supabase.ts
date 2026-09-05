import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

// Client-side (browser): uses VITE_ vars, anon key, RLS enforced
export function getSupabaseBrowser(): SupabaseClient | null {
  if (browserClient) return browserClient;
  // @ts-ignore Vite import.meta.env is injected at build
  const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  // @ts-ignore
  const anon = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) return null;
  if (!url.startsWith('http')) return null;
  browserClient = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
}

// Server-side: prefers service_role for bypass RLS where needed,
// falls back to anon if only that is configured. Never expose service_role to client.
export function getSupabaseServer(): SupabaseClient | null {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  if (!url || !key) return null;
  if (!url.startsWith('http')) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabaseConfiguredServer(): boolean {
  return !!getSupabaseServer();
}
