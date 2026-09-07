import { ApiError } from "../utils/apiError.js";
import { nowIso } from "../utils/ids.js";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function getBoxNowMode() {
  return String(
    process.env.BOXNOW_MODE || "mock"
  )
    .trim()
    .toLowerCase();
}

function isMockMode() {
  return getBoxNowMode() === "mock";
}

function getConfig() {
  return {
    mode: getBoxNowMode(),

    apiUrl: String(
      process.env.BOXNOW_API_URL || ""
    ).replace(/\/+$/, ""),

    clientId: String(
      process.env.BOXNOW_CLIENT_ID || ""
    ).trim(),

    clientSecret: String(
      process.env.BOXNOW_CLIENT_SECRET || ""
    ).trim(),

    originId: String(
      process.env.BOXNOW_ORIGIN_ID || ""
    ).trim(),
  };
}


/* ==================================================
   MOCK
================================================== */

function createMockParcelId() {
  return (
    "MOCK-BN-" +
    Date.now().toString(36).toUpperCase()
  );
}

function createMockDelivery(order) {
  const parcelId = createMockParcelId();
  const createdAt = nowIso();

  return {
    mock: true,

    parcelId,

    orderNumber: order.orderNumber,

    status: "new",

    trackingNumber: parcelId,

    trackingUrl:
      `/mock/boxnow/${parcelId}`,

    createdAt,
  };
}


/* ==================================================
   AUTH
================================================== */

async function getAccessToken() {
  if (isMockMode()) {
    return "mock-token";
  }

  const {
    apiUrl,
    clientId,
    clientSecret,
  } = getConfig();

  if (
    !apiUrl ||
    !clientId ||
    !clientSecret
  ) {
    throw new ApiError(
      500,
      "BOX NOW is not configured"
    );
  }

  if (
    cachedToken &&
    Date.now() <
      cachedTokenExpiresAt - 60_000
  ) {
    return cachedToken;
  }

  const response = await fetch(
    `${apiUrl}/api/v1/auth-sessions`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Accept:
          "application/json",
      },

      body: JSON.stringify({
        grant_type:
          "client_credentials",

        client_id:
          clientId,

        client_secret:
          clientSecret,
      }),
    }
  );

  const body =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    console.error(
      "BOX NOW authentication failed",
      {
        status:
          response.status,

        body,
      }
    );

    throw new ApiError(
      502,
      "BOX NOW authentication failed"
    );
  }

  cachedToken =
    body?.access_token ||
    body?.accessToken ||
    body?.token;

  if (!cachedToken) {
    throw new ApiError(
      502,
      "BOX NOW did not return access token"
    );
  }

  const expiresIn =
    Number(
      body?.expires_in ||
      body?.expiresIn ||
      3600
    );

  cachedTokenExpiresAt =
    Date.now() +
    expiresIn * 1000;

  return cachedToken;
}


/* ==================================================
   GENERIC REQUEST
================================================== */

async function boxNowRequest(
  path,
  {
    method = "GET",
    body,
  } = {}
) {
  const {
    apiUrl,
  } = getConfig();

  const token =
    await getAccessToken();

  const response = await fetch(
    `${apiUrl}${path}`,
    {
      method,

      headers: {
        Accept:
          "application/json",

        Authorization:
          `Bearer ${token}`,

        ...(body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
      },

      ...(body
        ? {
            body:
              JSON.stringify(body),
          }
        : {}),
    }
  );

  const responseBody =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    console.error(
      "BOX NOW request failed",
      {
        path,
        status:
          response.status,
        body:
          responseBody,
      }
    );

    throw new ApiError(
      502,
      "BOX NOW request failed"
    );
  }

  return responseBody;
}


/* ==================================================
   DELIVERY
================================================== */

export async function createBoxNowDelivery(
  order
) {
  if (!order) {
    throw new ApiError(
      400,
      "Missing order"
    );
  }

  if (
    order.delivery !== "boxnow"
  ) {
    return null;
  }

  /*
   * MOCK MODE
   */

  if (isMockMode()) {
    console.log(
      "BOX NOW MOCK delivery created",
      {
        orderId:
          order.id,

        orderNumber:
          order.orderNumber,
      }
    );

    return createMockDelivery(order);
  }

  /*
   * REAL/STAGE MODE
   */

  const {
    originId,
  } = getConfig();

  if (!originId) {
    throw new ApiError(
      500,
      "BOX NOW origin is missing"
    );
  }

  const lockerId =
    typeof order.locker === "string"
      ? order.locker
      : order.locker?.id ||
        order.locker
          ?.boxnowLockerId;

  if (!lockerId) {
    throw new ApiError(
      400,
      "BOX NOW locker is missing"
    );
  }

  const payload = {
    orderNumber:
      order.orderNumber,

    description:
      `Skanare order ${order.orderNumber}`,

    origin: {
      id: originId,
    },

    destination: {
      id: String(lockerId),
    },

    recipient: {
      name: [
        order.customer
          ?.firstName,

        order.customer
          ?.lastName,
      ]
        .filter(Boolean)
        .join(" "),

      email:
        order.customer?.email ||
        "",

      phoneNumber:
        order.customer?.phone ||
        "",
    },
  };

  return boxNowRequest(
    "/api/v1/delivery-requests",
    {
      method: "POST",
      body: payload,
    }
  );
}


/* ==================================================
   TRACKING
================================================== */

export async function getBoxNowParcel({
  orderNumber,
  parcelId,
}) {
  if (isMockMode()) {
    return {
      mock: true,

      parcelId:
        parcelId || null,

      orderNumber:
        orderNumber || null,

      status:
        "in-depot",
    };
  }

  const params =
    new URLSearchParams();

  if (orderNumber) {
    params.set(
      "orderNumber",
      String(orderNumber)
    );
  }

  if (parcelId) {
    params.set(
      "parcelId",
      String(parcelId)
    );
  }

  return boxNowRequest(
    `/api/v1/parcels?${params.toString()}`
  );
}