/* 3220089_3220172  2025 */

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";

initNav();
initMobileMenu();
updateCartBadge();

interface ProductVariant {
  size?: string;
  color?: string;
  stock?: number;
}

interface Product {
  _id?: string;
  id: string;
  title: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  category: "tshirt" | "accessory" | string;
  priceEUR: number;
  compareAtPriceEUR?: number;
  image?: string;
  images?: string[];
  badge?: string;
  tags?: string[];
  variants?: ProductVariant[];
  stock?: number;
  active?: boolean;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "http://localhost:4000/api";

async function getProducts(params: { q?: string; category?: string } = {}): Promise<Product[]> {
  const url = new URL(`${API_BASE}/products`);

  if (params.q && params.q.trim()) url.searchParams.set("q", params.q.trim());
  if (params.category && params.category !== "All") url.searchParams.set("category", params.category);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Products request failed (${response.status})`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.products || [];
}

function normalize(text: unknown): string {
  return String(text || "").trim().toLowerCase();
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function getProductImage(product: Product): string {
  return product.image || product.images?.[0] || "";
}

function isInStock(product: Product): boolean {
  if (typeof product.stock === "number") return product.stock > 0;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.some((variant) => Number(variant.stock || 0) > 0);
  }
  return true;
}

function productUrl(product: Product): string {
  const id = product.id || product._id || product.slug;
  return `/src/pages/product-details/product-details.html?id=${encodeURIComponent(String(id))}`;
}

function renderProducts(container: HTMLElement, products: Product[]): void {
  container.innerHTML = "";

  products.forEach((product) => {
    const article = document.createElement("article");
    article.className = "card product-card";

    const link = document.createElement("a");
    link.href = productUrl(product);

    const media = document.createElement("div");
    media.className = `product-media ${product.category === "accessory" ? "grey" : ""}`;

    const badgeText = product.badge || (product.featured ? "Featured" : "");
    if (badgeText) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = badgeText;
      media.appendChild(badge);
    }

    const image = getProductImage(product);
    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = product.title;
      img.loading = "lazy";
      img.className = "product-img";
      media.appendChild(img);
    } else {
      const fallback = document.createElement("div");
      fallback.className = product.category === "tshirt" ? "mini-shirt" : "category-icon";
      fallback.textContent = product.category === "accessory" ? "▣" : "";
      media.appendChild(fallback);
    }

    const body = document.createElement("div");
    body.className = "product-body";

    const row = document.createElement("div");
    row.className = "product-row";

    const title = document.createElement("h3");
    title.textContent = product.title;

    const price = document.createElement("p");
    price.className = "price";
    price.textContent = formatPrice(product.priceEUR);

    row.append(title, price);

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = product.shortDescription || product.description || "";

    const stock = document.createElement("p");
    stock.className = "meta";
    stock.textContent = isInStock(product) ? "In stock" : "Out of stock";

    body.append(row, meta, stock);
    link.append(media, body);
    article.appendChild(link);
    container.appendChild(article);
  });
}

function getStateFromURL(): { q: string; category: string } {
  const params = new URLSearchParams(window.location.search);

  return {
    q: params.get("q") || "",
    category: params.get("category") || "All",
  };
}

function setStateToURL(state: { q: string; category: string }): void {
  const params = new URLSearchParams();

  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.category !== "All") params.set("category", state.category);

  const query = params.toString();
  window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

function applyClientFilters(products: Product[], state: { q: string; category: string }): Product[] {
  const q = normalize(state.q);

  return products.filter((product) => {
    const matchesQuery =
      !q ||
      normalize(product.title).includes(q) ||
      normalize(product.shortDescription).includes(q) ||
      normalize(product.description).includes(q) ||
      normalize(product.tags?.join(" ")).includes(q);

    const matchesCategory = state.category === "All" || product.category === state.category;

    return matchesQuery && matchesCategory && product.active !== false;
  });
}

async function initProductsPage(): Promise<void> {
  const grid = document.getElementById("productsGrid") as HTMLElement | null;
  if (!grid) return;

  const searchInput = document.getElementById("productSearch") as HTMLInputElement | null;
  const categorySelect = document.getElementById("productCategory") as HTMLSelectElement | null;
  const loadingEl = document.getElementById("productsLoading") as HTMLElement | null;
  const emptyEl = document.getElementById("productsEmpty") as HTMLElement | null;
  const errorEl = document.getElementById("productsError") as HTMLElement | null;

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
    renderProducts(grid, filtered);

    if (emptyEl) emptyEl.hidden = filtered.length > 0;
  };

  try {
    if (loadingEl) loadingEl.hidden = false;
    if (errorEl) errorEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;

    products = await getProducts(urlState);

    if (loadingEl) loadingEl.hidden = true;

    update();

    searchInput?.addEventListener("input", update);
    categorySelect?.addEventListener("change", async () => {
      try {
        const state = getState();
        products = await getProducts({ category: state.category });
        update();
      } catch (error) {
        console.error("Failed to reload products:", error);
        update();
      }
    });
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
