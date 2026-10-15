/* Dedicated admin-only Firebase Cloud Messaging service worker. */
importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js");
const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || "Skanare Admin", {
    body: data.body || "New activity",
    icon: "/assets/img/skanare-logo.webp",
    tag: "skanare-" + (data.title || "event") + "-" + Date.now(),
    data: { url: data.url || "/admin" },
  });
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const candidate = event.notification.data?.url || "/admin";
  const target = new URL(candidate, self.location.origin);
  if (target.origin !== self.location.origin || !target.pathname.startsWith("/admin")) return;
  event.waitUntil(clients.openWindow(target.href));
});
