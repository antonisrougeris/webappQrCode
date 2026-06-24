import { ApiError } from "../utils/apiError.js";

const VIVA_DEMO_API = "https://demo-api.vivapayments.com";
const VIVA_LIVE_API = "https://api.vivapayments.com";

const VIVA_DEMO_ACCOUNTS = "https://demo-accounts.vivapayments.com";
const VIVA_LIVE_ACCOUNTS = "https://accounts.vivapayments.com";

const VIVA_DEMO_CHECKOUT = "https://demo.vivapayments.com/web/checkout";
const VIVA_LIVE_CHECKOUT = "https://www.vivapayments.com/web/checkout";

function isLive() {
  return process.env.VIVA_ENV === "live";
}

function getVivaBaseApi() {
  return isLive() ? VIVA_LIVE_API : VIVA_DEMO_API;
}

function getVivaAccountsBase() {
  return isLive() ? VIVA_LIVE_ACCOUNTS : VIVA_DEMO_ACCOUNTS;
}

function getVivaCheckoutBase() {
  return isLive() ? VIVA_LIVE_CHECKOUT : VIVA_DEMO_CHECKOUT;
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function getVivaAccessToken() {
  const clientId = getRequiredEnv("VIVA_CLIENT_ID");
  const clientSecret = getRequiredEnv("VIVA_CLIENT_SECRET");

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch(`${getVivaAccountsBase()}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    console.error("Viva auth failed:", response.status, payload);
    throw new ApiError(502, "Failed to authenticate with Viva", payload);
  }

  if (!payload?.access_token) {
    throw new ApiError(502, "Viva did not return access token", payload);
  }

  return payload.access_token;
}

export async function createVivaPaymentOrder(order) {
  const token = await getVivaAccessToken();

  const sourceCode = process.env.VIVA_SOURCE_CODE || null;
  const publicBaseUrl = getRequiredEnv("PUBLIC_BASE_URL");

  const amountInCents = Math.round(Number(order.total || 0) * 100);

  if (!Number.isInteger(amountInCents) || amountInCents < 1) {
    throw new ApiError(400, "Invalid payment amount");
  }

  const body = {
    amount: amountInCents,
    customerTrns: `Order ${order.orderNumber}`,
    merchantTrns: order.id,

    customer: {
      email: order.customer.email,
      fullName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      phone: order.customer.phone || "",
      countryCode: "GR",
      requestLang: "el-GR",
    },

    paymentTimeout: 1800,
    preauth: false,
    allowRecurring: false,
    maxInstallments: 0,
    paymentNotification: true,
    tipAmount: 0,
    disableExactAmount: false,
    disableCash: true,
    disableWallet: false,

    tags: ["skanare", order.id],

    redirectUrl: `${publicBaseUrl}/payment-success.html?orderId=${encodeURIComponent(
      order.id
    )}`,
    cancelUrl: `${publicBaseUrl}/payment-failure.html?orderId=${encodeURIComponent(
      order.id
    )}`,

    ...(sourceCode ? { sourceCode } : {}),
  };

  const response = await fetch(`${getVivaBaseApi()}/checkout/v2/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    console.error("Viva create order failed:", response.status, payload);
    throw new ApiError(502, "Failed to create Viva payment order", payload);
  }

  const orderCode = String(payload?.orderCode || payload?.OrderCode || "");

  if (!orderCode) {
    throw new ApiError(502, "Viva did not return an order code", payload);
  }

  return {
    vivaOrderCode: orderCode,
    checkoutUrl: `${getVivaCheckoutBase()}?ref=${encodeURIComponent(
      orderCode
    )}`,
    raw: payload,
  };
}
