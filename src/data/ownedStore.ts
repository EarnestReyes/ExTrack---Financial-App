/** Compatibility exports; database names and schema are unchanged. */
export { ownedDatabase } from "../database/connection";
export * from "../database/repositories/ownedRecordRepository";
export * from "../database/sync/syncQueue";
export type { Entity, PendingWrite, StoredRow } from "../database/types";
