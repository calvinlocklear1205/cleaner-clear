import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Storage bucket for submission and hazard photos (private). */
export const SUBMISSIONS_BUCKET = "submissions";

let client: SupabaseClient | undefined;

/**
 * Service-role Supabase client. Bypasses RLS, so it must only ever be used in
 * route handlers / server components — the `server-only` import makes any
 * client-side import a build error.
 *
 * There is intentionally no browser Supabase client: the browser never talks
 * to the DB, and photo uploads go straight to Storage with a plain `fetch`
 * PUT to a signed upload URL minted by /api/submissions/init.
 */
export function supabaseAdmin(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
