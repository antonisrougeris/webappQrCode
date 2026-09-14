import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { firebaseAuth } from "../../services/firebase";

/* =========================================================
   DOM
   ========================================================= */

const loginSection = document.getElementById("adminLogin");
const app = document.getElementById("adminApp");
const loginForm = document.getElementById("adminLoginForm") as HTMLFormElement | null;
const loginStatus = document.getElementById("adminLoginStatus");
const logoutButton = document.getElementById("adminLogout");
const userEmail = document.getElementById("adminUserEmail");
const refreshButton = document.getElementById("adminRefresh");

const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm") as HTMLFormElement | null;
const stockModal = document.getElementById("stockModal");
const stockForm = document.getElementById("stockForm") as HTMLFormElement | null;

/* =========================================================
   STATE
   ========================================================= */

let currentOrders: any[] = [];
let currentFulfillmentOrders: any[] = [];
let currentProducts: any[] = [];
let currentQrCodes: any[] = [];

let existingProductImages: string[] = [];
let pendingProductImageFiles: File[] = [];

/* =========================================================
   API
   ========================================================= */

async function adminApi(
  path: string,
  options: RequestInit = {}
) {
  const user = firebaseAuth.currentUser;

  if (!user) {
    throw new Error("Administrator not signed in");
  }

  const token = await user.getIdToken();
  const headers = new Headers(options.headers || {});

  headers.set("Authorization", `Bearer ${token}`);

  const isFormData = options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api/admin${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload: any = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        response.ok
          ? "Admin API returned an invalid response"
          : `Admin request failed (${response.status})`
      );
    }
  }

  if (response.status === 403) {
    throw new Error("This account does not have administrator access.");
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
      payload?.error ||
      `Admin request failed (${response.status})`
    );
  }

  return payload;
}

/* =========================================================
   LOGIN / AUTH
   ========================================================= */

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (loginStatus) {
    loginStatus.textContent = "Signing in...";
  }

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  } catch (error) {
    console.error(error);

    if (loginStatus) {
      loginStatus.textContent = "Invalid credentials or access denied.";
    }
  }
});

onAuthStateChanged(firebaseAuth, async (user) => {
  if (!user) {
    loginSection?.classList.remove("hidden");
    app?.classList.add("hidden");
    return;
  }

  try {
    await adminApi("/me");

    if (userEmail) {
      userEmail.textContent = user.email || "Admin";
    }

    loginSection?.classList.add("hidden");
    app?.classList.remove("hidden");

    await loadDashboard();
  } catch (error: any) {
    console.error(error);
    await signOut(firebaseAuth);

    if (loginStatus) {
      loginStatus.textContent = error?.message || "Administrator access denied.";
    }
  }
});

logoutButton?.addEventListener("click", async () => {
  await signOut(firebaseAuth);
});

/* =========================================================
   NAVIGATION
   ========================================================= */

const navButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".admin-nav__item")
);

function openView(view: string) {
  document.querySelectorAll(".admin-view").forEach((element) => {
    element.classList.add("hidden");
  });

  document.getElementById(`view-${view}`)?.classList.remove("hidden");

  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });

  const titles: Record<string, string> = {
    dashboard: "Dashboard",
    fulfillment: "Fulfillment",
    orders: "Orders",
    products: "Products",
    customers: "Customers",
    qr: "QR Codes",
    payments: "Payments",
  };

  setText("adminPageTitle", titles[view] || view);
  void loadView(view);
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view) openView(view);
  });
});

document.querySelectorAll<HTMLElement>("[data-open-view]").forEach((element) => {
  element.addEventListener("click", () => {
    const view = element.dataset.openView;
    if (view) openView(view);
  });
});

async function loadView(view: string) {
  switch (view) {
    case "dashboard":
      await loadDashboard();
      break;
    case "fulfillment":
      await loadFulfillment();
      break;
    case "orders":
      await loadOrders();
      break;
    case "products":
      await loadProducts();
      break;
    case "customers":
      await loadCustomers();
      break;
    case "qr":
      await loadQr();
      break;
    case "payments":
      await loadPayments();
      break;
  }
}

/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {
  const data = await adminApi("/dashboard");

  setText("statRevenue", formatMoney(data.revenue || 0));
  setText("statOrders", String(data.orders || 0));
  setText("statCustomers", String(data.customers || 0));
  setText("statQr", String(data.qrCodes || 0));

  renderOrders(data.recentOrders || [], "recentOrdersBody");
}

/* =========================================================
   ORDERS
   ========================================================= */

async function loadOrders() {
  const data = await adminApi("/orders");
  currentOrders = data.orders || [];
  applyOrderFilters();
}

function applyOrderFilters() {
  const search = (
    document.getElementById("orderSearch") as HTMLInputElement | null
  )?.value.trim().toLowerCase() || "";

  const status = (
    document.getElementById("orderStatusFilter") as HTMLSelectElement | null
  )?.value || "all";

  const filtered = currentOrders.filter((order) => {
    const paymentStatus = String(
      order.paymentStatus || order.status || "pending"
    ).toLowerCase();

    const haystack = [
      order.id,
      order.orderNumber,
      order.customer?.firstName,
      order.customer?.lastName,
      order.customer?.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = status === "all" || paymentStatus === status;

    return matchesSearch && matchesStatus;
  });

  renderOrders(filtered, "ordersBody");
}

document.getElementById("orderSearch")?.addEventListener("input", applyOrderFilters);
document.getElementById("orderStatusFilter")?.addEventListener("change", applyOrderFilters);

function renderOrders(orders: any[], targetId: string) {
  const body = document.getElementById(targetId);
  if (!body) return;

  if (!orders.length) {
    body.innerHTML = `<tr><td colspan="8">No orders found.</td></tr>`;
    return;
  }

  body.innerHTML = orders
    .map((order) => {
      const paymentStatus = order.paymentStatus || order.status || "pending";
      const isFullOrdersTable = targetId === "ordersBody";

      return `
        <tr>
          <td><span class="admin-order-id">${escapeHtml(order.orderNumber || order.id || "")}</span></td>
          <td class="admin-table__customer">
            <strong>${escapeHtml(customerName(order.customer))}</strong>
            <span>${escapeHtml(order.customer?.email || "")}</span>
          </td>
          ${isFullOrdersTable ? `<td>${Number(order.items?.length || 0)}</td>` : ""}
          <td><span class="admin-badge admin-badge--${escapeHtml(paymentStatus)}">${escapeHtml(paymentStatus)}</span></td>
          ${isFullOrdersTable ? `<td>${escapeHtml(order.delivery || "—")}</td>` : ""}
          <td>${formatMoney(Number(order.total || 0))}</td>
          <td>${formatDate(order.createdAt)}</td>
          <td><button class="admin-text-button" data-order-id="${escapeHtml(order.id)}">View</button></td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll<HTMLButtonElement>("[data-order-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.orderId;
      if (id) void openOrder(id);
    });
  });
}

/* =========================================================
   FULFILLMENT
   ========================================================= */

async function loadFulfillment() {
  const data = await adminApi("/fulfillment");
  currentFulfillmentOrders = data.orders || [];

  const summary = data.summary || {};

  setText("fulfillmentToPrepare", String(summary.toPrepare ?? countFulfillment("to_prepare")));
  setText("fulfillmentPreparing", String(summary.preparing ?? countFulfillment("preparing")));
  setText("fulfillmentReady", String(summary.ready ?? countFulfillment("ready")));
  setText("fulfillmentShipped", String(summary.shipped ?? countFulfillment("shipped")));

  const actionCount =
    Number(summary.toPrepare ?? countFulfillment("to_prepare")) +
    Number(summary.preparing ?? countFulfillment("preparing")) +
    Number(summary.ready ?? countFulfillment("ready"));

  const badge = document.getElementById("fulfillmentBadge");
  if (badge) {
    badge.textContent = String(actionCount);
    badge.hidden = actionCount === 0;
  }

  renderFulfillment();
}

function countFulfillment(status: string) {
  return currentFulfillmentOrders.filter(
    (order) => String(order.fulfillmentStatus || "to_prepare") === status
  ).length;
}

function renderFulfillment() {
  const container = document.getElementById("fulfillmentList");
  if (!container) return;

  if (!currentFulfillmentOrders.length) {
    container.innerHTML = `<div class="admin-list-item"><strong>No paid orders waiting for fulfillment.</strong></div>`;
    return;
  }

  container.innerHTML = currentFulfillmentOrders
    .map((order) => {
      const status = String(order.fulfillmentStatus || "to_prepare");
      const items = Array.isArray(order.items) ? order.items : [];

      return `
        <article class="fulfillment-card">
          <div class="fulfillment-card__top">
            <div>
              <span class="admin-eyebrow">Order</span>
              <div class="fulfillment-card__id">${escapeHtml(order.orderNumber || order.id)}</div>
              <div class="fulfillment-card__meta">
                <span>${escapeHtml(customerName(order.customer))}</span>
                <span>${escapeHtml(order.customer?.email || "")}</span>
                <span>${formatDate(order.paidAt || order.createdAt)}</span>
              </div>
            </div>
            <span class="workflow-pill workflow-pill--${escapeHtml(status)}">${escapeHtml(formatStatus(status))}</span>
          </div>

          <div class="fulfillment-card__items">
            ${items.slice(0, 4).map((item: any) => fulfillmentItemHtml(item)).join("")}
            ${items.length > 4 ? `<div class="admin-muted">+ ${items.length - 4} more item(s)</div>` : ""}
          </div>

          <div class="fulfillment-card__footer">
            <div><strong>${formatMoney(Number(order.total || 0))}</strong><div class="admin-muted">${escapeHtml(order.delivery || "Delivery")}</div></div>
            <div class="admin-actions">
              ${status === "to_prepare" ? `<button class="admin-secondary-button" data-quick-status="preparing" data-order-id="${escapeHtml(order.id)}">Start preparing</button>` : ""}
              ${status === "preparing" ? `<button class="admin-secondary-button" data-quick-status="ready" data-order-id="${escapeHtml(order.id)}">Mark ready</button>` : ""}
              <button class="admin-primary-button" data-process-order="${escapeHtml(order.id)}">Process order</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function fulfillmentItemHtml(item: any) {
  const variant = item.variant || {};
  const sku = item.sku || variant.sku || "";
  const size = variant.size || item.size || "";
  const color = variant.color || item.color || "";

  return `
    <div class="fulfillment-card__item">
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" />` : ""}
      <div>
        <strong>${escapeHtml(item.title || item.name || "Product")}</strong>
        <span>${[
          sku ? `SKU ${sku}` : "",
          size ? `Size ${size}` : "",
          color ? color : "",
          `Qty ${Number(item.quantity || 1)}`,
        ].filter(Boolean).map(escapeHtml).join(" · ")}</span>
      </div>
    </div>
  `;
}

document.getElementById("refreshFulfillment")?.addEventListener("click", () => {
  void loadFulfillment();
});

document.getElementById("fulfillmentList")?.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;

  const processButton = target.closest<HTMLElement>("[data-process-order]");
  if (processButton?.dataset.processOrder) {
    await openOrder(processButton.dataset.processOrder);
    return;
  }

  const statusButton = target.closest<HTMLButtonElement>("[data-quick-status]");
  if (statusButton) {
    const orderId = statusButton.dataset.orderId;
    const status = statusButton.dataset.quickStatus;
    if (!orderId || !status) return;

    statusButton.disabled = true;
    try {
      await setFulfillmentStatus(orderId, status);
      await loadFulfillment();
      await loadDashboard();
    } catch (error) {
      alert(errorMessage(error));
    } finally {
      statusButton.disabled = false;
    }
  }
});

async function setFulfillmentStatus(orderId: string, status: string) {
  return adminApi(`/orders/${encodeURIComponent(orderId)}/fulfillment`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/* =========================================================
   ORDER / FULFILLMENT DRAWER
   ========================================================= */

async function ensureQrCodes(force = false) {
  if (!force && currentQrCodes.length) return currentQrCodes;
  const data = await adminApi("/qr-codes");
  currentQrCodes = data.qrCodes || [];
  return currentQrCodes;
}

async function openOrder(orderId: string) {
  const [data, qrCodes] = await Promise.all([
    adminApi(`/orders/${encodeURIComponent(orderId)}`),
    ensureQrCodes(true).catch(() => []),
  ]);

  const order = data.order;
  const assignedQrs = (qrCodes || []).filter((qr: any) => qr.orderId === order.id);
  const status = String(order.fulfillmentStatus || (order.paymentStatus === "paid" ? "to_prepare" : "not_paid"));
  const checklist = order.warehouse?.checklist || {};
  const receipt = order.receipt || {};
  const shipping = order.shipping || {};

  const receiptReady = Boolean(receipt.uploaded && receipt.storagePath);
  const packedReady = Boolean(checklist.packed);
  const shippingReference =
    String(shipping.trackingNumber || shipping.parcelId || "").trim();
  const shippingReady =
    Boolean(shippingReference) &&
    shippingReference !== "0" &&
    shippingReference !== "—";
  const customerAlreadyNotified = Boolean(order.emails?.shippedOrderSentAt);

  const canShipAndEmail =
    order.paymentStatus === "paid" &&
    receiptReady &&
    packedReady &&
    shippingReady &&
    !customerAlreadyNotified;

  setText("drawerOrderId", order.orderNumber || order.id);

  const content = document.getElementById("adminOrderDrawerContent");
  if (!content) return;

  content.innerHTML = `
    <div class="admin-detail-group">
      <div class="admin-actions" style="justify-content:space-between">
        <div><h3 style="margin:0 0 6px">Workflow</h3><span class="workflow-pill workflow-pill--${escapeHtml(status)}">${escapeHtml(formatStatus(status))}</span></div>
        <strong>${formatMoney(Number(order.total || 0))}</strong>
      </div>
      <div class="drawer-status-actions">
        ${order.paymentStatus === "paid" ? `
          <button class="admin-secondary-button" data-drawer-status="to_prepare">To prepare</button>
          <button class="admin-secondary-button" data-drawer-status="preparing">Preparing</button>
          <button class="admin-secondary-button" data-drawer-status="ready">Ready</button>
          <button class="admin-secondary-button" data-drawer-status="completed">Completed</button>
        ` : `<span class="admin-muted">Fulfillment becomes available after payment.</span>`}
      </div>
    </div>

    <div class="admin-detail-group">
      <h3>Customer</h3>
      <p><strong>${escapeHtml(customerName(order.customer))}</strong></p>
      <p>${escapeHtml(order.customer?.email || "")}</p>
      <p>${escapeHtml(order.customer?.phone || "")}</p>
    </div>

    <div class="admin-detail-group">
      <h3>Payment</h3>
      <p>Status: <strong>${escapeHtml(order.paymentStatus || order.status || "")}</strong></p>
      <p>Viva order: ${escapeHtml(order.payment?.vivaOrderCode || "—")}</p>
      <p>Transaction: ${escapeHtml(order.payment?.transactionId || order.payment?.vivaTransactionId || "—")}</p>
    </div>

    <div class="admin-detail-group">
      <h3>Delivery</h3>
      <p><strong>${escapeHtml(order.delivery || "—")}</strong></p>
      <pre>${escapeHtml(JSON.stringify(order.locker || order.shippingAddress || {}, null, 2))}</pre>
    </div>

    <div class="admin-detail-group">
      <h3>Items to prepare</h3>
      <div class="drawer-process-summary">
        ${(order.items || []).map((item: any) => drawerItemHtml(item)).join("") || `<span class="admin-muted">No items.</span>`}
      </div>
    </div>

    <div class="admin-detail-group">
      <h3>Assigned QR codes</h3>
      ${assignedQrs.length ? assignedQrs.map((qr: any) => `
        <div class="drawer-qr">
          <strong>${escapeHtml(qr.shortId || qr.id)}</strong><br />
          ${escapeHtml(qr.productTitle || qr.productId || "")}
          ${qr.targetUrl ? `<br /><span>${escapeHtml(qr.targetUrl)}</span>` : ""}
        </div>
      `).join("") : `<p class="admin-muted">No assigned QR returned by the admin QR endpoint yet. The payment service can still assign / generate QR stock during successful payment.</p>`}
    </div>

    <div class="admin-detail-group">
      <h3>Warehouse checklist</h3>
      <div class="warehouse-checklist">
        ${checklistInput("checkProductPicked", "Product picked", checklist.productPicked)}
        ${checklistInput("checkSizeVerified", "Size / variant verified", checklist.sizeVerified)}
        ${checklistInput("checkQrAttached", "Correct QR attached", checklist.qrAttached)}
        ${checklistInput("checkQrTested", "QR tested", checklist.qrTested)}
        ${checklistInput("checkPacked", "Packed", checklist.packed)}
      </div>
      <div class="admin-actions" style="margin-top:12px"><button id="saveChecklistButton" class="admin-secondary-button" type="button">Save checklist</button></div>
      <p id="checklistStatus" class="admin-inline-status"></p>
    </div>

    <div class="admin-detail-group">
      <h3>Receipt / timologio</h3>
      <div class="admin-form-grid">
        <label class="admin-field"><span>Receipt number</span><input id="receiptNumber" type="text" value="${escapeHtml(receipt.number || "")}" /></label>
        <label class="admin-field"><span>myDATA MARK</span><input id="receiptMark" type="text" value="${escapeHtml(receipt.mark || "")}" /></label>
      </div>
      <label class="admin-field"><span>Receipt PDF</span><input id="receiptPdf" type="file" accept="application/pdf,.pdf" /></label>
      <div class="receipt-file-name">${receipt.uploaded ? `Uploaded: ${escapeHtml(receipt.fileName || "receipt.pdf")}` : "No receipt PDF uploaded yet."}</div>
      <div class="admin-actions" style="margin-top:12px">
        <button id="saveReceiptButton" class="admin-secondary-button" type="button">Save receipt details</button>
        <button id="uploadReceiptButton" class="admin-primary-button" type="button">Upload PDF & save</button>
      </div>
      <p id="receiptStatus" class="admin-inline-status"></p>
    </div>

    <div class="admin-detail-group">
      <h3>BOX NOW / shipping</h3>
      <div class="admin-form-grid">
        <label class="admin-field"><span>Carrier</span><input id="shippingCarrier" type="text" value="${escapeHtml(shipping.carrier || "BOX NOW")}" /></label>
        <label class="admin-field"><span>Parcel ID</span><input id="shippingParcelId" type="text" value="${escapeHtml(shipping.parcelId || "")}" /></label>
        <label class="admin-field"><span>Tracking number</span><input id="shippingTrackingNumber" type="text" value="${escapeHtml(shipping.trackingNumber || "")}" /></label>
        <label class="admin-field"><span>Locker ID</span><input id="shippingLockerId" type="text" value="${escapeHtml(shipping.lockerId || order.locker?.id || "")}" /></label>
      </div>
      <label class="admin-field"><span>Tracking URL</span><input id="shippingTrackingUrl" type="url" value="${escapeHtml(shipping.trackingUrl || "")}" /></label>
      <label class="admin-field"><span>Locker name</span><input id="shippingLockerName" type="text" value="${escapeHtml(shipping.lockerName || order.locker?.name || "")}" /></label>
      <div class="admin-actions"><button id="saveShippingButton" class="admin-secondary-button" type="button">Save shipping</button></div>
      <p id="shippingStatus" class="admin-inline-status"></p>
    </div>

    <div class="admin-detail-group">
      <h3>Dispatch</h3>
      <p class="admin-muted">
        This is the only action that should set the order to Shipped. It sends the customer email and attaches the stored receipt PDF.
      </p>

      <div class="warehouse-checklist" style="margin:12px 0">
        <label><input type="checkbox" disabled ${packedReady ? "checked" : ""} /> <span>Order packed</span></label>
        <label><input type="checkbox" disabled ${receiptReady ? "checked" : ""} /> <span>Receipt PDF uploaded</span></label>
        <label><input type="checkbox" disabled ${shippingReady ? "checked" : ""} /> <span>BOX NOW parcel / tracking saved</span></label>
      </div>

      ${
        customerAlreadyNotified
          ? `<p class="admin-inline-status is-success">Customer shipping email already sent ${order.emails?.shippedOrderSentAt ? `on ${escapeHtml(formatDate(order.emails.shippedOrderSentAt))}` : ""}.</p>`
          : ""
      }

      <button
        id="shipAndEmailButton"
        class="admin-primary-button"
        type="button"
        ${canShipAndEmail ? "" : "disabled"}
      >
        ${customerAlreadyNotified ? "Customer already notified" : "Mark shipped & send customer email"}
      </button>

      ${
        !customerAlreadyNotified && !canShipAndEmail
          ? `<p class="admin-muted" style="margin-top:8px">Complete the three requirements above before dispatch.</p>`
          : ""
      }

      <p id="shipStatus" class="admin-inline-status"></p>
    </div>
  `;

  bindOrderDrawerActions(order);

  document.getElementById("adminDrawerOverlay")?.classList.remove("hidden");
  document.getElementById("adminOrderDrawer")?.classList.remove("hidden");
}

function drawerItemHtml(item: any) {
  const variant = item.variant || {};
  const sku = item.sku || variant.sku || "";
  const size = variant.size || item.size || "";
  const color = variant.color || item.color || "";

  return `
    <div class="drawer-item">
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" />` : `<div></div>`}
      <div>
        <strong>${escapeHtml(item.title || item.name || "Product")}</strong>
        <div class="drawer-item__meta">${[
          sku ? `SKU: ${sku}` : "",
          size ? `Size: ${size}` : "",
          color ? `Color: ${color}` : "",
          `Quantity: ${Number(item.quantity || 1)}`,
        ].filter(Boolean).map(escapeHtml).join(" · ")}</div>
        ${item.qrDestination ? `<div class="drawer-item__meta">Destination: ${escapeHtml(item.qrDestination)}</div>` : ""}
      </div>
    </div>
  `;
}

function checklistInput(id: string, label: string, checked: boolean) {
  return `<label><input id="${id}" type="checkbox" ${checked ? "checked" : ""} /> <span>${escapeHtml(label)}</span></label>`;
}

function bindOrderDrawerActions(order: any) {
  document.querySelectorAll<HTMLButtonElement>("[data-drawer-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = button.dataset.drawerStatus;
      if (!status) return;

      button.disabled = true;
      try {
        await setFulfillmentStatus(order.id, status);
        await Promise.all([loadFulfillment(), loadDashboard()]);
        await openOrder(order.id);
      } catch (error) {
        alert(errorMessage(error));
      } finally {
        button.disabled = false;
      }
    });
  });

  document.getElementById("saveChecklistButton")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("checklistStatus");
    setInlineStatus(statusEl, "Saving...");

    try {
      await adminApi(`/orders/${encodeURIComponent(order.id)}/checklist`, {
        method: "PATCH",
        body: JSON.stringify({
          productPicked: checked("checkProductPicked"),
          sizeVerified: checked("checkSizeVerified"),
          qrAttached: checked("checkQrAttached"),
          qrTested: checked("checkQrTested"),
          packed: checked("checkPacked"),
        }),
      });
      setInlineStatus(statusEl, "Checklist saved.", "success");
      await openOrder(order.id);
    } catch (error) {
      setInlineStatus(statusEl, errorMessage(error), "error");
    }
  });

  document.getElementById("saveReceiptButton")?.addEventListener("click", async () => {
    await saveReceiptMetadata(order.id);
  });

  document.getElementById("uploadReceiptButton")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("receiptStatus");
    const fileInput = document.getElementById("receiptPdf") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];

    if (!file) {
      setInlineStatus(statusEl, "Choose a PDF first.", "error");
      return;
    }

    if (file.type && file.type !== "application/pdf") {
      setInlineStatus(statusEl, "Receipt must be a PDF.", "error");
      return;
    }

    setInlineStatus(statusEl, "Uploading receipt PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("number", inputValue("receiptNumber"));
      formData.append("mark", inputValue("receiptMark"));

      await adminApi(`/orders/${encodeURIComponent(order.id)}/receipt-file`, {
        method: "POST",
        body: formData,
      });

      setInlineStatus(statusEl, "Receipt PDF uploaded.", "success");
      await openOrder(order.id);
    } catch (error) {
      setInlineStatus(statusEl, errorMessage(error), "error");
    }
  });

  document.getElementById("saveShippingButton")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("shippingStatus");
    setInlineStatus(statusEl, "Saving shipping details...");

    try {
      await adminApi(`/orders/${encodeURIComponent(order.id)}/shipping`, {
        method: "PATCH",
        body: JSON.stringify({
          carrier: inputValue("shippingCarrier"),
          parcelId: inputValue("shippingParcelId"),
          trackingNumber: inputValue("shippingTrackingNumber"),
          trackingUrl: inputValue("shippingTrackingUrl"),
          lockerId: inputValue("shippingLockerId"),
          lockerName: inputValue("shippingLockerName"),
        }),
      });

      setInlineStatus(statusEl, "Shipping details saved.", "success");
      await openOrder(order.id);
    } catch (error) {
      setInlineStatus(statusEl, errorMessage(error), "error");
    }
  });

  document.getElementById("shipAndEmailButton")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("shipStatus");

    if (!window.confirm("Send the shipping email now? The saved receipt PDF will be attached and the order will be marked as shipped.")) {
      return;
    }

    setInlineStatus(statusEl, "Shipping order and sending email...");

    try {
      await adminApi(`/orders/${encodeURIComponent(order.id)}/ship`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setInlineStatus(statusEl, "Order shipped and customer notified.", "success");
      await Promise.all([loadFulfillment(), loadDashboard(), loadOrders()]);
      await openOrder(order.id);
    } catch (error) {
      setInlineStatus(statusEl, errorMessage(error), "error");
    }
  });
}

async function saveReceiptMetadata(orderId: string) {
  const statusEl = document.getElementById("receiptStatus");
  setInlineStatus(statusEl, "Saving receipt details...");

  try {
    await adminApi(`/orders/${encodeURIComponent(orderId)}/receipt`, {
      method: "PATCH",
      body: JSON.stringify({
        number: inputValue("receiptNumber"),
        mark: inputValue("receiptMark"),
      }),
    });

    setInlineStatus(statusEl, "Receipt details saved.", "success");
  } catch (error) {
    setInlineStatus(statusEl, errorMessage(error), "error");
  }
}

function closeDrawer() {
  document.getElementById("adminDrawerOverlay")?.classList.add("hidden");
  document.getElementById("adminOrderDrawer")?.classList.add("hidden");
}

document.getElementById("closeAdminDrawer")?.addEventListener("click", closeDrawer);
document.getElementById("adminDrawerOverlay")?.addEventListener("click", closeDrawer);

/* =========================================================
   PRODUCTS
   ========================================================= */

async function loadProducts() {
  const data = await adminApi("/products");
  currentProducts = data.products || [];
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("adminProductsGrid");
  if (!grid) return;

  if (!currentProducts.length) {
    grid.innerHTML = `<div class="admin-list-item"><strong>No products yet.</strong></div>`;
    return;
  }

  grid.innerHTML = currentProducts
    .map((product: any) => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const fallbackStock = Number(product.stock || 0);
      const active = product.active !== false;

      return `
        <article class="admin-product ${active ? "" : "is-inactive"}">
          ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title || "")}">` : ""}
          <div class="admin-product__body">
            <h3>
              ${escapeHtml(product.title || "")}
              <span class="admin-product__status ${active ? "" : "admin-product__status--inactive"}">
                ${active ? "Active" : "Archived"}
              </span>
            </h3>

            <p>${formatMoney(Number(product.price || 0))}</p>
            <div class="admin-muted">${escapeHtml(product.id || "")} · ${escapeHtml(product.category || "General")}</div>

            <div class="admin-product__stock-box">
              <div class="admin-product__stock-row">
                <span>Fallback stock</span>
                <div class="admin-actions">
                  <button type="button" class="admin-icon-button" data-stock-operation="remove" data-product-id="${escapeHtml(product.id)}" ${active ? "" : "disabled"}>−</button>
                  <strong>${fallbackStock}</strong>
                  <button type="button" class="admin-icon-button" data-stock-operation="add" data-product-id="${escapeHtml(product.id)}" ${active ? "" : "disabled"}>+</button>
                </div>
              </div>

              ${variants.length ? `
                <div class="admin-product__variant-list">
                  ${variants.map((variant: any) => `
                    <div class="admin-product__variant">
                      <span>${escapeHtml([variant.size || "No size", variant.color || "No color"].join(" · "))}</span>
                      <span>fallback ${Number(variant.stock || 0)}</span>
                    </div>
                  `).join("")}
                </div>
              ` : ""}
            </div>

            <div class="admin-product__actions">
              <button class="admin-primary-button" type="button" data-add-qr-stock="${escapeHtml(product.id)}" ${active ? "" : "disabled"}>Add QR stock</button>
              <button class="admin-secondary-button" type="button" data-edit-product="${escapeHtml(product.id)}">Edit</button>
              ${
                active
                  ? `<button class="admin-danger-button" type="button" data-archive-product="${escapeHtml(product.id)}">Archive</button>`
                  : `<button class="admin-secondary-button" type="button" disabled>Archived</button>`
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

/* ----- fallback +/- stock ----- */

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>("[data-stock-operation]");
  if (!button) return;

  const productId = button.dataset.productId;
  const operation = button.dataset.stockOperation;
  if (!productId || !operation) return;

  button.disabled = true;

  try {
    await adminApi(`/products/${encodeURIComponent(productId)}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ operation, quantity: 1 }),
    });
    await loadProducts();
  } catch (error) {
    alert(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

/* =========================================================
   PRODUCT ADD / EDIT
   ========================================================= */

document.getElementById("addProductButton")?.addEventListener("click", () => {
  openProductModal();
});

document.querySelectorAll<HTMLElement>("[data-close-product-modal]").forEach((element) => {
  element.addEventListener("click", closeProductModal);
});

document.getElementById("addVariantRowButton")?.addEventListener("click", () => {
  addVariantRow();
});

document.getElementById("addReviewRowButton")?.addEventListener("click", () => {
  addReviewRow();
});

document.getElementById("variantRows")?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  target.closest<HTMLElement>("[data-remove-variant]")?.closest(".dynamic-row")?.remove();
});

document.getElementById("reviewRows")?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  target.closest<HTMLElement>("[data-remove-review]")?.closest(".dynamic-row")?.remove();
});

function openProductModal(product: any = null) {
  resetProductForm();

  const editing = Boolean(product);

  setInputValue("productEditingId", product?.id || "");
  setInputValue("productId", product?.id || "");
  setInputValue("productSlug", product?.slug || "");
  setInputValue("productTitle", product?.title || "");
  setInputValue("productShortDescription", product?.shortDescription || "");
  setInputValue("productDescription", product?.description || "");

  populateProductCategories(product?.category || "");

  setInputValue("productPrice", product?.price ?? "");
  setInputValue("productCurrency", product?.currency || "EUR");
  setInputValue("productStock", product?.stock ?? 0);
  setInputValue("productLowStockThreshold", product?.lowStockThreshold ?? 3);
  setChecked("productFeatured", Boolean(product?.featured));
  setChecked("productActive", product?.active !== false);
  setChecked("productCustomQr", product?.customQr !== false);

  setInputValue("qrTextPrint", product?.qrConfig?.textPrint || "SCAN ME");
  setInputValue("qrTextPosition", product?.qrConfig?.textPosition || "bottom");
  setInputValue("qrColor", product?.qrConfig?.qrColor || product?.qrConfig?.color || "#000000");
  setInputValue("qrTextColor", product?.qrConfig?.textColor || product?.qrConfig?.qrColor || "#000000");
  setInputValue("qrPrintSize", product?.qrConfig?.size || 3540);

  existingProductImages = Array.isArray(product?.images) ? [...product.images] : [];
  pendingProductImageFiles = [];
  renderProductImagePreview();

  const variantRows = document.getElementById("variantRows");
  if (variantRows) variantRows.innerHTML = "";

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length) {
    variants.forEach((variant: any) => addVariantRow(variant));
  } else {
    addVariantRow();
  }

  const reviewRows = document.getElementById("reviewRows");
  if (reviewRows) reviewRows.innerHTML = "";

  // IMPORTANT: new products start with zero reviews.
  // Existing reviews are shown only when they already exist on that product.
  const reviews = Array.isArray(product?.reviews) ? product.reviews : [];
  reviews.forEach((review: any) => addReviewRow(review));

  const idInput = document.getElementById("productId") as HTMLInputElement | null;
  if (idInput) idInput.disabled = editing;

  setText("productModalTitle", editing ? "Edit product" : "Add product");
  setText("saveProductButton", editing ? "Save changes" : "Create product");
  setInlineStatus(document.getElementById("productFormStatus"), "");

  productModal?.classList.remove("hidden");
  productModal?.setAttribute("aria-hidden", "false");
}

function closeProductModal() {
  productModal?.classList.add("hidden");
  productModal?.setAttribute("aria-hidden", "true");
  pendingProductImageFiles = [];
}

function resetProductForm() {
  productForm?.reset();

  setChecked("productFeatured", false);
  setChecked("productActive", true);
  setChecked("productCustomQr", true);

  setInputValue("productCurrency", "EUR");
  setInputValue("productStock", 0);
  setInputValue("productLowStockThreshold", 3);

  setInputValue("qrTextPrint", "SCAN ME");
  setInputValue("qrTextPosition", "bottom");
  setInputValue("qrColor", "#000000");
  setInputValue("qrTextColor", "#000000");
  setInputValue("qrPrintSize", 3540);

  document.getElementById("variantRows")?.replaceChildren();
  document.getElementById("reviewRows")?.replaceChildren();

  existingProductImages = [];
  pendingProductImageFiles = [];
  renderProductImagePreview();
}

function populateProductCategories(selectedCategory = "") {
  const select = document.getElementById("productCategory") as HTMLSelectElement | null;
  if (!select) return;

  const categories = Array.from(
    new Set(
      currentProducts
        .map((product) => String(product.category || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  if (selectedCategory && !categories.includes(selectedCategory)) {
    categories.push(selectedCategory);
  }

  if (!categories.length) {
    categories.push("General");
  }

  select.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(formatCategoryLabel(category))}</option>`)
    .join("");

  select.value = selectedCategory && categories.includes(selectedCategory)
    ? selectedCategory
    : categories[0];
}

function formatCategoryLabel(category: string) {
  return String(category || "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeSkuPart(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateVariantSku(productId: string, size: string, color: string) {
  const tokens = [
    ...normalizeSkuPart(productId).split("-"),
    ...normalizeSkuPart(color).split("-"),
    ...normalizeSkuPart(size).split("-"),
  ].filter(Boolean);

  const uniqueTokens: string[] = [];
  for (const token of tokens) {
    if (!uniqueTokens.includes(token)) uniqueTokens.push(token);
  }

  return uniqueTokens.join("-");
}

function updateAutoSkuForRow(row: HTMLElement) {
  if (row.dataset.autoSku !== "true") return;

  const skuInput = row.querySelector<HTMLInputElement>("[data-variant-sku]");
  const preview = row.querySelector<HTMLElement>("[data-variant-sku-preview]");
  if (!skuInput || !preview) return;

  const sku = generateVariantSku(
    inputValue("productId"),
    childInputValue(row, "[data-variant-size]"),
    childInputValue(row, "[data-variant-color]")
  );

  skuInput.value = sku;
  preview.textContent = sku || "Generated after size / color is selected";
}

function updateAllAutoSkus() {
  document
    .querySelectorAll<HTMLElement>("#variantRows .dynamic-row")
    .forEach(updateAutoSkuForRow);
}

function addVariantRow(variant: any = {}) {
  const container = document.getElementById("variantRows");
  if (!container) return;

  const hasExistingSku = Boolean(String(variant.sku || "").trim());
  const size = String(variant.size || "");

  const knownSizes = ["", "XS", "S", "M", "L", "XL", "2XL"];
  if (size && !knownSizes.includes(size)) knownSizes.push(size);

  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.dataset.autoSku = hasExistingSku ? "false" : "true";

  row.innerHTML = `
    <label class="admin-field">
      <span>Size</span>
      <select data-variant-size>
        ${knownSizes.map((value) => `
          <option value="${escapeHtml(value)}" ${value === size ? "selected" : ""}>
            ${value || "No size / one size"}
          </option>
        `).join("")}
      </select>
    </label>

    <label class="admin-field">
      <span>Color</span>
      <input data-variant-color type="text" value="${escapeHtml(variant.color || "")}" placeholder="Black" />
    </label>

    <label class="admin-field">
      <span>Fallback stock</span>
      <input data-variant-stock type="number" min="0" step="1" value="${Number(variant.stock || 0)}" />
    </label>

    <label class="admin-field">
      <span>Internal match code</span>
      <input data-variant-sku type="hidden" value="${escapeHtml(variant.sku || "")}" />
      <div class="variant-sku-preview" data-variant-sku-preview>
        ${escapeHtml(variant.sku || "Generated automatically")}
      </div>
    </label>

    <button class="admin-danger-button" data-remove-variant type="button">Remove</button>
  `;

  container.appendChild(row);

  row.querySelector("[data-variant-size]")?.addEventListener("change", () => updateAutoSkuForRow(row));
  row.querySelector("[data-variant-color]")?.addEventListener("input", () => updateAutoSkuForRow(row));

  updateAutoSkuForRow(row);
}

function isAllowedProductImage(file: File) {
  return ["image/png", "image/jpeg", "image/webp"].includes(file.type);
}

function addProductImageFiles(files: File[]) {
  const valid = files.filter(isAllowedProductImage);

  if (valid.length !== files.length) {
    setInlineStatus(
      document.getElementById("productFormStatus"),
      "Only PNG, JPG and WEBP images are allowed.",
      "error"
    );
  }

  pendingProductImageFiles.push(...valid);
  renderProductImagePreview();
}

function renderProductImagePreview() {
  const preview = document.getElementById("productImagePreview");
  if (!preview) return;

  const existingHtml = existingProductImages.map((url, index) => `
    <div class="product-image-preview__item">
      <img src="${escapeHtml(url)}" alt="Product image" />
      <button type="button" data-remove-existing-image="${index}" aria-label="Remove image">×</button>
    </div>
  `);

  const pendingHtml = pendingProductImageFiles.map((file, index) => {
    const localUrl = URL.createObjectURL(file);

    return `
      <div class="product-image-preview__item">
        <img src="${escapeHtml(localUrl)}" alt="${escapeHtml(file.name)}" />
        <button type="button" data-remove-pending-image="${index}" aria-label="Remove image">×</button>
      </div>
    `;
  });

  preview.innerHTML = [...existingHtml, ...pendingHtml].join("");
}

async function uploadPendingProductImages(): Promise<string[]> {
  if (!pendingProductImageFiles.length) return [];

  const formData = new FormData();

  pendingProductImageFiles.forEach((file) => {
    formData.append("images", file);
  });

  const response = await adminApi("/product-images", {
    method: "POST",
    body: formData,
  });

  return Array.isArray(response?.urls) ? response.urls : [];
}

const productImageDropzone = document.getElementById("productImageDropzone");
const productImageFiles = document.getElementById("productImageFiles") as HTMLInputElement | null;

productImageDropzone?.addEventListener("click", () => {
  productImageFiles?.click();
});

productImageDropzone?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    productImageFiles?.click();
  }
});

productImageDropzone?.addEventListener("dragover", (event) => {
  event.preventDefault();
  productImageDropzone.classList.add("is-dragging");
});

productImageDropzone?.addEventListener("dragleave", () => {
  productImageDropzone.classList.remove("is-dragging");
});

productImageDropzone?.addEventListener("drop", (event) => {
  event.preventDefault();
  productImageDropzone.classList.remove("is-dragging");

  addProductImageFiles(Array.from(event.dataTransfer?.files || []));
});

productImageFiles?.addEventListener("change", () => {
  addProductImageFiles(Array.from(productImageFiles.files || []));
  productImageFiles.value = "";
});

document.getElementById("productImagePreview")?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const existingButton = target.closest<HTMLElement>("[data-remove-existing-image]");
  if (existingButton) {
    const index = Number(existingButton.dataset.removeExistingImage);
    if (Number.isInteger(index)) {
      existingProductImages.splice(index, 1);
      renderProductImagePreview();
    }
    return;
  }

  const pendingButton = target.closest<HTMLElement>("[data-remove-pending-image]");
  if (pendingButton) {
    const index = Number(pendingButton.dataset.removePendingImage);
    if (Number.isInteger(index)) {
      pendingProductImageFiles.splice(index, 1);
      renderProductImagePreview();
    }
  }
});

document.getElementById("productId")?.addEventListener("input", updateAllAutoSkus);

function addReviewRow(review: any = {}) {
  const container = document.getElementById("reviewRows");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "dynamic-row dynamic-row--review";
  row.innerHTML = `
    <label class="admin-field"><span>Name</span><input data-review-name type="text" value="${escapeHtml(review.name || "")}" /></label>
    <label class="admin-field"><span>Rating</span><input data-review-rating type="number" min="1" max="5" step="1" value="${Number(review.rating || 5)}" /></label>
    <label class="admin-field"><span>Comment</span><input data-review-comment type="text" value="${escapeHtml(review.comment || "")}" /></label>
    <button class="admin-danger-button" data-remove-review type="button">Remove</button>
  `;
  container.appendChild(row);
}

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const statusEl = document.getElementById("productFormStatus");
  const editingId = inputValue("productEditingId");

  if (!inputValue("productId") || !inputValue("productSlug") || !inputValue("productTitle")) {
    setInlineStatus(statusEl, "Product ID, slug and title are required.", "error");
    return;
  }

  setInlineStatus(
    statusEl,
    pendingProductImageFiles.length
      ? "Uploading product images..."
      : editingId
      ? "Saving product..."
      : "Creating product..."
  );

  const submitButton = document.getElementById("saveProductButton") as HTMLButtonElement | null;
  if (submitButton) submitButton.disabled = true;

  try {
    const uploadedImages = await uploadPendingProductImages();
    const payload = collectProductPayload();

    payload.images = [
      ...existingProductImages,
      ...uploadedImages,
    ];

    // New products never receive synthetic/default reviews.
    // Reviews are included only if the admin explicitly added them.
    if (!editingId && !payload.reviews.length) {
      payload.reviews = [];
    }

    if (editingId) {
      await adminApi(`/products/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await adminApi("/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    setInlineStatus(statusEl, "Product saved.", "success");

    pendingProductImageFiles = [];
    existingProductImages = payload.images;

    await loadProducts();
    setTimeout(closeProductModal, 350);
  } catch (error) {
    setInlineStatus(statusEl, errorMessage(error), "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

function collectProductPayload() {
  const variants = Array.from(
    document.querySelectorAll<HTMLElement>("#variantRows .dynamic-row")
  )
    .map((row) => ({
      sku: childInputValue(row, "[data-variant-sku]"),
      size: childInputValue(row, "[data-variant-size]"),
      color: childInputValue(row, "[data-variant-color]"),
      stock: Number(childInputValue(row, "[data-variant-stock]") || 0),
    }))
    .filter((variant) => variant.sku);

  const reviews = Array.from(
    document.querySelectorAll<HTMLElement>("#reviewRows .dynamic-row")
  )
    .map((row) => ({
      name: childInputValue(row, "[data-review-name]"),
      rating: Number(childInputValue(row, "[data-review-rating]") || 5),
      comment: childInputValue(row, "[data-review-comment]"),
    }))
    .filter((review) => review.name || review.comment);

  return {
    id: inputValue("productId"),
    slug: inputValue("productSlug"),
    title: inputValue("productTitle"),
    shortDescription: inputValue("productShortDescription"),
    description: inputValue("productDescription"),
    category: inputValue("productCategory") || "General",
    price: Number(inputValue("productPrice") || 0),
    currency: inputValue("productCurrency") || "EUR",
    stock: Number(inputValue("productStock") || 0),
    lowStockThreshold: Number(inputValue("productLowStockThreshold") || 0),
    featured: checked("productFeatured"),
    active: checked("productActive"),
    customQr: checked("productCustomQr"),
    qrConfig: {
      textPrint: inputValue("qrTextPrint") || "SCAN ME",
      textPosition: inputValue("qrTextPosition") === "top" ? "top" : "bottom",
      qrColor: inputValue("qrColor") || "#000000",
      textColor: inputValue("qrTextColor") || "#000000",
      size: Number(inputValue("qrPrintSize") || 3540),
    },
    images: [...existingProductImages],
    variants,
    reviews,
  };
}

document.getElementById("adminProductsGrid")?.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;

  const edit = target.closest<HTMLElement>("[data-edit-product]");
  if (edit?.dataset.editProduct) {
    const product = currentProducts.find((item) => item.id === edit.dataset.editProduct);
    if (product) openProductModal(product);
    return;
  }

  const addQr = target.closest<HTMLElement>("[data-add-qr-stock]");
  if (addQr?.dataset.addQrStock) {
    openStockModal(addQr.dataset.addQrStock);
    return;
  }

  const archive = target.closest<HTMLButtonElement>("[data-archive-product]");
  if (archive?.dataset.archiveProduct) {
    const productId = archive.dataset.archiveProduct;
    if (!window.confirm(`Archive product ${productId}?`)) return;

    archive.disabled = true;
    try {
      await adminApi(`/products/${encodeURIComponent(productId)}/archive`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadProducts();
    } catch (error) {
      alert(errorMessage(error));
    } finally {
      archive.disabled = false;
    }
  }
});

/* =========================================================
   QR STOCK GENERATION
   ========================================================= */

document.getElementById("openAddStockButton")?.addEventListener("click", async () => {
  if (!currentProducts.length) await loadProducts();
  openStockModal();
});

document.querySelectorAll<HTMLElement>("[data-close-stock-modal]").forEach((element) => {
  element.addEventListener("click", closeStockModal);
});

document.getElementById("stockProductId")?.addEventListener("change", () => {
  populateStockVariants();
});

document.getElementById("stockVariantSelect")?.addEventListener("change", () => {
  applySelectedStockVariant();
});

function openStockModal(preselectedProductId = "") {
  populateStockProducts(preselectedProductId);
  populateStockVariants();
  setInputValue("stockQuantity", 1);
  setInlineStatus(document.getElementById("stockFormStatus"), "");

  stockModal?.classList.remove("hidden");
  stockModal?.setAttribute("aria-hidden", "false");
}

function closeStockModal() {
  stockModal?.classList.add("hidden");
  stockModal?.setAttribute("aria-hidden", "true");
}

function populateStockProducts(preselectedProductId = "") {
  const select = document.getElementById("stockProductId") as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML = currentProducts
    .filter((product) => product.active !== false)
    .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.title || product.id)}</option>`)
    .join("");

  if (preselectedProductId) {
    select.value = preselectedProductId;
  }
}

function populateStockVariants() {
  const productId = inputValue("stockProductId");
  const product = currentProducts.find((item) => item.id === productId);
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const select = document.getElementById("stockVariantSelect") as HTMLSelectElement | null;

  if (!select) return;

  if (!variants.length) {
    select.innerHTML = `<option value="">Manual SKU / no predefined variant</option>`;
    setInputValue("stockSku", "");
    setInputValue("stockSize", "");
    setInputValue("stockColor", "");
    return;
  }

  select.innerHTML = variants
    .map((variant: any, index: number) => {
      const label = [variant.size || "No size", variant.color || "No color", variant.sku || "No SKU"].join(" · ");
      return `<option value="${index}">${escapeHtml(label)}</option>`;
    })
    .join("");

  applySelectedStockVariant();
}

function applySelectedStockVariant() {
  const productId = inputValue("stockProductId");
  const product = currentProducts.find((item) => item.id === productId);
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const selectedIndex = Number(inputValue("stockVariantSelect"));
  const variant = variants[selectedIndex];

  if (!variant) return;

  setInputValue("stockSku", variant.sku || "");
  setInputValue("stockSize", variant.size || "");
  setInputValue("stockColor", variant.color || "");
}

stockForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const statusEl = document.getElementById("stockFormStatus");
  const productId = inputValue("stockProductId");
  const sku = inputValue("stockSku");
  const size = inputValue("stockSize");
  const color = inputValue("stockColor");
  const quantity = Number(inputValue("stockQuantity"));

  if (!productId || !sku) {
    setInlineStatus(statusEl, "Product and SKU are required.", "error");
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    setInlineStatus(statusEl, "Quantity must be between 1 and 100.", "error");
    return;
  }

  setInlineStatus(
    statusEl,
    `Generating ${quantity} QR stock item${quantity === 1 ? "" : "s"}. This can take a little while because print files are generated and uploaded...`
  );

  const submitButton = document.getElementById("generateStockButton") as HTMLButtonElement | null;
  if (submitButton) submitButton.disabled = true;

  try {
    const result = await adminApi("/inventory/generate", {
      method: "POST",
      body: JSON.stringify({ productId, quantity, sku, size, color }),
    });

    setInlineStatus(
      statusEl,
      `Created ${Number(result?.count ?? result?.created?.length ?? quantity)} QR stock item(s).`,
      "success"
    );

    await Promise.all([loadProducts(), loadQr().catch(() => undefined)]);
  } catch (error) {
    setInlineStatus(statusEl, errorMessage(error), "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

/* =========================================================
   CUSTOMERS / QR / PAYMENTS
   ========================================================= */

async function loadCustomers() {
  const data = await adminApi("/customers");
  renderSimpleList(
    "customersList",
    data.customers || [],
    (customer: any) => `${customer.email || customer.id}`
  );
}

async function loadQr() {
  const data = await adminApi("/qr-codes");
  currentQrCodes = data.qrCodes || [];

  renderSimpleList(
    "qrAdminList",
    currentQrCodes,
    (qr: any) => {
      const status = qr.status ? ` [${qr.status}]` : "";
      const sku = qr.sku ? ` · ${qr.sku}` : "";
      return `${qr.shortId || qr.id}${status}${sku} → ${qr.targetUrl || "No destination"}`;
    }
  );
}

async function loadPayments() {
  const data = await adminApi("/payments");
  renderSimpleList(
    "paymentsList",
    data.payments || [],
    (payment: any) => `${payment.vivaOrderCode || payment.orderId} — ${payment.status || ""} — ${formatMoney(Number(payment.amount || 0))}`
  );
}

function renderSimpleList(
  targetId: string,
  items: any[],
  label: (item: any) => string
) {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (!items.length) {
    target.innerHTML = `<div class="admin-list-item"><strong>No data.</strong></div>`;
    return;
  }

  target.innerHTML = items
    .map(
      (item) => `<div class="admin-list-item"><strong>${escapeHtml(label(item))}</strong></div>`
    )
    .join("");
}

/* =========================================================
   REFRESH
   ========================================================= */

refreshButton?.addEventListener("click", () => {
  const active = document.querySelector<HTMLElement>(".admin-nav__item.is-active");
  void loadView(active?.dataset.view || "dashboard");
});

/* =========================================================
   HELPERS
   ========================================================= */

function setText(id: string, text: string) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(value: any): string {
  if (!value) return "—";

  const date = value?.seconds
    ? new Date(value.seconds * 1000)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("el-GR");
}

function customerName(customer: any): string {
  return [customer?.firstName, customer?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || customer?.name || customer?.email || "Customer";
}

function formatStatus(value: string) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function inputValue(id: string): string {
  const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return String(element?.value || "").trim();
}

function setInputValue(id: string, value: any) {
  const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (element) element.value = String(value ?? "");
}

function checked(id: string): boolean {
  return Boolean((document.getElementById(id) as HTMLInputElement | null)?.checked);
}

function setChecked(id: string, value: boolean) {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (element) element.checked = value;
}

function childInputValue(parent: HTMLElement, selector: string): string {
  const input = parent.querySelector<HTMLInputElement>(selector);
  return String(input?.value || "").trim();
}

function setInlineStatus(
  element: HTMLElement | null,
  message: string,
  type: "success" | "error" | "" = ""
) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-success", type === "success");
  element.classList.toggle("is-error", type === "error");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function escapeHtml(value: any): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
