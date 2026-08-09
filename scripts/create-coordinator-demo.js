// Creates a demo coordinator test account (idempotent).
// Usage: node scripts/create-coordinator-demo.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { PrismaClient } = require("@prisma/client");

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const prisma = new PrismaClient();

const EMAIL = "coord.demo@iiitranchi.ac.in";
const PASSWORD = "Coord@demo2026";
const NAME = "Demo Coordinator";

const main = async () => {
  const existing = await prisma.coordinator.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log("Coordinator already exists:", EMAIL, "/", PASSWORD);
    await prisma.$disconnect();
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: NAME },
    app_metadata: { role: "COORDINATOR" },
  });
  if (error) {
    console.log("FAIL:", error.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  // Safety net: ensure the coordinators row exists (trigger should do this).
  await prisma.coordinator.upsert({
    where: { id: data.user.id },
    update: {},
    create: {
      id: data.user.id,
      name: NAME,
      email: EMAIL,
      role: "COORDINATOR",
      isActive: true,
    },
  });

  console.log("Coordinator created:", EMAIL, "/", PASSWORD);
  await prisma.$disconnect();
};

main().catch((e) => {
  console.log("FAIL:", e.message);
  process.exit(1);
});
