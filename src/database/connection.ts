import * as SQLite from "expo-sqlite";
import { initializeOwnedDatabase } from "./schema";

const databases = new Map<string, SQLite.SQLiteDatabase>();

export function ownedDatabase(uid: string): SQLite.SQLiteDatabase {
  if (!uid) throw new Error("Authentication is required.");
  const existing = databases.get(uid);
  if (existing) return existing;
  const fileId = Array.from(uid).map((char) => char.codePointAt(0)!.toString(16).padStart(6, "0")).join("");
  const db = SQLite.openDatabaseSync(`extrack-owned-v1-${fileId}.db`);
  initializeOwnedDatabase(db);
  databases.set(uid, db);
  return db;
}
