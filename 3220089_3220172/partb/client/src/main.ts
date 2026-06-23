console.log("main.ts loaded");

import { initNav } from "./components/initNav";
import { initMobileMenu } from "./components/menu";
import { renderProducts } from "./components/renderProducts";
import { getProducts } from "./services/api.products";
import { updateCartBadge } from "./utils/cart-badge";
import { firebaseAuth } from "./services/firebase";
import { db } from "./services/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";

initNav();
initMobileMenu();
updateCartBadge();

async function loadUserQRCodes(user: any) {
  if (!user) return;

  try {
    const q = query(collection(db, "qrCodes"), where("userId", "==", user.uid));

    const snapshot = await getDocs(q);

    const dashboardHero = document.getElementById("userDashboardHero");
    if (dashboardHero) {
      dashboardHero.classList.remove("hidden");
    }

    const defaultHero = document.getElementById("defaultHero");
    if (defaultHero) {
      defaultHero.classList.add("hidden");
    }

    if (snapshot.empty) {
      dashboardHero?.classList.add("hidden");
      defaultHero?.classList.remove("hidden");
      return;
    }

    const grid = document.getElementById("userQrGrid");

    if (grid) {
      grid.innerHTML = ""; // clear πριν render
    }

    if (!grid) return;

    grid.innerHTML = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        const qrUrl = `https://qrcode-zxfxi9.web.app/q/${id}`;

        return `
        <div class="card qr-card">

          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrUrl}"
          />

          <p><strong>${data.productTitle || "QR Product"}</strong></p>

          <small>${qrUrl}</small>

          <input id="input-${id}" value="${data.targetUrl || ""}" />

          <button onclick="updateQR('${id}')">
            Update Link
          </button>

        </div>
      `;
      })
      .join("");
  } catch (err) {
    console.error("QR load error:", err);
  }
}

async function loadHomepageProducts(
  gridId: string,
  loadingId: string,
  emptyId: string,
  errorId: string,
  category: "tshirt" | "accessory"
) {
  const grid = document.getElementById(gridId) as HTMLElement | null;
  const loadingEl = document.getElementById(loadingId);
  const emptyEl = document.getElementById(emptyId);
  const errorEl = document.getElementById(errorId);

  if (!grid) return;

  try {
    loadingEl?.removeAttribute("hidden");
    emptyEl?.setAttribute("hidden", "");
    errorEl?.setAttribute("hidden", "");

    const products = await getProducts();

    const filtered = products
      .filter((p) => p.active)
      .filter((p) => p.featured)
      .filter((p) => p.category === category)
      .slice(0, 4);

    renderProducts(grid, filtered);

    loadingEl?.setAttribute("hidden", "");

    if (filtered.length === 0) {
      emptyEl?.removeAttribute("hidden");
    }
  } catch (error) {
    console.error("Failed to load homepage products:", error);

    loadingEl?.setAttribute("hidden", "");
    errorEl?.removeAttribute("hidden");
  }
}

(window as any).updateQR = async (id: string) => {
  const input = document.getElementById(`input-${id}`) as HTMLInputElement;

  if (!input?.value) return;

  try {
    await updateDoc(doc(db, "qrCodes", id), {
      targetUrl: input.value,
    });

    alert("✅ Link updated");
  } catch (err) {
    console.error("Update failed:", err);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  loadHomepageProducts(
    "featuredTshirtsGrid",
    "featuredTshirtsLoading",
    "featuredTshirtsEmpty",
    "featuredTshirtsError",
    "tshirt"
  );

  loadHomepageProducts(
    "featuredAccessoriesGrid",
    "featuredAccessoriesLoading",
    "featuredAccessoriesEmpty",
    "featuredAccessoriesError",
    "accessory"
  );
  firebaseAuth.onAuthStateChanged((user) => {
    const dashboardHero = document.getElementById("userDashboardHero");
    const defaultHero = document.getElementById("defaultHero");
    const grid = document.getElementById("userQrGrid");

    if (user) {
      loadUserQRCodes(user);
      return;
    }

    dashboardHero?.classList.add("hidden");
    defaultHero?.classList.remove("hidden");

    if (grid) {
      grid.innerHTML = "";
    }
  });
});
