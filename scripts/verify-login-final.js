// Final check: replicate the browser's ENTIRE login flow with the new passwords.
// 1. signInWithPassword (anon key, exact browser request incl. Origin header)
// 2. /api/auth/me with the access token through the frontend proxy
// Usage: node scripts/verify-login-final.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const ACCOUNTS = [
  { email: "tpo@iiitranchi.ac.in", password: "TapTpo2026", label: "TPO" },
  { email: "coord.demo@iiitranchi.ac.in", password: "TapCoord2026", label: "Coordinator" },
];

const main = async () => {
  for (const acc of ACCOUNTS) {
    // 1. Sign-in — identical to what the browser does (same URL, anon key, Origin)
    const { data, error } = await anon.auth.signInWithPassword({
      email: acc.email,
      password: acc.password,
    });
    if (error) {
      console.log(`❌ ${acc.label}: sign-in rejected by Supabase: ${error.message}`);
      continue;
    }
    const token = data.session.access_token;

    // 2. Hit /api/auth/me THROUGH the frontend proxy (what the React app does)
    const me = await fetch("http://localhost:5173/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await me.json();
    console.log(
      `✅ ${acc.label}: sign-in OK -> /me status=${me.status} role=${meBody.data?.role} name=${meBody.data?.profile?.name ?? "-"}`
    );
  }
};

main().catch((e) => {
  console.log("FATAL:", e.message);
  process.exit(1);
});
