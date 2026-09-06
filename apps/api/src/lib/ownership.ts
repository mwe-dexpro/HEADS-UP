import { and, eq, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * The `findFirst({ where: and(eq(table.id, id), eq(table.userId, userId)) })`
 * pattern was copy-pasted nine times across events.ts/lists.ts/tasks.ts —
 * it's also the one line in each handler that actually prevents IDOR (a
 * client-supplied id never resolves to another user's row). One shared
 * helper means that check has one place to get right, and a future route
 * can't add a tenth subtly-different copy. Takes the caller's own
 * `db.query.<table>.findFirst` as a callback so Drizzle's per-table return
 * type is preserved rather than erased behind a generic.
 */
export async function findOwned<T>(
  finder: (where: SQL) => Promise<T | undefined>,
  idColumn: SQLiteColumn,
  userIdColumn: SQLiteColumn,
  id: string,
  userId: string,
): Promise<T | null> {
  const row = await finder(and(eq(idColumn, id), eq(userIdColumn, userId))!);
  return row ?? null;
}
