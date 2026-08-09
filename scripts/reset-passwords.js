// Resets test account passwords to simple, typo-proof values and verifies sign-in.
// Usage: node scripts/reset-passwords.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ACCOUNTS = [
  { email: "tpo@iiitranchi.ac.in", password: "TapTpo2026", label: "TPO" },
  { email: "coord.demo@iiitranchi.ac.in", password: "TapCoord2026", label: "Coordinator" },
];

const main = async () => {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  for (const acc of ACCOUNTS) {
    const u = users.users.find((x) => x.email === acc.email);
    if (!u) {
      console.log(`❌ ${acc.label} ${acc.email}: NOT FOUND`);
      continue;
    }
    // 1. Reset password via admin API
    await admin.auth.admin.updateUserById(u.id, { password: acc.password });
    console.log(`🔑 ${acc.label} password reset to: ${acc.password}`);

    // 2. Verify the new password works with the anon key (same path the browser uses)
    const { data, error } = await anon.auth.signInWithPassword({
      email: acc.email,
      password: acc.password,
    });
    if (error) {
      console.log(`❌ ${acc.label} verification FAILED: ${error.message}`);
    } else {
      console.log(`✅ ${acc.label} verified: sign-in OK (role=${data.user.app_metadata?.role})`);
    }
  }
};

main().catch((e) => {
  console.log("FATAL:", e.message);
  process.exit(1);
});
