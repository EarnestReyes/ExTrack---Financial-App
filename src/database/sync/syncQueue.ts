import { ownedDatabase } from "../connection";
import type { PendingWrite } from "../types";

export function pendingOwned(uid: string): PendingWrite[] {
  return ownedDatabase(uid).getAllSync<PendingWrite>("SELECT * FROM sync_queue WHERE ownerUid = ? ORDER BY id", [uid]);
}

export function acknowledgeOwned(uid: string, task: PendingWrite) {
  if (task.ownerUid !== uid) throw new Error("Queue owner mismatch.");
  const db = ownedDatabase(uid);
  db.withTransactionSync(() => {
    db.runSync("DELETE FROM sync_queue WHERE id = ? AND ownerUid = ?", [task.id, uid]);
    db.runSync(`UPDATE records SET dirty = 0 WHERE ownerUid = ? AND entity = ? AND firestoreId = ?
      AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE ownerUid = ? AND entity = ? AND firestoreId = ?)`,
    [uid, task.entity, task.firestoreId, uid, task.entity, task.firestoreId]);
  });
}
