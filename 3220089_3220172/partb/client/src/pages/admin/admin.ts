import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { firebaseAuth } from "../../services/firebase";


const loginSection =
  document.getElementById("adminLogin");

const app =
  document.getElementById("adminApp");

const loginForm =
  document.getElementById(
    "adminLoginForm"
  ) as HTMLFormElement | null;

const loginStatus =
  document.getElementById(
    "adminLoginStatus"
  );

const logoutButton =
  document.getElementById(
    "adminLogout"
  );

const userEmail =
  document.getElementById(
    "adminUserEmail"
  );

const refreshButton =
  document.getElementById(
    "adminRefresh"
  );


let currentDashboard: any = null;


/* ==============================================
   API
   ============================================== */

async function adminApi(
  path: string,
  options: RequestInit = {}
) {

  const user =
    firebaseAuth.currentUser;

  if (!user) {
    throw new Error(
      "Administrator not signed in"
    );
  }

  const token =
    await user.getIdToken();

  const response =
    await fetch(
      `/api/admin${path}`,
      {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,

          ...(options.headers || {}),
        },
      }
    );

  if (response.status === 403) {
    throw new Error(
      "This account does not have administrator access."
    );
  }

  const payload =
    await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.message ||
      "Admin request failed"
    );
  }

  return payload;
}


/* ==============================================
   LOGIN
   ============================================== */

loginForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (loginStatus) {
      loginStatus.textContent =
        "Signing in...";
    }

    const formData =
      new FormData(loginForm);

    const email =
      String(
        formData.get("email") || ""
      ).trim();

    const password =
      String(
        formData.get("password") || ""
      );

    try {

      await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );

    } catch (error: any) {

      console.error(error);

      if (loginStatus) {
        loginStatus.textContent =
          "Invalid credentials or access denied.";
      }

    }

  }
);


/* ==============================================
   AUTH STATE
   ============================================== */

onAuthStateChanged(
  firebaseAuth,
  async (user) => {

    if (!user) {

      loginSection?.classList.remove(
        "hidden"
      );

      app?.classList.add(
        "hidden"
      );

      return;
    }

    try {

      /*
       * Critical:
       * validate ADMIN status on backend.
       */

      await adminApi("/me");

      if (userEmail) {
        userEmail.textContent =
          user.email || "Admin";
      }

      loginSection?.classList.add(
        "hidden"
      );

      app?.classList.remove(
        "hidden"
      );

      await loadDashboard();

    } catch (error: any) {

      console.error(error);

      await signOut(
        firebaseAuth
      );

      if (loginStatus) {
        loginStatus.textContent =
          error.message ||
          "Administrator access denied.";
      }

    }

  }
);


logoutButton?.addEventListener(
  "click",
  async () => {

    await signOut(
      firebaseAuth
    );

  }
);


/* ==============================================
   NAVIGATION
   ============================================== */

const navButtons =
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".admin-nav__item"
    )
  );


function openView(
  view: string
) {

  document
    .querySelectorAll(
      ".admin-view"
    )
    .forEach(
      (element) => {

        element.classList.add(
          "hidden"
        );

      }
    );


  document
    .getElementById(
      `view-${view}`
    )
    ?.classList.remove(
      "hidden"
    );


  navButtons.forEach(
    (button) => {

      button.classList.toggle(
        "is-active",
        button.dataset.view === view
      );

    }
  );


  const titles:
    Record<string, string> = {

      dashboard:
        "Dashboard",

      orders:
        "Orders",

      products:
        "Products",

      customers:
        "Customers",

      qr:
        "QR Codes",

      payments:
        "Payments",

    };


  const title =
    document.getElementById(
      "adminPageTitle"
    );

  if (title) {
    title.textContent =
      titles[view] || view;
  }


  void loadView(view);
}


navButtons.forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        const view =
          button.dataset.view;

        if (view) {
          openView(view);
        }

      }
    );

  }
);


document
  .querySelectorAll<HTMLElement>(
    "[data-open-view]"
  )
  .forEach(
    (element) => {

      element.addEventListener(
        "click",
        () => {

          const view =
            element.dataset.openView;

          if (view) {
            openView(view);
          }

        }
      );

    }
  );


/* ==============================================
   LOAD VIEW
   ============================================== */

async function loadView(
  view: string
) {

  switch (view) {

    case "dashboard":
      await loadDashboard();
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


/* ==============================================
   DASHBOARD
   ============================================== */

async function loadDashboard() {

  const data =
    await adminApi(
      "/dashboard"
    );

  currentDashboard = data;

  setText(
    "statRevenue",
    formatMoney(
      data.revenue || 0
    )
  );

  setText(
    "statOrders",
    String(
      data.orders || 0
    )
  );

  setText(
    "statCustomers",
    String(
      data.customers || 0
    )
  );

  setText(
    "statQr",
    String(
      data.qrCodes || 0
    )
  );


  renderOrders(
    data.recentOrders || [],
    "recentOrdersBody"
  );

}


/* ==============================================
   ORDERS
   ============================================== */

async function loadOrders() {

  const data =
    await adminApi(
      "/orders"
    );

  renderOrders(
    data.orders || [],
    "ordersBody"
  );

}


function renderOrders(
  orders: any[],
  targetId: string
) {

  const body =
    document.getElementById(
      targetId
    );

  if (!body) return;


  body.innerHTML =
    orders
      .map(
        (order) => {

          const paymentStatus =
            order.paymentStatus ||
            order.status ||
            "pending";

          return `
            <tr>

              <td>
                <span class="admin-order-id">
                  ${escapeHtml(
                    order.id || ""
                  )}
                </span>
              </td>

              <td class="admin-table__customer">

                <strong>
                  ${escapeHtml(
                    `${order.customer?.firstName || ""}
                     ${order.customer?.lastName || ""}`
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    order.customer?.email || ""
                  )}
                </span>

              </td>

              ${
                targetId ===
                "ordersBody"
                  ? `
                    <td>
                      ${
                        order.items?.length || 0
                      }
                    </td>
                  `
                  : ""
              }

              <td>
                <span class="admin-badge admin-badge--${escapeHtml(paymentStatus)}">
                  ${escapeHtml(paymentStatus)}
                </span>
              </td>

              ${
                targetId ===
                  "ordersBody"
                  ? `
                    <td>
                      ${escapeHtml(
                        order.delivery || "—"
                      )}
                    </td>
                  `
                  : ""
              }

              <td>
                ${formatMoney(
                  Number(
                    order.total || 0
                  )
                )}
              </td>

              <td>
                ${formatDate(
                  order.createdAt
                )}
              </td>

              <td>

                <button
                  class="admin-text-button"
                  data-order-id="${escapeHtml(
                    order.id
                  )}"
                >
                  View
                </button>

              </td>

            </tr>
          `;

        }
      )
      .join("");


  body
    .querySelectorAll<HTMLButtonElement>(
      "[data-order-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset.orderId;

            if (id) {
              void openOrder(
                id
              );
            }

          }
        );

      }
    );

}


/* ==============================================
   ORDER DRAWER
   ============================================== */

async function openOrder(
  orderId: string
) {

  const data =
    await adminApi(
      `/orders/${encodeURIComponent(
        orderId
      )}`
    );

  const order =
    data.order;

  setText(
    "drawerOrderId",
    order.id
  );


  const content =
    document.getElementById(
      "adminOrderDrawerContent"
    );

  if (content) {

    content.innerHTML = `

      <div class="admin-detail-group">

        <h3>
          Customer
        </h3>

        <p>
          <strong>
            ${escapeHtml(
              `${order.customer?.firstName || ""}
               ${order.customer?.lastName || ""}`
            )}
          </strong>
        </p>

        <p>
          ${escapeHtml(
            order.customer?.email || ""
          )}
        </p>

        <p>
          ${escapeHtml(
            order.customer?.phone || ""
          )}
        </p>

      </div>


      <div class="admin-detail-group">

        <h3>
          Payment
        </h3>

        <p>
          Status:
          <strong>
            ${escapeHtml(
              order.paymentStatus ||
              order.status ||
              ""
            )}
          </strong>
        </p>

        <p>
          Viva order:
          ${escapeHtml(
            order.payment?.vivaOrderCode ||
            "—"
          )}
        </p>

        <p>
          Total:
          <strong>
            ${formatMoney(
              Number(
                order.total || 0
              )
            )}
          </strong>
        </p>

      </div>


      <div class="admin-detail-group">

        <h3>
          Delivery
        </h3>

        <p>
          ${escapeHtml(
            order.delivery || "—"
          )}
        </p>

        <pre>${escapeHtml(
          JSON.stringify(
            order.locker ||
            order.shippingAddress ||
            {},
            null,
            2
          )
        )}</pre>

      </div>


      <div class="admin-detail-group">

        <h3>
          Items
        </h3>

        ${
          (order.items || [])
            .map(
              (item: any) => `

                <p>
                  <strong>
                    ${escapeHtml(
                      item.title || ""
                    )}
                  </strong>

                  ×
                  ${
                    item.quantity || 1
                  }

                  —
                  ${formatMoney(
                    Number(
                      item.price || 0
                    )
                  )}
                </p>

              `
            )
            .join("")
        }

      </div>

    `;

  }


  document
    .getElementById(
      "adminDrawerOverlay"
    )
    ?.classList.remove(
      "hidden"
    );

  document
    .getElementById(
      "adminOrderDrawer"
    )
    ?.classList.remove(
      "hidden"
    );

}


function closeDrawer() {

  document
    .getElementById(
      "adminDrawerOverlay"
    )
    ?.classList.add(
      "hidden"
    );

  document
    .getElementById(
      "adminOrderDrawer"
    )
    ?.classList.add(
      "hidden"
    );

}


document
  .getElementById(
    "closeAdminDrawer"
  )
  ?.addEventListener(
    "click",
    closeDrawer
  );


document
  .getElementById(
    "adminDrawerOverlay"
  )
  ?.addEventListener(
    "click",
    closeDrawer
  );


/* ==============================================
   OTHER DATA
   ============================================== */

async function loadProducts() {

  const data =
    await adminApi(
      "/products"
    );

  const grid =
    document.getElementById(
      "adminProductsGrid"
    );

  if (!grid) return;


  grid.innerHTML =
    (data.products || [])
      .map(
        (product: any) => `

          <article class="admin-product">

            ${
              product.image
                ? `
                  <img
                    src="${escapeHtml(
                      product.image
                    )}"
                    alt=""
                  >
                `
                : ""
            }

            <h3>
              ${escapeHtml(
                product.title || ""
              )}
            </h3>

            <p>
              ${formatMoney(
                Number(
                  product.price || 0
                )
              )}
              ·
              Stock:
              ${
                product.stock ?? "—"
              }
            </p>

          </article>

        `
      )
      .join("");

}


async function loadCustomers() {

  const data =
    await adminApi(
      "/customers"
    );

  renderSimpleList(
    "customersList",
    data.customers || [],
    (customer: any) =>
      `${customer.email || customer.id}`
  );

}


async function loadQr() {

  const data =
    await adminApi(
      "/qr-codes"
    );

  renderSimpleList(
    "qrAdminList",
    data.qrCodes || [],
    (qr: any) =>
      `${qr.shortId || qr.id} → ${qr.targetUrl || "No destination"}`
  );

}


async function loadPayments() {

  const data =
    await adminApi(
      "/payments"
    );

  renderSimpleList(
    "paymentsList",
    data.payments || [],
    (payment: any) =>
      `${payment.vivaOrderCode || payment.orderId} — ${payment.status || ""}`
  );

}


function renderSimpleList(
  targetId: string,
  items: any[],
  label: (item: any) => string
) {

  const target =
    document.getElementById(
      targetId
    );

  if (!target) return;


  target.innerHTML =
    items
      .map(
        (item) => `

          <div class="admin-list-item">

            <strong>
              ${escapeHtml(
                label(item)
              )}
            </strong>

          </div>

        `
      )
      .join("");

}


/* ==============================================
   REFRESH
   ============================================== */

refreshButton?.addEventListener(
  "click",
  () => {

    const active =
      document.querySelector<HTMLElement>(
        ".admin-nav__item.is-active"
      );

    void loadView(
      active?.dataset.view ||
      "dashboard"
    );

  }
);


/* ==============================================
   HELPERS
   ============================================== */

function setText(
  id: string,
  text: string
) {

  const element =
    document.getElementById(id);

  if (element) {
    element.textContent =
      text;
  }

}


function formatMoney(
  value: number
): string {

  return new Intl.NumberFormat(
    "el-GR",
    {
      style: "currency",
      currency: "EUR",
    }
  ).format(value);

}


function formatDate(
  value: any
): string {

  if (!value) return "—";

  const date =
    value?.seconds
      ? new Date(
          value.seconds * 1000
        )
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "el-GR"
  );

}


function escapeHtml(
  value: any
): string {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}