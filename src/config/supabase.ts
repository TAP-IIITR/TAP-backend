import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const requireEnv = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        "Add it to .env (Supabase Dashboard → Settings → API)."
    );
  }
  return value;
};

// Fail fast with a clear message instead of a cryptic createClient crash.
const url = requireEnv("SUPABASE_URL", process.env.SUPABASE_URL);
const anonKey = requireEnv("SUPABASE_ANON_KEY", process.env.SUPABASE_ANON_KEY);
const serviceKey = requireEnv(
  "SUPABASE_SERVICE_ROLE_KEY",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Admin client — uses the SERVICE_ROLE key.
 * ONLY for server-side trusted operations (token verification, user management, imports).
 * NEVER expose this key to the frontend.
 */
export const supabaseAdmin: SupabaseClient = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Anon client — safe for public read + auth sign-in flows from the server
 * when we need to act on behalf of a user (e.g., verify email tokens).
 */
export const supabaseAnon: SupabaseClient = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
