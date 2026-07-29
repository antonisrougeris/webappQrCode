/* 3220089_3220172 */

import { initNav } from "./components/initNav";
import { initMobileMenu } from "./components/menu";
import { renderProducts } from "./components/renderProducts";
import { getProducts } from "./services/products";
import { updateCartBadge } from "./utils/cart-badge";
import { firebaseAuth } from "./services/firebase";
import { getMyQrCodes, updateQrCode, type QrCode } from "./services/qr";

import QRCode from "qrcode";

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

function initCountdown(): void {
  const bar = document.getElementById("comingSoonBar");
  const targetDate = new Date("2026-08-10T00:00:00").getTime(); // 12 μέρες από σήμερα

  function pad(n: number): string {
    return n.toString().padStart(2, "0");
  }

  function tick(): void {
    const now = Date.now();
    const diff = targetDate - now;

    if (diff <= 0) {
      bar?.remove(); // κρύψε το bar όταν λήξει το countdown
      clearInterval(interval);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const daysEl = document.getElementById("cs-days");
    const hoursEl = document.getElementById("cs-hours");
    const minutesEl = document.getElementById("cs-minutes");
    const secondsEl = document.getElementById("cs-seconds");

    if (daysEl) daysEl.textContent = pad(days);
    if (hoursEl) hoursEl.textContent = pad(hours);
    if (minutesEl) minutesEl.textContent = pad(minutes);
    if (secondsEl) secondsEl.textContent = pad(seconds);
  }

  tick();
  const interval = setInterval(tick, 1000);
}

function initPromoPopup(): void {
  const overlay = document.getElementById("promoOverlay");
  const closeBtn = document.getElementById("promoClose");
  const copyBtn = document.getElementById("promoCopyBtn") as HTMLButtonElement | null;
  const codeEl = document.getElementById("promoCode");

  if (!overlay || !closeBtn || !copyBtn || !codeEl) return;

  const STORAGE_KEY = "skanare_promo_dismissed";

  function closePromo(): void {
    overlay?.classList.add("hidden");
    document.body.classList.remove("cart-open");
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore storage errors (private browsing etc.)
    }
  }

  let alreadyDismissed = false;
  try {
    alreadyDismissed = sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    alreadyDismissed = false;
  }

  if (!alreadyDismissed) {
    setTimeout(() => {
      overlay.classList.remove("hidden");
    }, 1500);
  }

  closeBtn.addEventListener("click", closePromo);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePromo();
  });

  copyBtn.addEventListener("click", async () => {
    const code = codeEl.textContent?.trim() || "";

    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    const originalText = copyBtn.textContent || "Copy code";
    copyBtn.textContent = "Copied!";
    copyBtn.classList.add("copied");

    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.classList.remove("copied");
    }, 1500);
  });
}

initPromoPopup();

initCountdown();

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
      const safeTarget = escapeHtml(qr.targetUrl || "");
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
        <article class="dashboard-card qr-dashboard-card">

          <p class="meta qr-card-meta">QR product</p>

          <img
            class="qr-dashboard-image"
            src="${qrDataUrl}"
            alt="QR code for ${title}"
            loading="lazy"
          />

          <h3 class="qr-dashboard-title">${title}</h3>
          <span class="qr-scan-badge">${qr.scans ?? 0} scans</span>

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
  );

  grid.innerHTML = htmlBlocks.join("");


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
