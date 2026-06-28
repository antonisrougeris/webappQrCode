import { firebaseAuth } from "../../services/firebase";
import { saveToken } from "../../services/auth";
import { apiRequest } from "../../services/api";

interface Order {
  id: string;
  orderNumber?: string;
  total?: number;
  currency?: string;
  paymentStatus?: string;
  status?: string;
  qrCodesCreated?: number;
  createdAt?: string;
  payment?: {
    paidAt?: string;
    transactionId?: string;
  };
}

function formatPrice(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency,
  }).format(value || 0);
}

function formatDate(value?: string): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("el-GR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getOrderLookup(): { type: "id" | "viva"; value: string } | null {
  const params = new URLSearchParams(window.location.search);

  const orderId = params.get("orderId");
  if (orderId) return { type: "id", value: orderId };

  const vivaOrderCode = params.get("s");
  if (vivaOrderCode) return { type: "viva", value: vivaOrderCode };

  return null;
}

function waitForAuthReady(timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;

    const timer = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      unsubscribe();
      resolve(Boolean(firebaseAuth.currentUser));
    }, timeoutMs);

    const unsubscribe = firebaseAuth.onAuthStateChanged(async (user) => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(timer);

      if (user) {
        const token = await user.getIdToken(true);
        saveToken(token);
      }

      unsubscribe();
      resolve(Boolean(user));
    });
  });
}

async function loadOrder(): Promise<void> {
  const container = document.getElementById("orderSummary");
  if (!container) return;

  const lookup = getOrderLookup();

  if (!lookup) {
    container.innerHTML = `<p>Payment completed, but no order ID was provided.</p>`;
    return;
  }

  container.innerHTML = `<p>Loading your order...</p>`;

  try {
    const path =
      lookup.type === "id"
        ? `/orders/${encodeURIComponent(lookup.value)}`
        : `/orders/viva/${encodeURIComponent(lookup.value)}`;

    const res = await apiRequest<{ order: Order }>(path);
    const order = res.order;

    container.innerHTML = `
      <div class="payment-summary-row">
        <span>Order Number</span>
        <strong>${order.orderNumber || order.id}</strong>
      </div>

      <div class="payment-summary-row">
        <span>Amount Paid</span>
        <strong>${formatPrice(order.total || 0, order.currency || "EUR")}</strong>
      </div>

      <div class="payment-summary-row">
        <span>Payment Status</span>
        <strong>${order.paymentStatus || order.status || "paid"}</strong>
      </div>

      <div class="payment-summary-row">
        <span>QR Products Created</span>
        <strong>${order.qrCodesCreated || 0}</strong>
      </div>

      <div class="payment-summary-row">
        <span>Date</span>
        <strong>${formatDate(order.payment?.paidAt || order.createdAt)}</strong>
      </div>
    `;
  } catch (error) {
    console.error("Failed to load order:", error);

    container.innerHTML = `
      <p>Your payment was successful.</p>
      <p>We are finalizing your order details. Please refresh in a few seconds.</p>
      <p>Order reference: <strong>${lookup.value}</strong></p>
    `;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const authed = await waitForAuthReady();

  console.log("Payment success auth:", {
    authed,
    currentUser: firebaseAuth.currentUser?.uid || null,
  });

  await loadOrder();
});