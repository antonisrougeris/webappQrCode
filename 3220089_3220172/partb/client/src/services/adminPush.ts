import { getApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || "").trim();
function workerUrl() {
  const config = getApp().options;
  const query = new URLSearchParams({
    apiKey: String(config.apiKey || ""),
    authDomain: String(config.authDomain || ""),
    projectId: String(config.projectId || ""),
    messagingSenderId: String(config.messagingSenderId || ""),
    appId: String(config.appId || ""),
  });
  return "/firebase-messaging-sw.js?" + query.toString();
}

export async function enableAdminPush(request: (path: string, init?: RequestInit) => Promise<any>): Promise<string> {
  if (!vapidKey) throw new Error("Set VITE_FIREBASE_VAPID_KEY in your client build environment first.");
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported())) {
    throw new Error("Push notifications are unavailable in this browser.");
  }
  if (Notification.permission !== "granted" && await Notification.requestPermission() !== "granted") {
    throw new Error("Browser notification permission was not granted.");
  }
  const registration = await navigator.serviceWorker.register(workerUrl(), { scope: "/admin" });
  const messaging = getMessaging(getApp());
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Firebase did not return a push token.");
  await request("/push/subscription", { method: "POST", body: JSON.stringify({ token }) });
  localStorage.setItem("skanare-admin-push-token", token);
  onMessage(messaging, payload => {
    const data = payload.data || {};
    if (Notification.permission === "granted") {
      new Notification(data.title || "Skanare Admin", { body: data.body || "New activity", icon: "/assets/img/skanare-logo.webp" });
    }
  });
  return "Notifications enabled for this browser.";
}

export async function disableAdminPush(request: (path: string, init?: RequestInit) => Promise<any>): Promise<string> {
  const token = localStorage.getItem("skanare-admin-push-token");
  if (token) await request("/push/subscription", { method: "DELETE", body: JSON.stringify({ token }) });
  if (await isSupported()) await deleteToken(getMessaging(getApp())).catch(() => undefined);
  localStorage.removeItem("skanare-admin-push-token");
  return "Notifications disabled for this browser.";
}
