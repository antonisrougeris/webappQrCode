import { pollForPaymentConfirmation, type PaymentConfirmation } from "../../services/payment-confirmation";
import { trackPaidPurchase, type PaidPurchaseOrder } from "../../services/purchase-analytics";
import "../../i18n/auto";
import { firebaseAuth } from "../../services/firebase";
import { apiRequest } from "../../services/api";
import { locale, t } from "../../i18n/locale";

interface Order {
  id: string;
  orderNumber?: string;
  items?: PaidPurchaseOrder["items"];
  subtotal?: number;
  shippingCost?: number;
  recoveryDiscountAmount?: number;
  recoveryDiscount?: PaidPurchaseOrder["recoveryDiscount"];
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
  return new Intl.NumberFormat(
    locale === "el" ? "el-GR" : "en-IE",
    {
    style: "currency",
      currency,
    }
  ).format(value || 0);
}

function formatDate(value?: string): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat(
    locale === "el" ? "el-GR" : "en-GB",
    {
    dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(value));
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

      unsubscribe();
      resolve(Boolean(user));
    });
  });
}

let lastConfirmedPaidOrder: Order | null = null;

function showPaymentState(state: PaymentConfirmation<Order>["state"]): void {
  const el = (selector: string): HTMLElement | null => document.querySelector<HTMLElement>(selector);
  const heading = el(".payment-result h1");
  const eyebrow = el(".payment-result__eyebrow");
  const description = el(".payment-result__text");
  const subtext = el(".payment-result__subtext");
  const icon = el(".payment-result__icon");
  const card = el(".payment-result");
  card?.classList.toggle("payment-result--success", state === "paid");
  if (icon) icon.style.display = state === "paid" ? "" : "none";

  if (state === "paid") {
    if (heading) heading.textContent = "Thank you for your order";
    if (eyebrow) eyebrow.textContent = "Payment confirmed";
    if (description) description.textContent = "Your payment was completed successfully. Your order is now being processed.";
    if (subtext) subtext.textContent = "You can manage your active QR codes from your account.";
    icon?.classList.add("payment-result__icon--success");
  } else if (state === "failed") {
    if (heading) heading.textContent = "Payment not completed";
    if (eyebrow) eyebrow.textContent = "Payment status";
    if (description) description.textContent = "The payment was not completed. No purchase has been recorded.";
    if (subtext) subtext.textContent = "Return to checkout to try again, or contact us if you were charged.";
    icon?.classList.remove("payment-result__icon--success");
  } else {
    if (heading) heading.textContent = "Checking your payment";
    if (eyebrow) eyebrow.textContent = "Awaiting confirmation";
    if (description) description.textContent = "We are waiting for confirmation from our payment provider. Please do not pay again yet.";
    if (subtext) subtext.textContent = "If the payment has just completed, wait a moment or refresh this page.";
    icon?.classList.remove("payment-result__icon--success");
  }
}

async function loadOrder(): Promise<void> {
  const container = document.getElementById("orderSummary");
  if (!container) return;

  const lookup = getOrderLookup();
  showPaymentState("pending");

  if (!lookup) {
    container.textContent = "No order reference was provided. Please check your account orders.";
    return;
  }

  container.textContent = "Checking your payment status with Viva...";

  const path = lookup.type === "id"
    ? `/orders/${encodeURIComponent(lookup.value)}`
    : `/orders/viva/${encodeURIComponent(lookup.value)}`;

  // This request is authenticated; the server verifies that the order belongs
  // to the logged-in customer. URL parameters alone are not payment evidence.
  const result = await pollForPaymentConfirmation<Order>(async () => {
    const response = await apiRequest<{ order: Order }>(path);
    if (!response?.order) throw new Error("Order not found");
    return response.order;
  });

  showPaymentState(result.state);
  const order = result.order;
  if (result.state === "paid" && order) {
    lastConfirmedPaidOrder = order;
    trackPaidPurchase(order);
  }

  if (result.state === "failed") {
    container.textContent = "The payment is not marked as successful. Please review your order before attempting payment again.";
    return;
  }
  if (result.state !== "paid" || !order) {
    container.textContent = result.state === "unavailable"
      ? "Unable to verify the payment at the moment. Please sign in and refresh to check your order."
      : "Your payment is still pending confirmation. If you have been charged, please wait and refresh before attempting another payment.";
    return;
  }

  // Render payment details only for a confirmed, paid order.
  container.innerHTML = `
    <div class="payment-summary-row">
      <span>${t("payment.orderNumber", "Order Number")}</span>
      <strong></strong>
    </div>
    <div class="payment-summary-row">
      <span>${t("payment.amountPaid", "Amount Paid")}</span>
      <strong></strong>
    </div>
    <div class="payment-summary-row">
      <span>${t("payment.status", "Payment Status")}</span>
      <strong></strong>
    </div>
    <div class="payment-summary-row">
      <span>${t("payment.qrCreated", "QR Products Created")}</span>
      <strong></strong>
    </div>
    <div class="payment-summary-row">
      <span>${t("payment.date", "Date")}</span>
      <strong></strong>
    </div>
  `;
  // Use textContent for all order-sourced strings.
  const values = [
    String(order.orderNumber || order.id),
    formatPrice(order.total || 0, order.currency || "EUR"),
    String(order.paymentStatus || "paid"),
    String(order.qrCodesCreated || 0),
    formatDate(order.payment?.paidAt || order.createdAt)
  ];
  container.querySelectorAll<HTMLElement>(".payment-summary-row strong")
    .forEach((element, index) => { element.textContent = values[index] || ""; });
}

document.addEventListener("DOMContentLoaded", async () => {
  window.addEventListener("skanare:analytics-consent-accepted", () => {
    if (lastConfirmedPaidOrder) trackPaidPurchase(lastConfirmedPaidOrder);
  });
  const authed = await waitForAuthReady();

  console.log("Payment success auth:", {
    authed,
    currentUser: firebaseAuth.currentUser?.uid || null,
  });

  await loadOrder();
});