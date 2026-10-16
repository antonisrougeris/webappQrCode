import "../../i18n/auto";
/* 3220089_3220172  2025 */

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";
import { getProducts, type Product } from "../../services/products";
import { renderProducts } from "../../components/renderProducts";

initNav();
initMobileMenu();
updateCartBadge();

function getStateFromURL(): { q: string; category: string } {
  const params = new URLSearchParams(window.location.search);

  return {
    q: params.get("q") || "",
    category: params.get("category") || "All",
  };
}

function setStateToURL(state: { q: string; category: string }): void {
  const params = new URLSearchParams(window.location.search);
  params.delete("q");
  params.delete("category");

  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.category !== "All") params.set("category", state.category);

  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query ? `${window.location.pathname}?${query}` : window.location.pathname
  );
}

function applyClientFilters(
  products: Product[],
  state: { q: string; category: string }
): Product[] {
  const q = normalize(state.q);

  return products.filter((product) => {
    const matchesQuery =
      !q ||
      normalize(product.title).includes(q) ||
      normalize(product.shortDescription).includes(q) ||
      normalize(product.description).includes(q) ||
      normalize(product.tags?.join(" ")).includes(q);

    const matchesCategory =
      state.category === "All" || product.category === state.category;

    return matchesQuery && matchesCategory && product.active !== false;
  });
}

async function initProductsPage(): Promise<void> {
  const grid = document.getElementById("productsGrid") as HTMLElement | null;
  if (!grid) return;

  const searchInput = document.getElementById(
    "productSearch"
  ) as HTMLInputElement | null;
  const categorySelect = document.getElementById(
    "productCategory"
  ) as HTMLSelectElement | null;
  const loadingEl = document.getElementById(
    "productsLoading"
  ) as HTMLElement | null;
  const emptyEl = document.getElementById(
    "productsEmpty"
  ) as HTMLElement | null;
  const errorEl = document.getElementById(
    "productsError"
  ) as HTMLElement | null;

  const urlState = getStateFromURL();

  if (searchInput) searchInput.value = urlState.q;
  if (categorySelect) categorySelect.value = urlState.category;

  let products: Product[] = [];

  const getState = () => ({
    q: searchInput?.value || "",
    category: categorySelect?.value || "All",
  });

  const update = () => {
    const state = getState();
    setStateToURL(state);

    const filtered = applyClientFilters(products, state);
    renderProducts(grid, filtered, { eagerFirstImages: 4 });

    if (emptyEl) emptyEl.hidden = filtered.length > 0;
  };

  try {
    if (loadingEl) loadingEl.hidden = false;
    if (errorEl) errorEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;

    // Match homepage and the server-prerendered catalog: one shared card renderer.
    // Fetch all active products once; filtering locally avoids API-induced card flicker.
    products = await getProducts({ active: true });

    if (loadingEl) loadingEl.hidden = true;

    update();

    searchInput?.addEventListener("input", update);
    categorySelect?.addEventListener("change", update);
  } catch (error: any) {
    console.error("Failed to load products:", error);

    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = error.message || "Failed to load products.";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProductsPage);
} else {
  initProductsPage();
}
