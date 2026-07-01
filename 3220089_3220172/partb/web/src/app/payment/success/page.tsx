"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";
import { saveToken } from "@/lib/auth";
import { getOrderById, getOrderByVivaCode, type Order } from "@/lib/api";

export default function PaymentSuccessPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("Loading order details...");
  const [reference, setReference] = useState("");

  useEffect(() => {
    void loadOrder();
  }, []);

  async function waitForAuthReady(timeoutMs = 4000): Promise<void> {
    await new Promise<void>((resolve) => {
      let resolved = false;

      const timer = window.setTimeout(() => {
        if (resolved) return;
        resolved = true;
        unsubscribe();
        resolve();
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
        resolve();
      });
    });
  }

  function getOrderLookup(): { type: "id" | "viva"; value: string } | null {
    const params = new URLSearchParams(window.location.search);

    const orderId = params.get("orderId");
    if (orderId) return { type: "id", value: orderId };

    const vivaOrderCode = params.get("s");
    if (vivaOrderCode) return { type: "viva", value: vivaOrderCode };

    return null;
  }

  async function loadOrder() {
    const lookup = getOrderLookup();

    if (!lookup) {
      setMessage("Payment completed, but no order ID was provided.");
      return;
    }

    setReference(lookup.value);

    try {
      await waitForAuthReady();

      const loadedOrder =
        lookup.type === "id"
          ? await getOrderById(lookup.value)
          : await getOrderByVivaCode(lookup.value);

      setOrder(loadedOrder);
      setMessage("");
    } catch (error) {
      console.error("Failed to load order:", error);
      setMessage(
        "Your payment was successful. We are finalizing your order details. Please refresh in a few seconds."
      );
    }
  }

  return (
    <main className="payment-page">
      <section className="payment-card success">
        <div className="payment-icon">✅</div>

        <p className="payment-eyebrow">Payment confirmed</p>
        <h1>Thank you for your order</h1>

        <p className="payment-copy">
          Your payment was successful and your QR products are now active.
        </p>

        <div className="payment-summary">
          {order ? (
            <>
              <SummaryRow
                label="Order Number"
                value={order.orderNumber || order.id}
              />
              <SummaryRow
                label="Amount Paid"
                value={formatPrice(order.total || 0, order.currency || "EUR")}
              />
              <SummaryRow
                label="Payment Status"
                value={order.paymentStatus || order.status || "paid"}
              />
              <SummaryRow
                label="QR Products Created"
                value={String(order.qrCodesCreated || 0)}
              />
              <SummaryRow
                label="Date"
                value={formatDate(order.payment?.paidAt || order.createdAt)}
              />
            </>
          ) : (
            <>
              <p>{message}</p>
              {reference ? (
                <p>
                  Order reference: <strong>{reference}</strong>
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="payment-actions">
          <Link href="/#userDashboardHero" className="btn-primary">
            View My QR Codes
          </Link>

          <Link href="/" className="btn-secondary">
            Continue Shopping
          </Link>
        </div>
      </section>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="payment-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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
