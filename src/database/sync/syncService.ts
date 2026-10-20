import NetInfo from "@react-native-community/netinfo";
import { onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, getDocsFromServer, onSnapshot, runTransaction } from "firebase/firestore";
import { auth, db as firestoreDb } from "../../services/firebase/client";
import { assertOwner, owner, path } from "../access";
import { reconcileOwned } from "../repositories/ownedRecordRepository";
import type { Entity, SyncState } from "../types";
import { changed } from "./events";
import { acknowledgeOwned, pendingOwned } from "./syncQueue";

let activeSync: Promise<void> | null = null;

let syncAgain = false;

let syncState: SyncState = "idle";

export const getSyncState = () => syncState;

async function push(uid: string) {
  for (const task of pendingOwned(uid)) {
    assertOwner(uid);
    if (task.ownerUid !== uid) throw new Error("Queue owner mismatch.");
    const storedPayload = JSON.parse(task.payload);
    const expected = storedPayload._expectedUpdatedAt;
    delete storedPayload.firestoreId;
    delete storedPayload._expectedUpdatedAt;
    const updateFields: Partial<Record<Entity, string[]>> = {
      transactions: ["ownerUid", "name", "category", "amount", "amountCentavos", "type", "date", "time", "updatedAt"],
      cards: ["ownerUid", "name", "type", "lastFour", "expiry", "amount", "updatedAt"],
      user_profile: ["ownerUid", "photoURL", "updatedAt"],
    };
    // Never round-trip immutable legacy metadata (including Firestore Timestamps)
    // through JSON back into cloud documents during an ordinary edit.
    const fields = task.action === "UPDATE" ? updateFields[task.entity] : undefined;
    const payload = fields ? Object.fromEntries(fields.filter((key) => key in storedPayload).map((key) => [key, storedPayload[key]])) : storedPayload;
    if (payload.ownerUid !== uid) throw new Error("Queue payload owner mismatch.");
    const ref = path(uid, task.entity, task.firestoreId);
    if (task.action === "DELETE") await deleteDoc(ref);
    else await runTransaction(firestoreDb, async (tx) => {
      assertOwner(uid);
      const existing = await tx.get(ref);
      if (task.action === "INSERT") {
        if (!existing.exists()) tx.set(ref, payload);
        else if (Object.keys(payload).some((key) => JSON.stringify(existing.data()[key]) !== JSON.stringify(payload[key]))) {
          throw new Error("A conflicting cloud record requires review.");
        }
      } else {
        if (!existing.exists()) throw new Error("The remote record was removed; review the pending edit.");
        if (Object.keys(payload).every((key) => JSON.stringify(existing.data()[key]) === JSON.stringify(payload[key]))) return;
        if ((existing.data().updatedAt || null) !== expected) throw new Error("A newer cloud edit requires review.");
        tx.update(ref, payload);
      }
    });
    // A request already in flight always retains its captured user path.
    assertOwner(uid);
    acknowledgeOwned(uid, task);
  }
}

export async function processSyncQueue() { await syncFromFirestore(); }

export function syncFromFirestore(): Promise<void> {
  if (activeSync) { syncAgain = true; return activeSync; }
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.resolve();
  syncState = "syncing";
  activeSync = (async () => {
    await push(uid);
    const entities: Entity[] = ["transactions", "loans", "cards"];
    const snapshots = await Promise.all(entities.map((entity) => getDocsFromServer(collection(firestoreDb, "users", uid, entity))));
    assertOwner(uid);
    snapshots.forEach((snapshot, index) => reconcileOwned(uid, entities[index], snapshot.docs.map((item) => ({ id: item.id, data: item.data() }))));
    syncState = pendingOwned(uid).length ? "pending" : "idle";
  })().catch(() => { syncState = "error"; throw new Error("Cloud sync failed. Local changes are preserved; reconnect or refresh to retry."); })
    .finally(() => { activeSync = null; changed(); if (syncAgain) { syncAgain = false; void syncFromFirestore().catch(() => {}); } });
  return activeSync;
}

export function watchFinancialData(onError: () => void) {
  const uid = owner();
  const unsubscribe = ["transactions", "loans", "cards"].map((entity) => onSnapshot(collection(firestoreDb, "users", uid, entity),
    (snapshot) => { if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites && auth.currentUser?.uid === uid) void syncFromFirestore().catch(onError); }, onError));
  return () => unsubscribe.forEach((stop) => stop());
}

onAuthStateChanged(auth, () => { changed(); if (auth.currentUser) void syncFromFirestore().catch(() => {}); });
NetInfo.addEventListener((state) => { if (state.isConnected && auth.currentUser) void syncFromFirestore().catch(() => {}); });
