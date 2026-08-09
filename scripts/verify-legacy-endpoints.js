// Verifies the legacy TAP dashboard endpoints accept Supabase Bearer tokens
// (i.e. the "redirect to signup" bounce is fixed end-to-end).
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const run = async () => {
  // 1. Sign in as TPO
  const { data, error } = await sb.auth.signInWithPassword({
    email: "tpo@iiitranchi.ac.in",
    password: "TapTpo2026",
  });
  if (error) {
    console.log("1. TPO SIGNIN: FAIL ->", error.message);
    process.exit(1);
  }
  console.log("1. TPO SIGNIN: OK");
  const token = data.session.access_token;

  // 2. /api/auth/me via proxy
  const me = await fetch("http://localhost:5173/api/auth/me", {
    headers: { Authorization: "Bearer " + token },
  });
  const meBody = await me.json();
  console.log(
    "2. /api/auth/me via proxy:",
    me.status,
    "| role:",
    meBody.data?.role
  );

  // 3. LEGACY dashboard endpoints (previously 401 -> signout bounce)
  const endpoints = [
    ["GET", "/api/dashboard/tap"],
    ["GET", "/api/jobs/tap/applications"],
    ["GET", "/api/jobs/tap?limit=5"],
    ["GET", "/api/recruiter/tap"],
    ["GET", "/api/student/tap"],
  ];
  let pass = 0;
  for (const [method, path] of endpoints) {
    const res = await fetch("http://localhost:5173" + path, {
      headers: { Authorization: "Bearer " + token },
    });
    const ok = res.status < 400;
    if (ok) pass++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${method} ${path} -> ${res.status}`
    );
  }

  // 4. Negative check: no token should still be rejected
  const noToken = await fetch("http://localhost:5173/api/dashboard/tap");
  const noTokenOk = noToken.status === 401 || noToken.status === 403;
  if (noTokenOk) pass++;
  console.log(
    `${noTokenOk ? "PASS" : "FAIL"}  GET /api/dashboard/tap (no token) -> ${noToken.status} (expected 401/403)`
  );

  console.log(`\n=== ${pass}/${endpoints.length + 1} checks passed ===`);
  process.exit(pass === endpoints.length + 1 ? 0 : 1);
};

run().catch((e) => {
  console.log("FATAL:", e.message);
  process.exit(1);
});
