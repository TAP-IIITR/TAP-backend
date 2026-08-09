// Phase B CRM E2E test — full round-trip against the running backend.
// Requires: backend on :3001, TPO account, and a test student seeded via Prisma.
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const BASE = "http://localhost:3001/api/crm";

let passed = 0;
let failed = 0;
const ok = (cond, label) => {
  if (cond) {
    passed++;
    console.log("  PASS  " + label);
  } else {
    failed++;
    console.log("  FAIL  " + label);
  }
};

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

const run = async () => {
  console.log("=== CRM E2E (Phase B) ===\n");

  // 0. Sign in as TPO
  const { data, error } = await sb.auth.signInWithPassword({
    email: "tpo@iiitranchi.ac.in",
    password: process.env.TAP_DEMO_TPO_PASSWORD || "TapTpo2026",
  });
  if (error) {
    console.log("FATAL: TPO signin failed:", error.message);
    process.exit(1);
  }
  const token = data.session.access_token;
  console.log("1. TPO signin: OK\n");

  // Seed a test student (student import is a later phase) — clean up any leftovers first
  const reg = "CRM_TEST_" + Date.now();
  let student = await prisma.student.findUnique({ where: { registrationNo: reg } });
  if (!student) {
    student = await prisma.student.create({
      data: {
        registrationNo: reg,
        name: "CRM E2E Test Student",
        branch: "CSE",
        batch: 2027,
        collegeEmail: reg.toLowerCase() + "@test.local",
        cgpa: 8.5,
      },
    });
    await prisma.studentStatus.create({
      data: { studentId: student.id, placementEligible: true },
    });
  }

  // 2. RBAC negative: no token
  const noAuth = await fetch(BASE + "/companies", { headers: {} });
  ok(noAuth.status === 401, "GET /companies without token -> 401");

  // 3. Companies
  const companyName = "CRM Test Corp " + Date.now();
  let r = await api("POST", "/companies", token, {
    name: companyName,
    sector: "IT",
    website: "https://crmtest.example.com",
  });
  ok(r.status === 201 && r.json.data.id, "POST /companies -> 201");
  const companyId = r.json.data.id;

  r = await api("POST", "/companies", token, { name: companyName });
  ok(r.status === 400, "POST duplicate company -> 400");

  r = await api("GET", "/companies?search=CRM%20Test", token);
  ok(r.status === 200 && r.json.data.length >= 1, "GET /companies?search -> list");

  // 4. Opportunities
  r = await api("POST", "/opportunities", token, {
    companyId,
    academicYear: "2026-27",
    opportunityType: "ON_CAMPUS",
    employmentType: "FULL_TIME",
    role: "Software Engineer",
    ctcLpa: 24,
    eligibleBranches: ["CSE", "ECE"],
    minCgpa: 7.0,
    status: "OPEN",
  });
  ok(r.status === 201 && r.json.data.id, "POST /opportunities -> 201");
  const oppId = r.json.data.id;

  r = await api("POST", "/opportunities", token, {
    companyId,
    academicYear: "2026-27",
    opportunityType: "ON_CAMPUS",
    employmentType: "FULL_TIME",
    role: "SWE",
    eligibleBranches: ["NOT_A_BRANCH"],
    status: "OPEN",
  });
  ok(r.status === 400, "POST opportunity with INVALID branch -> 400");

  r = await api("GET", `/opportunities/${oppId}`, token);
  ok(r.status === 200 && r.json.data.company.name === companyName, "GET /opportunities/:id with company");

  r = await api("PATCH", `/opportunities/${oppId}`, token, { status: "CLOSED" });
  ok(r.status === 200 && r.json.data.status === "CLOSED", "PATCH /opportunities/:id -> status CLOSED");
  await api("PATCH", `/opportunities/${oppId}`, token, { status: "OPEN" });

  // 5. Applications
  r = await api("POST", "/applications", token, { studentId: student.id, opportunityId: oppId });
  ok(r.status === 201 && r.json.data.id, "POST /applications -> 201");
  const appId = r.json.data.id;

  r = await api("POST", "/applications", token, { studentId: student.id, opportunityId: oppId });
  ok(r.status === 400, "POST duplicate application -> 400");

  r = await api("PATCH", `/applications/${appId}`, token, {
    oaStatus: "CLEARED",
    gdStatus: "CLEARED",
    technicalRound: "CLEARED",
    hrRound: "CLEARED",
    offerReleased: true,
    finalStatus: "SELECTED",
  });
  ok(
    r.status === 200 && r.json.data.finalStatus === "SELECTED",
    "PATCH /applications/:id -> pipeline SELECTED"
  );

  // 6. Offers
  r = await api("POST", "/offers", token, {
    studentId: student.id,
    opportunityId: oppId,
    finalCtcLpa: 24.5,
    accepted: "ACCEPTED",
  });
  ok(r.status === 201 && r.json.data.id, "POST /offers -> 201");

  r = await api("POST", "/offers", token, { studentId: student.id, opportunityId: oppId });
  ok(r.status === 400, "POST duplicate offer -> 400");

  // 7. Dashboard stats
  r = await api("GET", "/dashboard/stats", token);
  ok(r.status === 200 && r.json.data.totals.totalCompanies >= 1, "GET /dashboard/stats -> totals");
  ok(
    r.json.data.funnel && typeof r.json.data.funnel.applied === "number",
    "GET /dashboard/stats -> funnel present"
  );

  // 8. Report views
  r = await api("GET", "/dashboard/reports/company-report", token);
  ok(r.status === 200 && Array.isArray(r.json.data), "GET /dashboard/reports/company-report");
  r = await api("GET", "/dashboard/reports/bogus", token);
  ok(r.status === 400, "GET /dashboard/reports/bogus -> 400");

  // 9. RBAC negative: student role must be denied
  const stud = await sb.auth.signUp({ email: reg.toLowerCase() + "@test.local", password: "Test@1234" });
  let studentBlocked = false;
  if (!stud.error && stud.data.user) {
    const res = await fetch(BASE + "/companies", {
      headers: { Authorization: "Bearer " + stud.data.session?.access_token || "" },
    });
    studentBlocked = res.status === 403 || res.status === 401;
  } else {
    // signUp may need confirmation; test via an invalid token instead
    const res = await fetch(BASE + "/companies", {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    studentBlocked = res.status === 401;
  }
  ok(studentBlocked, "student/invalid token blocked from CRM -> 401/403");

  // 10. Cleanup — delete test rows (reverse dependency order)
  await prisma.offer.deleteMany({ where: { opportunityId: oppId } });
  await prisma.application.deleteMany({ where: { opportunityId: oppId } });
  await prisma.opportunity.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
  await prisma.studentStatus.delete({ where: { studentId: student.id } }).catch(() => {});
  await prisma.student.delete({ where: { id: student.id } }).catch(() => {});
  if (stud && !stud.error && stud.data.user) {
    // best-effort cleanup of the signup user
    try {
      await fetch(
        `https://${process.env.SUPABASE_URL.replace("https://", "")}/auth/v1/admin/users/${stud.data.user.id}`,
        { method: "DELETE", headers: { Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY } }
      );
    } catch {}
  }
  console.log("\n10. cleanup done");

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
};

run().catch(async (e) => {
  console.log("FATAL:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
