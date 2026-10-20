import * as SQLite from "expo-sqlite";

let preferences: SQLite.SQLiteDatabase | null = null;

function prefs() { if (!preferences) { preferences = SQLite.openDatabaseSync("extrack-preferences-v1.db"); preferences.execSync("CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)"); } return preferences; }

export const getThemePreference = () => prefs().getFirstSync<{value: string}>("SELECT value FROM preferences WHERE key = ?", ["theme"])?.value || null;

export const setThemePreference = (value: string) => { prefs().runSync("INSERT OR REPLACE INTO preferences (key,value) VALUES (?,?)", ["theme", value]); };
