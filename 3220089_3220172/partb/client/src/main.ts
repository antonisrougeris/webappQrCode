/* 3220089_3220172 */

import { initNav } from "./components/initNav";
import { initMobileMenu } from "./components/menu";
import { renderProducts } from "./components/renderProducts";
import { getProducts } from "./services/products";
import { updateCartBadge } from "./utils/cart-badge";
import { firebaseAuth } from "./services/firebase";
import { getMyQrCodes, updateQrCode, type QrCode } from "./services/qr";

async function initGuestSession(): Promise<void> {
  try {
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/session/guest`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Failed to initialize guest session:", error);
  }
}

initNav();
initMobileMenu();
void initGuestSession().then(() => updateCartBadge());
/* =========================
   USER QR DASHBOARD
========================= */

function renderQrDashboard(grid: HTMLElement, qrCodes: QrCode[]): void {
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

  grid.innerHTML = qrCodes
    .map((qr) => {
      const safeTarget = escapeHtml(qr.targetUrl || "");
      const title = escapeHtml(qr.productTitle || "QR Product");
      const safeQrId = escapeHtml(qr.id);
      const QR_REDIRECT_BASE_URL =
        import.meta.env.VITE_QR_REDIRECT_BASE_URL ||
        "https://redirectqr-qrk4dnnhta-ew.a.run.app";

const publicQrId = qr.shortId || qr.id;

const qrRedirectUrl = `${QR_REDIRECT_BASE_URL}/${encodeURIComponent(
  publicQrId
)}`;

const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
        qrRedirectUrl
      )}`;

      const safeQrImageUrl = escapeHtml(qrImageUrl);

      return `
  <article class="dashboard-card qr-dashboard-card">
    <p class="meta qr-card-meta">QR product</p>

    <img
      class="qr-dashboard-image"
      src="${safeQrImageUrl}"
      alt="QR code for ${title}"
      loading="lazy"
    />

    <h3 class="qr-dashboard-title">${title}</h3>
    <span class="qr-scan-badge">${qr.scans ?? 0} scans</span>

    <label class="qr-edit-label" for="input-${safeQrId}">
      Destination URL
    </label>

    <div class="qr-edit-row">
      <input
        id="input-${safeQrId}"
        class="qr-edit-input"
        type="url"
        value="${safeTarget}"
        placeholder="https://example.com"
      />
      <button
        type="button"
        class="btn-primary qr-save-btn"
        data-qr-id="${safeQrId}"
      >
        Save
      </button>
    </div>
  </article>
`;
    })
    .join("");

  grid.querySelectorAll<HTMLButtonElement>(".qr-save-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const qrId = button.dataset.qrId;
      if (!qrId) return;

      const input = document.getElementById(
        `input-${qrId}`
      ) as HTMLInputElement | null;

      const targetUrl = input?.value.trim() || "";

      if (!targetUrl) {
        alert("Please enter a destination URL.");
        return;
      }

      button.disabled = true;
      const originalText = button.textContent || "Save";
      button.textContent = "Saving...";

      try {
        await updateQrCode(qrId, targetUrl);
        button.textContent = "Saved";

        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 1200);
      } catch (error) {
        console.error("Failed to update QR code:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to update QR destination."
        );
        button.textContent = originalText;
        button.disabled = false;
      }
    });
  });
}

async function loadUserQrCodes(): Promise<void> {
  const dashboardHero = document.getElementById("userDashboardHero");
  const defaultHero = document.getElementById("defaultHero");
  const grid = document.getElementById("userQrGrid") as HTMLElement | null;

  if (!grid) return;

  try {
    const qrCodes = await getMyQrCodes();

    if (!qrCodes.length) {
      dashboardHero?.classList.add("hidden");
      defaultHero?.classList.remove("hidden");
      grid.innerHTML = "";
      return;
    }

    dashboardHero?.classList.remove("hidden");
    defaultHero?.classList.add("hidden");

    renderQrDashboard(grid, qrCodes);
  } catch (error) {
    console.error("Failed to load user QR codes:", error);

    dashboardHero?.classList.add("hidden");
    defaultHero?.classList.remove("hidden");
    grid.innerHTML = "";
  }
}

function resetLoggedOutHomepageState(): void {
  const dashboardHero = document.getElementById("userDashboardHero");
  const defaultHero = document.getElementById("defaultHero");
  const grid = document.getElementById("userQrGrid");

  dashboardHero?.classList.add("hidden");
  defaultHero?.classList.remove("hidden");

  if (grid) {
    grid.innerHTML = "";
  }
}

/* =========================
   HOMEPAGE PRODUCTS
========================= */

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

    const products = await getProducts({
      category,
      featured: true,
      active: true,
      limit: 4,
    });

    const safeProducts = Array.isArray(products) ? products : [];

    renderProducts(grid, safeProducts);

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
    if (user) {
      void loadUserQrCodes();
      return;
    }

    resetLoggedOutHomepageState();
  });
});
