// Diagnose login 400s — check user state + attempt sign-in with exact creds.
// Usage: node scripts/diagnose-login.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ACCOUNTS = [
  { email: "tpo@iiitranchi.ac.in", password: "Tpo@iiitr2026", label: "TPO" },
  { email: "coord.demo@iiitranchi.ac.in", password: "Coord@demo2026", label: "Coordinator" },
];

const main = async () => {
  // 1. Check account state via admin API
  console.log("=== ACCOUNT STATE (admin API) ===");
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const acc of ACCOUNTS) {
    const u = users.users.find((x) => x.email === acc.email);
    if (!u) {
      console.log(`❌ ${acc.label} ${acc.email}: NOT FOUND in auth.users`);
      continue;
    }
    console.log(
      `✅ ${acc.label} ${acc.email}: exists | emailConfirmed=${u.email_confirmed_at ? "YES" : "NO"} | role=${u.app_metadata?.role}`
    );
  }

  // 2. Attempt sign-in with exact credentials
  console.log("\n=== SIGN-IN ATTEMPTS ===");
  for (const acc of ACCOUNTS) {
    const { data, error } = await anon.auth.signInWithPassword({
      email: acc.email,
      password: acc.password,
    });
    if (error) {
      console.log(`❌ ${acc.label}: ${error.message} (code: ${error.code})`);
      console.log(`   status: ${error.status}`);
    } else {
      console.log(`✅ ${acc.label}: SIGN-IN OK -> role claim: ${data.user.app_metadata?.role}`);
    }
  }
};

main().catch((e) => {
  console.log("FATAL:", e.message);
  process.exit(1);
});
