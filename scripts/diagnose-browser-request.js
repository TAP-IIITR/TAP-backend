// Replicates the browser's exact request to the Supabase token endpoint.
// Browser sends Origin + anon apikey; node supabase-js does not send Origin.
require("dotenv").config();

const URL = `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`;
const ANON = process.env.SUPABASE_ANON_KEY;

const body = JSON.stringify({
  email: "tpo@iiitranchi.ac.in",
  password: "Tpo@iiitr2026",
  gotrue_meta_security: {},
});

const baseHeaders = {
  "Content-Type": "application/json",
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
};

const run = async () => {
  // 1. No Origin (like node) — expect 200
  const r1 = await fetch(URL, { method: "POST", headers: baseHeaders, body });
  console.log("NO-ORIGIN :", r1.status);
  if (r1.status !== 200) console.log("  body:", (await r1.text()).slice(0, 300));

  // 2. With browser Origin header (like the browser) — expect 200 if CORS is fine
  const r2 = await fetch(URL, {
    method: "POST",
    headers: { ...baseHeaders, Origin: "http://localhost:5173" },
    body,
  });
  console.log("WITH-ORIGIN:", r2.status);
  if (r2.status !== 200) console.log("  body:", (await r2.text()).slice(0, 300));

  // 3. Confirm the CORS preflight is allowed
  const r3 = await fetch(URL, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type,apikey",
    },
  });
  console.log("PREFLIGHT  :", r3.status, "| allow-origin:", r3.headers.get("access-control-allow-origin"));
};

run().catch((e) => {
  console.log("FATAL:", e.message);
  process.exit(1);
});
