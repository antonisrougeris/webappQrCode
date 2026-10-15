import crypto from "node:crypto";
import { getMessaging } from "firebase-admin/messaging";
import { getDB } from "../config/db.js";

const collection = () => getDB().collection("adminPushSubscriptions");
export const subscriptionId = token => crypto.createHash("sha256").update(String(token)).digest("hex");

export async function saveAdminPushToken(uid, token) {
  if (typeof token !== "string" || token.length < 40 || token.length > 4096) throw new Error("Invalid push token");
  await collection().doc(subscriptionId(token)).set({ uid, token, updatedAt: new Date().toISOString() }, { merge: true });
}
export async function deleteAdminPushToken(uid, token) {
  if (!token) return;
  const ref = collection().doc(subscriptionId(token));
  const snap = await ref.get();
  if (snap.exists && snap.data().uid === uid) await ref.delete();
}

/** A push provider outage must not affect checkout or contact-form completion. */
export async function sendAdminPush({ title, body, url }) {
  try {
    const snapshot = await collection().limit(500).get();
    const docs = snapshot.docs.filter(doc => typeof doc.data().token === "string");
    if (!docs.length) return;
    const tokens = docs.map(doc => doc.data().token);
    const result = await getMessaging().sendEachForMulticast({
      tokens,
      data: { title: String(title).slice(0, 120), body: String(body).slice(0, 200), url: String(url) },
      webpush: { headers: { Urgency: "high" } },
    });
    await Promise.all(result.responses.map(async (response, i) => {
      if (!response.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(response.error?.code)) {
        await docs[i].ref.delete();
      }
    }));
    if (result.failureCount) console.warn("admin_push_partial_failure", { failures: result.failureCount });
  } catch (err) {
    console.warn("admin_push_failed", { message: err?.message || String(err) });
  }
}
