console.log("main.ts loaded");

import { initNav } from "./components/initNav";
import { initMobileMenu } from "./components/menu";
import { renderProducts } from "./components/renderProducts";
import { getProducts} from "./services/api.products";
import { updateCartBadge } from "./utils/cart-badge";

initNav();
initMobileMenu();
updateCartBadge();

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
});