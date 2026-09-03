import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Browser-only — anon key is safe to expose, gates nothing on its own (topics are unguessable capability tokens). */
export function supabaseRealtimeBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase realtime env vars are not set");
  if (!client) client = createClient(url, key);
  return client;
}
