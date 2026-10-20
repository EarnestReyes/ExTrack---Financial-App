import { assertOwner, owner } from "../access";
import { changed } from "../sync/events";
import { syncFromFirestore } from "../sync/syncService";
import type { Entity } from "../types";
import { readOwned, writeOwned } from "./ownedRecordRepository";

export function save(uid: string, entity: Entity, id: string, payload: Record<string, unknown>, action: "INSERT" | "UPDATE" | "DELETE") {
  assertOwner(uid);
  writeOwned(uid, entity, id, payload, action);
  changed();
  void syncFromFirestore().catch(() => {});
  return { firestoreId: id, id: undefined };
}

export function ownedRecord<T extends {firestoreId?: string}>(entity: Entity, firestoreId?: string): T {
  if (!firestoreId) throw new Error("A stable record identifier is required. Refresh and retry.");
  const row = readOwned<T>(owner(), entity).find((record) => record.firestoreId === firestoreId);
  if (!row) throw new Error("Record is not available in this account. Refresh and retry.");
  return row;
}
