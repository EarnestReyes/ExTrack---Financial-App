import * as FileSystem from "expo-file-system/legacy";
import { defaultDatabaseDirectory } from "expo-sqlite";
import { Platform } from "react-native";

/** Detects the legacy file without opening its database or changing any record.
 * Record-level ownership recovery remains blocked until a backup is verified. */
export async function legacyStorageStatus(): Promise<"present" | "absent" | "unknown"> {
  if (Platform.OS === "web") return "unknown";
  try {
    const info = await FileSystem.getInfoAsync(`${defaultDatabaseDirectory.replace(/\/$/, "")}/extrack.db`);
    return info.exists ? "present" : "absent";
  } catch { return "unknown"; }
}
