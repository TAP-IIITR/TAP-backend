import { prisma } from "../../config/prisma";
import { UserRole, Prisma } from "@prisma/client";

/**
 * Writes an audit_logs row for every mutation. Failures are swallowed on
 * purpose — auditing must never break the primary operation.
 */
export async function audit({
  actorId,
  actorRole,
  action,
  entity,
  entityId,
  changes,
}: {
  actorId: string;
  actorRole: UserRole;
  action: "CREATE" | "UPDATE" | "DELETE" | "IMPORT";
  entity: string; // students | companies | opportunities | applications | offers
  entityId?: string;
  changes?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole,
        action,
        entity,
        entityId,
        changes: (changes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    // never break the main operation because of an audit failure
    console.error("Audit log write failed:", e);
  }
}
