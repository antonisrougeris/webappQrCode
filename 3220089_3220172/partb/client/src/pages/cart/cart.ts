/* 3220089_3220172  2025 */

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";

initNav();
initMobileMenu();

interface CartItem {
  productId: string;
  title: string;
  priceEUR: number;
  image?: string;
  quantity: number;
  selectedVariant?: {
    size?: string;
    color?: string;
    stock?: number;
  };
  qrDestination?: string;
}

interface Product {
  id: string;
  _id?: string;
  title: string;
  priceEUR: number;
  images?: string[];
  image?: string;
  active?: boolean;
}

const CART_KEY = "skanare_cart";
const API_BASE = import.meta.env?.VITE_API_BASE_URL || "http://localhost:4000/api";

const FREE_SHIPPING_TARGET = 50;
const FREE_STICKERS_TARGET = 80;

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function getCart(): CartItem[] {
  const raw = localStorage.getItem(CART_KEY);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  void updateCartBadge();
}

async function getAllProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE}/products`);

  if (!response.ok) {
    throw new Error(`Products request failed (${response.status})`);
  }

  return response.json();
}

function getProductImage(product: Product): string {
  return product.image || product.images?.[0] || "";
}

function getCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    return sum + item.priceEUR * item.quantity;
  }, 0);
}

function getCartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function updateProgress(total: number): string {
  const nextTarget = total < FREE_SHIPPING_TARGET ? FREE_SHIPPING_TARGET : FREE_STICKERS_TARGET;
  const percent = Math.min((total / nextTarget) * 100, 100);

  let message = "";

  if (total < FREE_SHIPPING_TARGET) {
    message = `Only ${formatPrice(FREE_SHIPPING_TARGET - total)} away from free shipping.`;
  } else if (total < FREE_STICKERS_TARGET) {
    message = `Only ${formatPrice(FREE_STICKERS_TARGET - total)} away from free sticker set.`;
  } else {
    message = "You unlocked free shipping and free sticker set.";
  }

  return `
    <div class="cart-progress">
      <p>${message}</p>

      <div class="cart-progress-track">
        <div class="cart-progress-fill" style="width:${percent}%"></div>
      </div>

      <div class="cart-progress-rewards">
        <span>🚚<small>Free Shipping</small></span>
        <span>🎁<small>Free Sticker Set</small></span>
      </div>
    </div>
  `;
}


function renderCartItem(item: CartItem, index: number): string {
  const sizeText = item.selectedVariant?.size
    ? `<p>Size: ${item.selectedVariant.size}</p>`
    : "";

  const qrText = item.qrDestination
    ? `<p>QR-Code: ${item.qrDestination}</p>`
    : "";

  return `
    <article class="drawer-cart-item" data-index="${index}">
      <img src="${item.image || "/assets/img/logo_Image.png"}" alt="${item.title}" />

      <div class="drawer-cart-info">
        <h3>${item.title}</h3>
        ${sizeText}
        ${qrText}

        <div class="drawer-qty">
          <button type="button" class="cart-decrease" data-index="${index}">−</button>
          <span>${item.quantity}</span>
          <button type="button" class="cart-increase" data-index="${index}">+</button>
        </div>
      </div>

      <div class="drawer-cart-price">
        <button type="button" class="cart-remove" data-index="${index}">🗑</button>
        <strong>${formatPrice(item.priceEUR * item.quantity)}</strong>
      </div>
    </article>
  `;
}

async function renderCrossSell(currentItems: CartItem[]): Promise<string> {
  try {
    const products = await getAllProducts();
    const currentIds = new Set(currentItems.map((item) => item.productId));

    const suggestions = products
      .filter((product) => product.active !== false && !currentIds.has(product.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);

    if (suggestions.length === 0) return "";

    return `
      <section class="cart-cross-sell">
        <h3>Others also bought:</h3>

        <div class="cart-cross-sell-row">
          ${suggestions
            .map((product) => {
              const image = getProductImage(product);

              return `
                <article class="cart-cross-card">
                  <img src="${image || "/assets/img/logo_Image.png"}" alt="${product.title}" />
                  <h4>${product.title}</h4>
                  <p>${formatPrice(product.priceEUR)}</p>
                  <a href="/src/pages/product-details/product-details.html?id=${encodeURIComponent(product.id)}">
                    Add
                  </a>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  } catch {
    return "";
  }
}

async function renderCart(targetId: string): Promise<void> {
  const container = document.getElementById(targetId);
  if (!container) return;

  const items = getCart();
  const total = getCartTotal(items);

  if (items.length === 0) {
    container.innerHTML = `
      <section class="cart-empty">
        <h2>Your cart is empty</h2>
        <p class="meta">Add a product to see it here.</p>
        <a class="btn-primary" href="/src/pages/products/products.html">Shop products</a>
      </section>
    `;
    return;
  }

  const crossSell = await renderCrossSell(items);

  container.innerHTML = `
    ${updateProgress(total)}

    <section class="drawer-cart-list">
      ${items.map(renderCartItem).join("")}
    </section>

    <section class="cart-summary">
      <div>
        <span>Total</span>
        <strong>${formatPrice(total)}</strong>
      </div>

      
    </section>

    ${crossSell}

    <button id="checkoutBtn" type="button" class="btn-primary drawer-checkout">
      Proceed to Checkout
    </button>
  `;
}

async function refreshAllCartViews(): Promise<void> {
  const loading = document.getElementById("cartLoading");
  const error = document.getElementById("cartError");

  if (loading) loading.hidden = false;
  if (error) error.hidden = true;

  try {
    await renderCart("cartContent");
    await renderCart("cartDrawerContent");
    await updateCartBadge();
  } catch (err) {
    console.error("Cart render failed:", err);

    if (error) {
      error.hidden = false;
      error.textContent = err instanceof Error ? err.message : "Failed to load cart.";
    }
  } finally {
    if (loading) loading.hidden = true;
  }
}

function updateItemQuantity(index: number, nextQuantity: number): void {
  const items = getCart();
  const item = items[index];

  if (!item) return;

  const maxStock = item.selectedVariant?.stock ?? 99;

  if (nextQuantity > maxStock) {
    alert("We don't have more items in this size.");
    return;
  }

  if (nextQuantity <= 0) {
    items.splice(index, 1);
  } else {
    item.quantity = nextQuantity;
  }

  saveCart(items);
  void refreshAllCartViews();
}

function removeItem(index: number): void {
  const items = getCart();
  items.splice(index, 1);
  saveCart(items);
  void refreshAllCartViews();
}

function bindCartActions(): void {
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const decrease = target.closest(".cart-decrease") as HTMLElement | null;
    const increase = target.closest(".cart-increase") as HTMLElement | null;
    const remove = target.closest(".cart-remove") as HTMLElement | null;
    const checkout = target.closest("#checkoutBtn") as HTMLElement | null;

    if (decrease) {
      const index = Number(decrease.dataset.index);
      const item = getCart()[index];
      if (item) updateItemQuantity(index, item.quantity - 1);
      return;
    }

    if (increase) {
      const index = Number(increase.dataset.index);
      const item = getCart()[index];
      if (item) updateItemQuantity(index, item.quantity + 1);
      return;
    }

    if (remove) {
      const index = Number(remove.dataset.index);
      removeItem(index);
      return;
    }

    if (checkout) {
      alert("Checkout page is not ready yet.");
    }
  });
}

function setupCartDrawer(): void {
  const cartLinks = document.querySelectorAll("[data-cart-link], .cart-link");
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  const closeBtn = document.getElementById("closeCart");

function openCart(): void {
  drawer?.classList.remove("hidden");
  overlay?.classList.remove("hidden");
  document.body.classList.add("cart-open");

  requestAnimationFrame(() => {
    drawer?.classList.add("open");
  });

  void renderCart("cartDrawerContent");
}

function closeCart(): void {
  drawer?.classList.remove("open");
  document.body.classList.remove("cart-open");

  setTimeout(() => {
    drawer?.classList.add("hidden");
    overlay?.classList.add("hidden");
  }, 250);
}

  cartLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openCart();
    });
  });

  closeBtn?.addEventListener("click", closeCart);
  overlay?.addEventListener("click", closeCart);
}

async function initCart(): Promise<void> {
  bindCartActions();
  setupCartDrawer();
  await refreshAllCartViews();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initCart();
  });
} else {
  void initCart();
}