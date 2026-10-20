import type * as SQLite from "expo-sqlite";

export function initializeOwnedDatabase(db: SQLite.SQLiteDatabase) {
  const version = db.getFirstSync<{ user_version: number }>("PRAGMA user_version")?.user_version || 0;
  if (version > 1) throw new Error("This database requires a newer app version.");
  db.withTransactionSync(() => {
    db.execSync(`CREATE TABLE IF NOT EXISTS records (
      ownerUid TEXT NOT NULL, entity TEXT NOT NULL, firestoreId TEXT NOT NULL,
      payload TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ownerUid, entity, firestoreId));
      CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ownerUid TEXT NOT NULL, entity TEXT NOT NULL,
      firestoreId TEXT NOT NULL, action TEXT NOT NULL, payload TEXT NOT NULL);
      PRAGMA user_version = 1;`);
  });
}
