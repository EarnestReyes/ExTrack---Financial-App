import { auth } from "../../services/firebase/client";
import { assertOwner, owner } from "../access";
import { readOwned, reconcileOwned } from "./ownedRecordRepository";
import { save } from "./shared";

export const getUserProfilePicture = () => readOwned<{ photoURL?: string }>(auth.currentUser?.uid, "user_profile")[0]?.photoURL || null;

export function cacheUserProfile(uid: string, profile: Record<string, unknown>) {
  assertOwner(uid);
  reconcileOwned(uid, "user_profile", [{ id: "profile", data: profile }]);
}

export async function setUserProfilePicture(uri: string) {
  const uid = owner();
  const previous = readOwned<{updatedAt?: string}>(uid, "user_profile")[0];
  save(uid, "user_profile", "profile", { photoURL: uri, updatedAt: new Date().toISOString(), _expectedUpdatedAt: previous?.updatedAt || null }, "UPDATE");
  return true;
}

export const getInitials = (name?: string | null, email?: string | null) => (name?.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || email?.slice(0, 2) || "U").toUpperCase();
