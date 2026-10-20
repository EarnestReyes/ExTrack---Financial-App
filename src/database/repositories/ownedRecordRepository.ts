import { ownedDatabase } from "../connection";
import type { Entity, PendingWrite, StoredRow } from "../types";

export function readOwned<T>(uid: string | null | undefined, entity: Entity): T[] {
  if (!uid) return [];
  return ownedDatabase(uid).getAllSync<StoredRow>(
    "SELECT * FROM records WHERE ownerUid = ? AND entity = ? AND deleted = 0", [uid, entity],
  ).map((row) => ({ ...JSON.parse(row.payload), ownerUid: uid, firestoreId: row.firestoreId }));
}

export function writeOwned(uid: string, entity: Entity, firestoreId: string, payload: Record<string, unknown>, action: PendingWrite["action"]) {
  if (payload.ownerUid !== undefined && payload.ownerUid !== uid) throw new Error("Record belongs to another account.");
  const db = ownedDatabase(uid);
  const json = JSON.stringify({ ...payload, ownerUid: uid });
  db.withTransactionSync(() => {
    db.runSync(`INSERT INTO records (ownerUid, entity, firestoreId, payload, deleted, dirty) VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(ownerUid, entity, firestoreId) DO UPDATE SET payload=excluded.payload, deleted=excluded.deleted, dirty=1`,
    [uid, entity, firestoreId, json, action === "DELETE" ? 1 : 0]);
    db.runSync("INSERT INTO sync_queue (ownerUid, entity, firestoreId, action, payload) VALUES (?, ?, ?, ?, ?)", [uid, entity, firestoreId, action, json]);
  });
}

export function reconcileOwned(uid: string, entity: Entity, remote: { id: string; data: Record<string, unknown> }[]) {
  const db = ownedDatabase(uid);
  db.withTransactionSync(() => {
    db.runSync("UPDATE records SET deleted = 1 WHERE ownerUid = ? AND entity = ? AND dirty = 0", [uid, entity]);
    for (const row of remote) {
      if (row.data.ownerUid !== undefined && row.data.ownerUid !== uid) continue;
      db.runSync(`INSERT INTO records (ownerUid, entity, firestoreId, payload, deleted, dirty) VALUES (?, ?, ?, ?, 0, 0)
        ON CONFLICT(ownerUid, entity, firestoreId) DO UPDATE SET payload=excluded.payload, deleted=0 WHERE records.dirty=0`,
      [uid, entity, row.id, JSON.stringify({ ...row.data, ownerUid: uid, firestoreId: row.id })]);
    }
  });
}
