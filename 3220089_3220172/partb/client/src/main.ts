/* 3220089_3220172 */

import { initNav } from "./components/initNav";
import { initMobileMenu } from "./components/menu";
import { renderProducts } from "./components/renderProducts";
import { getProducts } from "./services/products";
import { updateCartBadge } from "./utils/cart-badge";
import { firebaseAuth } from "./services/firebase";
import { getMyQrCodes, updateQrCode, type QrCode } from "./services/qr";

initNav();
initMobileMenu();
void updateCartBadge();

/* =========================
   USER QR DASHBOARD
========================= */

function renderQrDashboard(grid: HTMLElement, qrCodes: QrCode[]): void {
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
      const safeTarget = qr.targetUrl || "";
      const title = qr.productTitle || "QR Product";

      return `
        <article class="dashboard-card qr-dashboard-card">
          <div class="dashboard-card__head">
            <div>
              <p class="meta">QR product</p>
              <h3>${title}</h3>
            </div>
            <span class="qr-scan-badge">${qr.scans ?? 0} scans</span>
          </div>

          <label class="qr-edit-label" for="input-${qr.id}">
            Destination URL
          </label>

          <div class="qr-edit-row">
            <input
              id="input-${qr.id}"
              class="qr-edit-input"
              type="url"
              value="${safeTarget}"
              placeholder="https://example.com"
            />
            <button
              type="button"
              class="btn-primary qr-save-btn"
              data-qr-id="${qr.id}"
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
    dashboardHero?.classList.remove("hidden");
    defaultHero?.classList.add("hidden");

    grid.innerHTML = `<p class="meta">Loading your QR products...</p>`;

    const qrCodes = await getMyQrCodes();
    renderQrDashboard(grid, qrCodes);
  } catch (error) {
    console.error("Failed to load user QR codes:", error);

    grid.innerHTML = `
      <div class="error-state">
        <p>Could not load your QR products right now.</p>
      </div>
    `;
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
