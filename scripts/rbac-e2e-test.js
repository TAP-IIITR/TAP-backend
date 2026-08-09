// RBAC end-to-end test — run against a running backend+frontend (ports 3001/5173).
// Usage: node scripts/rbac-e2e-test.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const API = "http://localhost:5173/api"; // via the frontend proxy

const expect = (label, actual, wanted) => {
  const ok = actual === wanted;
  console.log(`${ok ? "✅" : "❌"} ${label}: got ${actual}, expected ${wanted}`);
  if (!ok) process.exitCode = 1;
};

const main = async () => {
  // 1. TPO sign-in
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "tpo@iiitranchi.ac.in",
    password: "Tpo@iiitr2026",
  });
  if (error) throw new Error("TPO signin failed: " + error.message);
  console.log("✅ 1. TPO signin OK");
  const token = data.session.access_token;

  // 2. /me resolves role TPO
  const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const meBody = await me.json();
  expect("2. /me status", me.status, 200);
  expect("2. /me role", meBody.data?.role, "TPO");
  console.log("   profile name:", meBody.data?.profile?.name);

  // 3. TPO can list coordinators (RBAC allow)
  const coords = await fetch(`${API}/auth/coordinators`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect("3. GET /coordinators as TPO", coords.status, 200);

  // 4. No token -> 401
  const noToken = await fetch(`${API}/auth/me`);
  expect("4. /me with no token", noToken.status, 401);

  // 5. Student role -> 403 on TPO endpoint
  const rand = Date.now().toString().slice(-6);
  const email = `test.stu${rand}@iiitranchi.ac.in`;
  await admin.auth.admin.createUser({
    email,
    password: "Student@123",
    email_confirm: true,
    app_metadata: { role: "STUDENT" },
  });
  const st = await supabase.auth.signInWithPassword({ email, password: "Student@123" });
  const denied = await fetch(`${API}/auth/coordinators`, {
    headers: { Authorization: `Bearer ${st.data.session.access_token}` },
  });
  expect("5. GET /coordinators as STUDENT", denied.status, 403);

  // cleanup
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const created = users.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
  console.log("\nDone.");
};

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
