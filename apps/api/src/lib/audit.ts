import type { Db } from "../db/client.js";
import { auditLog } from "../db/schema.js";
import { newId } from "./ids.js";

export async function logAudit(db: Db, userId: string, action: string, entityType: string, entityId: string): Promise<void> {
  await db.insert(auditLog).values({ id: newId(), userId, action, entityType, entityId });
}
