import {HttpsError} from "firebase-functions/v2/https";
import {store} from "../config/firebase";

/** Enforces the existing per-user request limit.
 * @param {string} uid Account identifier.
 * @param {string} operation Service name.
 * @param {number} maximum Requests per minute.
 * @return {Promise<void>} Resolves when allowed.
 */
export async function limit(uid: string, operation: string, maximum: number) {
  const window = Math.floor(Date.now() / 60000);
  const ref = store.doc("service_limits/" + uid + "_" + operation);
  await store.runTransaction(async (tx) => {
    const previous = (await tx.get(ref)).data();
    const count = previous?.window === window ? Number(previous.count) : 0;
    if (count >= maximum) {
      throw new HttpsError("resource-exhausted",
        "Please wait before trying again.");
    }
    tx.set(ref, {window, count: count + 1});
  });
}
