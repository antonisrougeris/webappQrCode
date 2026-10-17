import "./i18n/auto";
import { locale, translatePhrase, localizedPath } from "./i18n/locale";
import "./boxnow-tracking.css";
import { initOfferToast } from "./components/offerToast";
/* 3220089_3220172 */

import { initNav } from "./components/initNav";
import { initMobileMenu } from "./components/menu";
import { renderProducts } from "./components/renderProducts";
import { getProducts } from "./services/products";
import { updateCartBadge } from "./utils/cart-badge";
import { firebaseAuth } from "./services/firebase";
import { apiRequest } from "./services/api";
import { getMyReviewedProductIds } from "./services/reviews";
import { getMyQrCodes, type QrCode } from "./services/qr";
import { enhanceQrDestinationEditors } from "./components/qrDestinationEditor";


import QRCode from "qrcode";

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;

  for (const part of document.cookie.split(";")) {
    const cookie = part.trim();

    if (cookie.startsWith(prefix)) {
      return decodeURIComponent(cookie.slice(prefix.length));
    }
  }

  return null;
}

async function initGuestSession(): Promise<void> {
  try {
    // Prime the CSRF cookie through a safe request before creating a guest session.
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/health/live`, {
      method: "GET",
      credentials: "include",
    });

    const csrfToken = readCookie("csrf_token");

    await fetch(`${import.meta.env.VITE_API_BASE_URL}/session/guest`, {
      method: "POST",
      credentials: "include",
      headers: csrfToken
        ? { "X-CSRF-Token": csrfToken }
        : {},
    });
  } catch (error) {
    console.error("Failed to initialize guest session:", error);
  }
}

initOfferToast();


initNav();
initMobileMenu();
void initGuestSession().then(() => updateCartBadge());
/* =========================
   USER QR DASHBOARD
========================= */

async function renderQrDashboard(grid: HTMLElement, qrCodes: QrCode[]): Promise<void> {
  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  if (!qrCodes.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No QR codes yet</h3>
        <p>Your QR products will appear here after checkout.</p>
      </div>
    `;
    return;
  }

  const QR_REDIRECT_BASE_URL =
    import.meta.env.VITE_QR_REDIRECT_BASE_URL ||
    "https://redirectqr-qrk4dnnhta-ew.a.run.app";

  const htmlBlocks = await Promise.all(
    qrCodes.map(async (qr) => {
      const safeTarget = escapeHtml(qr.linkUrl || (qr.destinationType === "photo" ? "" : qr.targetUrl) || "");
      const title = escapeHtml(qr.productTitle || "QR Product");

      const publicQrId = qr.shortId || qr.id;

      const qrRedirectUrl = `${QR_REDIRECT_BASE_URL}/${encodeURIComponent(publicQrId)}`;

      // 🔥 LOCAL GENERATION (NO API)
      const qrDataUrl = await QRCode.toDataURL(qrRedirectUrl, {
        width: 400,              // printing safe
        margin: 1,
        color: {
          dark: "#000000",       // pure black
          light: "#00000000",      // pure transparent
        },
        errorCorrectionLevel: "H",
      });

      return `
        <article class="dashboard-card qr-dashboard-card qr-dashboard-card--polished" data-qr-editor="${escapeHtml(qr.id)}">
          <div class="qr-dashboard-card__head">
            <span class="qr-dashboard-card__eyebrow">QR PRODUCT</span>
            <span class="qr-dashboard-card__scans">${Math.max(0, Number(qr.scans) || 0)} scans</span>
          </div>

          <div class="qr-dashboard-card__body">
            <div class="qr-dashboard-card__identity">
              <div class="qr-dashboard-card__qr-frame">
                <img
                  class="qr-dashboard-image"
                  src="${qrDataUrl}"
                  alt="QR code for ${title}"
                  loading="lazy"
                  width="136"
                  height="136"
                />
              </div>
              <div class="qr-dashboard-card__details">
                <h3 class="qr-dashboard-title">${title}</h3>
                <a
                  class="qr-dashboard-card__view-link"
                  href="${escapeHtml(qrRedirectUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open QR link for ${title}"
                >Open QR <span aria-hidden="true">↗</span></a>
              </div>
            </div>

            <div class="qr-dashboard-card__editor">
              <label class="qr-edit-label" data-qr-destination-label for="input-${escapeHtml(qr.id)}">
                Destination URL
              </label>
              <div class="qr-edit-row" data-qr-link-fields>
                <input
                  id="input-${escapeHtml(qr.id)}"
                  class="qr-edit-input"
                  type="url"
                  value="${safeTarget}"
                  placeholder="https://example.com"
                />
                <button
                  type="button"
                  class="btn-primary qr-save-btn"
                  data-qr-id="${escapeHtml(qr.id)}"
                >Save</button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
  );

  grid.innerHTML = htmlBlocks.join("");
  enhanceQrDestinationEditors(grid, qrCodes);



}


/* =========================================================
   CUSTOMER ORDERS
   ========================================================= */

async function getOrders(): Promise<any[]> {
  const user = firebaseAuth.currentUser;

  if (!user) {
    return [];
  }

  const token = await user.getIdToken();

  const API_BASE_URL =
    (
      import.meta.env.VITE_API_BASE_URL ||
      "/api"
    ).replace(/\/$/, "");

  const response = await fetch(
    `${API_BASE_URL}/orders`,
    {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },

      credentials: "include",
    }
  );

  const payload =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.message ||
      payload?.error ||
      `Failed to load orders (${response.status})`
    );
  }

  /*
   * Support the common response formats:
   *
   * { orders: [...] }
   * { data: { orders: [...] } }
   * { data: [...] }
   * [...]
   */

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.orders)) {
    return payload.orders;
  }

  if (Array.isArray(payload?.data?.orders)) {
    return payload.data.orders;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}


/* =========================================================
   CUSTOMER ORDER UI
   ========================================================= */

function accountEscapeHtml(
  value: unknown
): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


const CUSTOMER_ORDER_STEPS = [
  "to_prepare",
  "preparing",
  "ready",
  "shipped",
  "completed",
];


const CUSTOMER_ORDER_LABELS:
  Record<string, string> = {

    to_prepare:
      "To prepare",

    preparing:
      "Preparing",

    ready:
      "Ready",

    shipped:
      "Shipped",

    completed:
      "Completed",

    cancelled:
      "Cancelled",

    pending:
      "Pending",
  };


const BOXNOW_TRACKING_EVENTS: Record<string, { en: string; el: string }> = {
  new: { en: "Awaiting collection from the e-shop", el: "Σε αναμονή παραλαβής από το E-shop" },
  "accepted-to-locker": { en: "Being delivered", el: "Σε διαδικασία παράδοσης" },
  "in-depot": { en: "Being delivered", el: "Σε διαδικασία παράδοσης" },
  "accepted-for-return": { en: "Being delivered", el: "Σε διαδικασία παράδοσης" },
  "final-destination": { en: "Your parcel is at the locker", el: "Το δέμα σας βρίσκεται στη θυρίδα" },
  delivered: { en: "Your parcel has been delivered", el: "Το δέμα σας παραδόθηκε" },
  returned: { en: "Parcel has been returned", el: "Το δέμα έχει επιστραφεί" },
  expired: { en: "Expired return", el: "Η επιστροφή έχει λήξει" },
  canceled: { en: "Canceled", el: "Ακυρώθηκε" },
  missing: { en: "Parcel under investigation", el: "Προς εντοπισμό" },
  lost: { en: "Parcel under investigation", el: "Προς εντοπισμό" },
};

function getBoxNowTrackingStatus(order: any): string {
  const greek = document.documentElement.lang.toLowerCase().startsWith("el") ||
    window.location.pathname.startsWith("/el/");
  const lang = greek ? "el" : "en";
  const event = String(
    order?.shipping?.boxnow?.lastEvent || order?.shipping?.status || ""
  ).trim().toLowerCase();
  if (BOXNOW_TRACKING_EVENTS[event]) return BOXNOW_TRACKING_EVENTS[event][lang];
  // Do not misrepresent a locally-created voucher as a carrier update.
  return greek ? "Αναμονή ενημέρωσης από BOX NOW" : "Awaiting BOX NOW tracking update";
}

function getCustomerOrderStatus(
  order: any
): string {

  const fulfillment =
    String(
      order?.fulfillmentStatus || ""
    )
      .trim()
      .toLowerCase();


  if (fulfillment) {
    return fulfillment;
  }


  const payment =
    String(
      order?.paymentStatus ||
      order?.status ||
      ""
    )
      .trim()
      .toLowerCase();


  /*
   * Paid but fulfillment has not
   * been initialized yet.
   */
  if (payment === "paid") {
    return "to_prepare";
  }


  if (
    payment === "cancelled" ||
    payment === "canceled"
  ) {
    return "cancelled";
  }


  return payment || "pending";
}


function customerOrderDate(
  value: any
): string {

  if (!value) {
    return "";
  }

  let date: Date;


  /*
   * Firestore Timestamp
   */
  if (
    typeof value === "object" &&
    typeof value?.toDate === "function"
  ) {
    date = value.toDate();
  }

  /*
   * Firestore serialized timestamp
   */
  else if (
    typeof value === "object" &&
    value?.seconds
  ) {
    date =
      new Date(
        Number(value.seconds) * 1000
      );
  }

  /*
   * ISO string / normal date
   */
  else {
    date =
      new Date(value);
  }


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}


function customerReturnWindowOpen(order: any): boolean {
  const deliveredAt =
    order?.shipping?.deliveredAt ||
    order?.completedAt ||
    (
      order?.shipping?.status === "delivered"
        ? order?.shipping?.updatedAt
        : null
    );

  if (!deliveredAt) return false;

  const deliveredMs =
    Date.parse(String(deliveredAt));

  if (!Number.isFinite(deliveredMs)) {
    return false;
  }

  const fourteenDaysMs =
    14 * 24 * 60 * 60 * 1000;

  const age =
    Date.now() - deliveredMs;

  return age >= 0 && age <= fourteenDaysMs;
}

type OrderReturn = {
  id: string;
  orderId: string;
  returnNumber?: string;
  status?: string;
  boxnow?: { parcelId?: string | null };
};

async function getCustomerReturns(): Promise<OrderReturn[]> {
  const response = await apiRequest<{ returns?: OrderReturn[] }>("/returns");
  return Array.isArray(response?.returns) ? response.returns : [];
}

function getActiveOrderReturn(order: any, requests: OrderReturn[]): OrderReturn | undefined {
  const orderId = String(order?.id || "");
  // Newest active return takes precedence. Cancelled and rejected requests
  // are not active and should not prevent a new eligible return.
  return requests.find(request =>
    request.orderId === orderId &&
    !["cancelled", "rejected"].includes(String(request.status || "").toLowerCase())
  );
}

function renderCustomerOrders(
  orders: any[],
  returns: OrderReturn[] = []
): void {

  const container =
    document.getElementById(
      "userOrdersList"
    );

  if (!container) {
    return;
  }


  if (!orders.length) {

    container.innerHTML = `
      <div class="account-orders__empty">
        You don't have any orders yet.
      </div>
    `;

    return;
  }


  const sortedOrders =
    [...orders].sort(
      (a, b) => {

        const aTime =
          new Date(
            a?.createdAt || 0
          ).getTime() || 0;

        const bTime =
          new Date(
            b?.createdAt || 0
          ).getTime() || 0;

        return bTime - aTime;
      }
    );


  container.innerHTML =
    sortedOrders
      .map((order) => {

        const status =
          getCustomerOrderStatus(
            order
          );


        const statusLabel =
          CUSTOMER_ORDER_LABELS[
            status
          ] ||
          status
            .replaceAll("_", " ")
            .replace(
              /\b\w/g,
              (letter) =>
                letter.toUpperCase()
            );


        const currentStep =
          CUSTOMER_ORDER_STEPS
            .indexOf(status);


        /*
         * ORDER PROGRESS
         */

        const progress =
          status === "cancelled" ||
          status === "pending"
            ? ""
            : `
              <div
                class="account-order__progress${status === "completed" ? " is-fully-complete" : ""}"
                aria-label="Order progress"
              >

                ${
                  CUSTOMER_ORDER_STEPS
                    .map(
                      (
                        step,
                        index
                      ) => {

                        let stateClass = "";

                        if (
                          currentStep >= 0 &&
                          index < currentStep
                        ) {
                          stateClass =
                            "is-complete";
                        }

                        if (
                          index === currentStep
                        ) {
                          stateClass =
                            "is-current";
                        }


                        return `
                          <div
                            class="
                              account-order__step
                              ${stateClass}
                            "
                          >
                            ${
                              CUSTOMER_ORDER_LABELS[
                                step
                              ]
                            }
                          </div>
                        `;
                      }
                    )
                    .join("")
                }

              </div>
            `;


        /*
         * PRODUCTS
         */

        const items =
          Array.isArray(
            order?.items
          )
            ? order.items
            : [];


        const products =
  items
    .map(
      (item: any) => {

        const title =
          item?.title ||
          item?.productTitle ||
          "Skanare product";

        const size =
          item?.variant?.size ||
          item?.size ||
          "";

        return `
          <div class="account-order__product">

            <strong>
              ${accountEscapeHtml(
                title
              )}
            </strong>

            ${
              size
                ? `
                  <span
                    class="account-order__product-size"
                  >
                    · Size ${accountEscapeHtml(
                      size
                    )}
                  </span>
                `
                : ""
            }

          </div>
        `;
      }
    )
    .join("");


        /*
         * BOX NOW / TRACKING
         */

        const rawBoxNowParcelId =
          String(
            order?.shipping
              ?.boxnow
              ?.parcelIds?.[0] ||
            order?.shipping
              ?.parcelId ||
            ""
          ).trim();

        const boxNowParcelId =
          /^\d{10}$/.test(
            rawBoxNowParcelId
          )
            ? rawBoxNowParcelId
            : "";

        const trackingNumber =
          boxNowParcelId ||
          (
            order?.shipping?.provider !== "boxnow"
              ? String(
                  order?.shipping
                    ?.trackingNumber ||
                  ""
                ).trim()
              : ""
          );

        const trackingUrl =
          boxNowParcelId
            ? `https://boxnow.gr/?track=${encodeURIComponent(
                boxNowParcelId
              )}`
            : String(
                order?.shipping
                  ?.trackingUrl ||
                ""
              ).trim();


        const carrier =
          order?.shipping?.carrier ||
          "BOX NOW";

        const isBoxNow =
          Boolean(boxNowParcelId) ||
          order?.shipping?.provider === "boxnow" ||
          order?.delivery === "boxnow";

        // Delivery tracking is no longer relevant once the parcel is delivered.
        // A customer return has its OWN parcel and tracking lifecycle.
        const canShowTracking =
          status !== "completed" &&
          Boolean(trackingNumber || trackingUrl) &&
          (isBoxNow || status === "shipped");

        const activeReturn = status === "completed"
          ? getActiveOrderReturn(order, returns)
          : undefined;
        const returnParcelId = String(activeReturn?.boxnow?.parcelId || "").trim();
        const returnTrackingUrl = /^\\d{10}$/.test(returnParcelId)
          ? `https://boxnow.gr/?track=${encodeURIComponent(returnParcelId)}`
          : "";
        const returnStatus = String(activeReturn?.status || "requested").replaceAll("_", " ");
        const returnTracking = activeReturn
          ? `
            <div class="account-order__tracking account-order__return" data-return-tracking>
              <div class="account-order__tracking-info">
                <span>Return ${accountEscapeHtml(activeReturn.returnNumber || "")}</span>
                <strong>${accountEscapeHtml(returnStatus)}</strong>
                ${returnParcelId ? `<span class="account-order__parcel-status">BOX NOW return: ${accountEscapeHtml(returnParcelId)}</span>` : ""}
              </div>
              <a
                href="/returns?returnId=${encodeURIComponent(activeReturn.id)}"
                class="account-order__tracking-link"
              >${translatePhrase("View return ↗")}</a>
              ${returnTrackingUrl
                ? `<a href="${accountEscapeHtml(returnTrackingUrl)}" target="_blank" rel="noopener noreferrer" class="account-order__tracking-link">${translatePhrase("Track return ↗")}</a>`
                : ""}
            </div>
          `
          : "";


        const tracking =
          canShowTracking
            ? `
              <div
                class="account-order__tracking"
              >

                <div
                  class="account-order__tracking-info"
                >

                  <span>
                    ${accountEscapeHtml(
                      carrier
                    )}
                    tracking
                  </span>

                  <strong>
                    ${accountEscapeHtml(
                      trackingNumber ||
                      "Shipment available"
                    )}
                  </strong>

                  ${isBoxNow ? `
                    <span class="account-order__parcel-status" role="status">
                      ${accountEscapeHtml(getBoxNowTrackingStatus(order))}
                    </span>
                  ` : ""}

                </div>


                ${
                  trackingUrl
                    ? `
                      <a
                        href="${accountEscapeHtml(
                          trackingUrl
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="account-order__tracking-link"
                      >
                        Track order ↗
                      </a>
                    `
                    : ""
                }

              </div>
            `
            : "";


        return `
          <article class="account-order">

            <div class="account-order__top">

              <div
                class="account-order__meta"
              >

                <span
                  class="account-order__label"
                >
                  Order
                </span>

                <h3
                  class="account-order__number"
                >
                  ${accountEscapeHtml(
                    order?.orderNumber ||
                    order?.id ||
                    ""
                  )}
                </h3>

                <span
                  class="account-order__date"
                >
                  ${accountEscapeHtml(
                    customerOrderDate(
                      order?.createdAt
                    )
                  )}
                </span>

              </div>


              <span
                class="
                  account-order__status
                  account-order__status--${accountEscapeHtml(
                    status
                  )}
                "
              >
                ${accountEscapeHtml(
                  statusLabel
                )}
              </span>

            </div>


            ${
              products
                ? `
                  <div
                    class="account-order__products"
                  >
                    ${products}
                  </div>
                `
                : ""
            }


            ${progress}

            ${tracking}
            ${returnTracking}

            ${!activeReturn && customerReturnWindowOpen(order)
              ? `
                <div class="account-order__tracking account-order__return">
                  <div class="account-order__tracking-info">
                    <span>${translatePhrase("Need to send something back?")}</span>
                    <strong>${translatePhrase("Start a self-service return")}</strong>
                  </div>
                  <a
                    href="/returns?orderId=${encodeURIComponent(order?.id || "")}"
                    class="account-order__tracking-link account-order__return-link"
                  >
                    ${translatePhrase("Return items →")}
                  </a>
                </div>
              `
              : ""}

          </article>
        `;
      })
      .join("");
}
/**
 * One persistent thank-you banner above Orders, based on the most recently
 * placed paid order. All orders show Contact immediately; a completed order
 * with an unreviewed product temporarily offers a verified review reward.
 * After the review, the same banner returns to the Contact message.
 */
function renderCustomerThankYou(orders: any[], reviewedProductIds: string[] | null): void {
  const panel = document.getElementById("customerThankYou");
  const message = document.getElementById("customerThankYouMessage");
  const action = document.getElementById("customerThankYouAction") as HTMLAnchorElement | null;
  if (!panel || !message || !action) return;

  // The customer order API returns paid orders. Don't show the banner for
  // accounts without an order, and don't use an older completed order to
  // override the support message for a newly placed order.
  const latestOrder = [...orders].sort((a, b) =>
    (Date.parse(String(b?.createdAt || "")) || 0) -
    (Date.parse(String(a?.createdAt || "")) || 0)
  )[0];

  if (!latestOrder) {
    panel.hidden = true;
    return;
  }

  const completed = getCustomerOrderStatus(latestOrder) === "completed";
  // If status couldn't be fetched, don't accidentally offer a duplicate
  // review/reward. The server is authoritative about review eligibility.
  const reviewedIds = reviewedProductIds === null
    ? null
    : new Set(reviewedProductIds.map(String));

  const eligibleItem = completed && reviewedIds !== null
    ? (Array.isArray(latestOrder.items) ? latestOrder.items : []).find((item: any) => {
        const id = String(item?.productId || item?.id || "").trim();
        const slug = String(item?.slug || id).trim();
        return id && !reviewedIds.has(id) && /^[a-z0-9][a-z0-9_-]*$/i.test(slug);
      })
    : null;

  if (eligibleItem) {
    const slug = String(eligibleItem.slug || eligibleItem.productId || eligibleItem.id).trim();
    message.textContent = translatePhrase("Enjoying your Skanare products? Leave a review and get 20% off your next order. Your personal discount code will be sent to your email after you submit your review.");
    action.href = `/product/${encodeURIComponent(slug)}#productReviews`;
    action.textContent = translatePhrase("Leave a review →");
  } else {
    message.textContent = translatePhrase("Have a question about your order or need any help? Send us a message through our contact form and we'll be happy to help.");
    action.href = localizedPath("/contact", locale);
    action.textContent = translatePhrase("Contact us →");
  }

  panel.hidden = false;
}

let customerDashboardRevision = 0;

async function loadUserAccountDashboard(expectedUid: string, revision: number): Promise<void> {
  const dashboard = document.getElementById("userDashboardHero");
  const defaultHero = document.getElementById("defaultHero");
  const qrGrid = document.getElementById("userQrGrid") as HTMLElement | null;
  const qrSection = document.getElementById("userQrSection");
  const ordersContainer = document.getElementById("userOrdersList");
  const thankYouPanel = document.getElementById("customerThankYou");
  if (thankYouPanel) thankYouPanel.hidden = true;

  const isCurrentUser = () =>
    customerDashboardRevision === revision &&
    firebaseAuth.currentUser?.uid === expectedUid;

  // Keep the authenticated view visible while its data loads. A failed API
  // response does not imply logout or that the customer has no orders.
  dashboard?.classList.remove("hidden");
  defaultHero?.classList.add("hidden");
  if (ordersContainer) ordersContainer.textContent = "Loading your orders...";

  try {
    const [ordersResult, qrResult, returnsResult, reviewsResult] = await Promise.allSettled([
      getOrders(),
      getMyQrCodes(),
      getCustomerReturns(),
      getMyReviewedProductIds(),
    ]);
    if (!isCurrentUser()) return;

    const ordersFailed = ordersResult.status === "rejected";
    const qrFailed = qrResult.status === "rejected";
    if (ordersFailed) console.error("Failed to load customer orders:", ordersResult.reason);
    if (qrFailed) console.error("Failed to load customer QR codes:", qrResult.reason);
    if (returnsResult.status === "rejected") {
      console.error("Failed to load customer returns:", returnsResult.reason);
    }
    const returns = returnsResult.status === "fulfilled" ? returnsResult.value : [];
    if (reviewsResult.status === "rejected") {
      console.warn("Could not load customer review status:", reviewsResult.reason);
    }
    const reviewedIds = reviewsResult.status === "fulfilled" ? reviewsResult.value : null;

    const rawOrders: any = ordersResult.status === "fulfilled"
      ? ordersResult.value : [];
    const orders: any[] = Array.isArray(rawOrders)
      ? rawOrders
      : Array.isArray(rawOrders?.orders) ? rawOrders.orders : [];
    const qrCodes: QrCode[] = qrResult.status === "fulfilled" &&
      Array.isArray(qrResult.value) ? qrResult.value : [];

    if (ordersFailed && ordersContainer) {
      ordersContainer.textContent = "Unable to load orders right now. Please refresh to retry.";
    } else {
      renderCustomerOrders(orders, returns);
      renderCustomerThankYou(orders, reviewedIds);
    }

    if (qrGrid && qrCodes.length) {
      qrSection?.classList.remove("hidden");
      await renderQrDashboard(qrGrid, qrCodes.slice(0, 2));
    } else {
      qrSection?.classList.add("hidden");
      if (qrGrid) qrGrid.innerHTML = "";
    }

    // Preserve existing empty-account homepage for genuinely empty results,
    // but do not mistake an API outage for an empty customer account.
    if (isCurrentUser() && !ordersFailed && !qrFailed &&
        orders.length === 0 && qrCodes.length === 0) {
      dashboard?.classList.add("hidden");
      defaultHero?.classList.remove("hidden");
    }
  } catch (error) {
    if (!isCurrentUser()) return;
    console.error("Failed to load customer dashboard:", error);
    if (ordersContainer) {
      ordersContainer.textContent = "Unable to load your account right now. Please refresh to retry.";
    }
    dashboard?.classList.remove("hidden");
    defaultHero?.classList.add("hidden");
  }
}

function resetLoggedOutHomepageState(): void {
  const dashboardHero = document.getElementById("userDashboardHero");
  const defaultHero = document.getElementById("defaultHero");
  const grid = document.getElementById("userQrGrid");
  const thankYouPanel = document.getElementById("customerThankYou");
  if (thankYouPanel) thankYouPanel.hidden = true;

  dashboardHero?.classList.add("hidden");
  defaultHero?.classList.remove("hidden");

  if (grid) {
    grid.innerHTML = "";
  }

  const orders =
  document.getElementById(
    "userOrdersList"
  );

if (orders) {
  orders.innerHTML = "";
}
}

/* =========================
   HOMEPAGE PRODUCTS
========================= */

let homepageProductsPromise:
  Promise<
    Awaited<
      ReturnType<
        typeof getProducts
      >
    >
  > | null = null;

function getHomepageProductsOnce() {
  if (
    !homepageProductsPromise
  ) {
    homepageProductsPromise =
      getProducts({
        featured: true,
        active: true,
      });
  }

  return homepageProductsPromise;
}

async function loadHomepageProducts(
  gridId: string,
  loadingId: string,
  emptyId: string,
  errorId: string,
  category: "tshirt" | "accessory"
): Promise<void> {
  const grid = document.getElementById(gridId) as HTMLElement | null;
  const loadingEl = document.getElementById(loadingId);
  const emptyEl = document.getElementById(emptyId);
  const errorEl = document.getElementById(errorId);

  if (!grid) return;

  try {
    loadingEl?.removeAttribute("hidden");
    emptyEl?.setAttribute("hidden", "");
    errorEl?.setAttribute("hidden", "");

    const products =
      await getHomepageProductsOnce();

    const safeProducts =
      (
        Array.isArray(products)
          ? products
          : []
      )
        .filter(
          product =>
            product.category
              ?.toLowerCase() ===
            category
        )
        .slice(0, 4);

    /*
     * The clothing row is the first product row users see.
     * Discover its cover images immediately instead of waiting
     * for browser lazy-load heuristics. Other images stay lazy.
     */
    renderProducts(
      grid,
      safeProducts,
      {
        eagerFirstImages:
          category === "tshirt"
            ? 4
            : (
                window.location.hash ===
                  "#accessories"
                  ? 4
                  : 0
              ),
      }
    );

    loadingEl?.setAttribute("hidden", "");

    if (safeProducts.length === 0) {
      emptyEl?.removeAttribute("hidden");
    }
  } catch (error) {
    console.error(`Failed to load ${category} homepage products:`, error);

    loadingEl?.setAttribute("hidden", "");
    errorEl?.removeAttribute("hidden");
  }
}

/* =========================
   BOOTSTRAP
========================= */

document.addEventListener("DOMContentLoaded", () => {
  void loadHomepageProducts(
    "featuredTshirtsGrid",
    "featuredTshirtsLoading",
    "featuredTshirtsEmpty",
    "featuredTshirtsError",
    "tshirt"
  );

  void loadHomepageProducts(
    "featuredAccessoriesGrid",
    "featuredAccessoriesLoading",
    "featuredAccessoriesEmpty",
    "featuredAccessoriesError",
    "accessory"
  );

 firebaseAuth.onAuthStateChanged((user) => {
  const revision = ++customerDashboardRevision;
  if (user) {
    void loadUserAccountDashboard(user.uid, revision);
    return;
  }
  resetLoggedOutHomepageState();
});
});

// Refresh reviewed-product status when Back restores the homepage from BFCache.
window.addEventListener("pageshow", event => {
  if (!event.persisted || !firebaseAuth.currentUser) return;
  const revision = ++customerDashboardRevision;
  void loadUserAccountDashboard(firebaseAuth.currentUser.uid, revision);
});
