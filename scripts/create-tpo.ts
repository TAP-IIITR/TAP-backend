/**
 * Bootstrap script — creates the FIRST TPO user.
 * Run once: npx ts-node scripts/create-tpo.ts
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TPO_NAME, TPO_EMAIL, TPO_PASSWORD
 * (defaults for TPO_NAME/TPO_EMAIL/TPO_PASSWORD come from .env or CLI args below)
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
};

const main = async () => {
  const supabaseAdmin = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const prisma = new PrismaClient();

  const name = process.env.TPO_NAME || "TPO";
  const email = process.env.TPO_EMAIL || "tpo@iiitranchi.ac.in";
  const password = process.env.TPO_PASSWORD;

  if (!password) {
    throw new Error("Set TPO_PASSWORD in .env (or pass it inline) before running.");
  }

  // Idempotent: skip if a TPO already exists
  const existing = await prisma.coordinator.findFirst({ where: { role: "TPO" } });
  if (existing) {
    console.log(`A TPO already exists: ${existing.email} — nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role: "TPO" },
  });

  if (error) {
    console.error("Supabase createUser failed:", error.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  // The DB trigger should have provisioned the coordinators row.
  const coordinator = await prisma.coordinator.findUnique({
    where: { id: data.user.id },
  });

  console.log("✅ TPO created:", {
    id: data.user.id,
    email,
    role: "TPO",
    provisioned: !!coordinator,
  });

  if (!coordinator) {
    console.warn(
      "⚠️  coordinators row was NOT auto-created — check the auth trigger (prisma/auth_trigger.sql) is installed."
    );
  }

  await prisma.$disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
