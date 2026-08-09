import { Router } from "express";
import { companiesRouter } from "./companies.routes";
import { opportunitiesRouter } from "./opportunities.routes";
import { applicationsRouter } from "./applications.routes";
import { offersRouter } from "./offers.routes";
import { studentsRouter } from "./students.routes";
import { dashboardRouter } from "./dashboard.routes";

// PostgreSQL COUNT() aggregates come back as BigInt; JSON.stringify would throw.
// Polyfill so report views serialize cleanly (counts become numbers).
if (typeof (BigInt.prototype as unknown as { toJSON?: unknown }).toJSON !== "function") {
  (BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
    return Number(this);
  };
}

/**
 * /api/crm — the coordinator-facing CRM API (Supabase/Prisma).
 * Every route requires an authenticated TPO or COORDINATOR.
 */
const crmRouter = Router();

crmRouter.use("/companies", companiesRouter);
crmRouter.use("/opportunities", opportunitiesRouter);
crmRouter.use("/applications", applicationsRouter);
crmRouter.use("/offers", offersRouter);
crmRouter.use("/students", studentsRouter);
crmRouter.use("/dashboard", dashboardRouter);

export { crmRouter };
