/**
 * Poll the authenticated order API while Viva's verified webhook finishes.
 *
 * A return to /payment/success is NOT proof of payment. Only the server's
 * explicit paymentStatus=paid can authorize purchase tracking.
 */
export interface PaymentStatusSource {
  paymentStatus?: string;
}

export type PaymentConfirmation<T extends PaymentStatusSource> = {
  state: "paid" | "failed" | "pending" | "unavailable";
  order: T | null;
};

export function paymentState(order: PaymentStatusSource | null | undefined): "paid" | "failed" | "pending" {
  const status = String(order?.paymentStatus || "").trim().toLowerCase();
  if (status === "paid") return "paid";
  if (["failed", "cancelled", "canceled", "declined", "rejected", "expired"].includes(status)) return "failed";
  return "pending";
}

export async function pollForPaymentConfirmation<T extends PaymentStatusSource>(
  fetchOrder: () => Promise<T>,
  options: {
    attempts?: number;
    intervalMs?: number;
    wait?: (ms: number) => Promise<void>;
  } = {}
): Promise<PaymentConfirmation<T>> {
  const attempts = options.attempts ?? 20;
  const intervalMs = options.intervalMs ?? 1500;
  const wait = options.wait || ((ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms)));
  let order: T | null = null;
  let consecutiveErrors = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      order = await fetchOrder();
      consecutiveErrors = 0;
    } catch {
      consecutiveErrors += 1;
      // Do not flood the API if the user is signed out or the API is unavailable.
      if (consecutiveErrors >= 3) {
        return { state: order ? paymentState(order) : "unavailable", order };
      }
    }

    const state = paymentState(order);
    if (state !== "pending") return { state, order };

    if (attempt < attempts - 1) await wait(intervalMs);
  }

  return { state: order ? "pending" : "unavailable", order };
}
