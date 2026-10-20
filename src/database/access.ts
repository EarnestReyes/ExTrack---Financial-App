import type { User } from "firebase/auth";
import { collection, doc } from "firebase/firestore";
import { auth, db as firestoreDb } from "../services/firebase/client";
import type { Entity } from "./types";

export function owner() { const uid = auth.currentUser?.uid; if (!uid) throw new Error("Sign in to access financial records."); return uid; }

export function assertOwner(uid: string) { if (auth.currentUser?.uid !== uid) throw new Error("Account changed. Please try again."); }

export const getCurrentUser = async (): Promise<User | null> => auth.currentUser;

export function path(uid: string, entity: Entity, id: string) { return entity === "user_profile" ? doc(firestoreDb, "users", uid) : doc(firestoreDb, "users", uid, entity, id); }

export function newId() { return doc(collection(firestoreDb, "_local_ids")).id; }
