import { auth } from "../../services/firebase/client";
import { newId, owner } from "../access";
import type { SavedCard } from "../types";
import { readOwned } from "./ownedRecordRepository";
import { ownedRecord, save } from "./shared";

export const fetchCardsFromDB = () => readOwned<SavedCard>(auth.currentUser?.uid, "cards");

export async function insertCardToDB(card: SavedCard) {
  const uid = owner();
  validateCard(card);
  return save(uid, "cards", newId(), { ...card, ownerUid: uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, "INSERT");
}

export async function updateCardInDB(card: SavedCard) {
  const previous = ownedRecord<SavedCard>("cards", card.firestoreId);
  validateCard(card);
  save(owner(), "cards", previous.firestoreId!, { ...previous, ...card, updatedAt: new Date().toISOString(),
    _expectedUpdatedAt: (previous as SavedCard & {updatedAt?: string}).updatedAt || null }, "UPDATE");
}

function validateCard(card: SavedCard) {
  if (!card.name.trim() || card.name.length > 120 || !["Debit", "Credit"].includes(card.type) ||
    !/^\d{4}$/.test(card.lastFour) || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry) ||
    typeof card.amount !== "number" || !Number.isFinite(card.amount) || card.amount < 0 || card.amount > 1000000000) throw new Error("Check card summary details.");
}

export async function deleteCardFromDB(_id?: number | string, firestoreId?: string) {
  const card = ownedRecord<SavedCard>("cards", firestoreId); save(owner(), "cards", card.firestoreId!, { ...card }, "DELETE");
}

export async function clearCardsFromDB(): Promise<void> { throw new Error("Bulk financial deletion is disabled."); }
