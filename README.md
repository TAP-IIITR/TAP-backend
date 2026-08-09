# TAP Backend — Express + TypeScript

REST API for the IIIT Ranchi Training & Placement portal. Runs on **port 3001** by default.

## Stack
- **Runtime:** Node.js 20+ (tested on 24) · TypeScript
- **Framework:** Express 4, `express-async-errors`
- **Database:** Supabase Postgres via **Prisma ORM** (migration in progress from Firebase/Firestore)
- **Auth:** Supabase Auth (JWT verified server-side) — new; Firebase Auth is legacy until cutover
- **Other:** Swagger docs, Winston logging, express-rate-limit, express-validator, multer (file uploads), AWS SDK (S3/SES — legacy resume/email), xlsx (Excel import)

## Setup

```bash
cp .env.example .env    # fill in real values
npm install
npm run dev             # http://localhost:3001
```

### Environment variables (`backend/.env`)
| Variable | Needed for | Notes |
|---|---|---|
| `SUPABASE_URL` | Supabase client | from Supabase dashboard |
| `SUPABASE_ANON_KEY` | Supabase client | public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin ops (verify tokens) | **secret — never ship to frontend** |
| `DATABASE_URL` | Prisma (runtime pooler) | `postgresql://postgres:PW@db.<ref>.supabase.co:6543/postgres` (port **6543** = pgbouncer) |
| `DIRECT_URL` | Prisma migrations | same but port **5432** (direct) |
| `FIREBASE_*` | Legacy auth (until cutover) | can stay as-is |
| `JWT_SECRET` / `COOKIE_SECRET` | Legacy JWT auth | can stay as-is until cutover |
| `AWS_*` | Legacy S3/SES (resume storage) | can stay as-is |

## Prisma (Supabase)

The CRM schema lives in `prisma/schema.prisma`. Models: `Student`, `StudentStatus`, `Company`, `Opportunity`, `Application`, `Offer`, `Coordinator`, `AuditLog`.

```bash
# 1. Generate the typed client (no DB needed)
npx prisma generate

# 2. Create/apply migrations (needs DATABASE_URL + DIRECT_URL in .env)
npx prisma migrate dev --name init

# 3. Apply report views + auth trigger
npx prisma db execute --file prisma/views.sql
npx prisma db execute --file prisma/auth_trigger.sql
```

- `prisma/views.sql` — analytics views (`v_placement_stats`, `v_placement_funnel`, `v_company_report`, `v_package_stats`, `v_student_report`, unplaced/higher-studies/govt lists)
- `prisma/auth_trigger.sql` — creates a `coordinators` row automatically when a Supabase user signs up with role `COORDINATOR`/`TPO`

> The **Supabase migration is IN PROGRESS** — the schema is scaffolded but the tables may not exist yet in the project DB until `prisma migrate dev` is run with real credentials.

## New Auth (replaces Firebase middleware)

`src/auth/middleware/requireRole.ts` verifies the Supabase access token statelessly and resolves the role from **`app_metadata` + `coordinators` table** (server-controlled — students cannot self-assign TPO/coordinator).

```ts
import { requireRole, requireAuth } from "./auth/middleware/requireRole";
import { UserRole } from "@prisma/client";

router.get("/", requireRole(UserRole.TPO, UserRole.COORDINATOR), handler);
router.get("/me", requireAuth, handler);
```

The old Firebase middleware (`src/middleware/auth.middleware.ts`, `tapauth.middleware.ts`) is **broken for multi-user** (`auth.currentUser` is a server-side singleton) and should be replaced by the new middleware as routes are migrated.

## API Surface
- `/api/auth/student/*` — student auth (legacy Firebase)
- `/api/auth/tap/*` — coordinator/TPO auth (legacy Firebase)
- `/api/dashboard/*`, `/api/jobs/*`, `/api/student/*`, `/api/recruiter/*` — feature routes
- `/api-docs` — Swagger UI (auto-generated from route JSDoc)

## Checks
```bash
npx tsc --noEmit      # typecheck (must pass)
npx prisma validate   # schema check
```
