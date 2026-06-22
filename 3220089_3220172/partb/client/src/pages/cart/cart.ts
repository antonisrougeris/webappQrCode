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
const API_BASE =
  import.meta.env?.VITE_API_BASE_URL || "https://cldrq5-4000.csb.app/api";

const FREE_SHIPPING_TARGET = 50;
const FREE_STICKERS_TARGET = 80;

function showToast(message: string): void {
  let stack = document.getElementById("toastStack");

  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;

  stack.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (stack && stack.children.length === 0) stack.remove();
  }, 3000);
}

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
  let percent = 0;

  if (total < FREE_SHIPPING_TARGET) {
    percent = (total / FREE_SHIPPING_TARGET) * 50;
  } else if (total < FREE_STICKERS_TARGET) {
    percent =
      50 +
      ((total - FREE_SHIPPING_TARGET) /
        (FREE_STICKERS_TARGET - FREE_SHIPPING_TARGET)) *
        50;
  } else {
    percent = 100;
  }

  percent = Math.min(percent, 100);

  const isShippingDone = total >= FREE_SHIPPING_TARGET;
  const isStickerDone = total >= FREE_STICKERS_TARGET;

  let message = "";

  if (total < FREE_SHIPPING_TARGET) {
    message = `Only ${formatPrice(
      FREE_SHIPPING_TARGET - total
    )} away from free shipping`;
  } else if (total < FREE_STICKERS_TARGET) {
    message = `Add ${formatPrice(
      FREE_STICKERS_TARGET - total
    )} more and get a Sticker Set for free`;
  } else {
    message = "You unlocked all rewards";
  }

  return `
    <div class="cart-progress-new">

      <p>${message}</p>

      <div class="progress-bar">

        <div class="progress-fill" style="width:${percent}%"></div>

        <!-- SHIPPING -->
        <div class="progress-step step-1 ${isShippingDone ? "done" : ""}">
          <div class="icon">

    <svg viewBox="0 0 512 512" width="18" height="18">
      <path d="M386.689 304.403c-35.587 0-64.538 28.951-64.538 64.538s28.951 64.538 64.538 64.538c35.593 0 64.538-28.951 64.538-64.538s-28.951-64.538-64.538-64.538zm0 96.807c-17.796 0-32.269-14.473-32.269-32.269s14.473-32.269 32.269-32.269 32.269 14.473 32.269 32.269-14.473 32.269-32.269 32.269zm-220.504-96.807c-35.587 0-64.538 28.951-64.538 64.538s28.951 64.538 64.538 64.538 64.538-28.951 64.538-64.538-28.951-64.538-64.538-64.538zm0 96.807c-17.796 0-32.269-14.473-32.269-32.269s14.473-32.269 32.269-32.269 32.269 14.473 32.269 32.269-14.473 32.269-32.269 32.269zM430.15 119.675c-2.743-5.448-8.32-8.885-14.419-8.885h-84.975v32.269h75.025l43.934 87.384 28.838-14.5-48.403-96.268z"/>
      <path d="M216.202 353.345h122.084v32.269H216.202zm-98.421 0H61.849c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h55.933c8.912 0 16.134-7.223 16.134-16.134s-7.223-16.134-16.135-16.134zm390.831-98.636l-31.736-40.874c-3.049-3.937-7.755-6.239-12.741-6.239H346.891V94.655c0-8.912-7.223-16.134-16.134-16.134H61.849c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h252.773V223.73c0 8.912 7.223 16.134 16.134 16.134h125.478l23.497 30.268v83.211h-44.639c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h60.773c8.912 0 16.134-7.223 16.135-16.134V264.605c0-3.582-1.194-7.067-3.388-9.896zm-391.906 16.888H42.487c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h74.218c8.912 0 16.134-7.223 16.134-16.134s-7.222-16.134-16.133-16.134zm37.109-63.463H16.134C7.223 208.134 0 215.357 0 224.269s7.223 16.134 16.134 16.134h137.681c8.912 0 16.134-7.223 16.134-16.134s-7.222-16.135-16.134-16.135zm26.353-63.462H42.487c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h137.681c8.912 0 16.134-7.223 16.134-16.134s-7.222-16.134-16.134-16.134z"/>

      </svg>
  </div>
      <span>
        <small>FREE</small>
        SHIPPING
      </span>
    </div>


    <div class="progress-step step-2 ${isStickerDone ? "done" : ""}">
    <div class="icon">
    <svg viewBox="0 0 22 22" width="18" height="18">
      <path d="M19.5 6.25h-1.065A2.709 2.709 0 0 0 18.75 5a2.747 2.747 0 0 0-4.876-1.739L12 5.752l-1.881-2.5A2.747 2.747 0 0 0 5.25 5a2.709 2.709 0 0 0 .315 1.25H4.5A2.253 2.253 0 0 0 2.25 8.5V12a.75.75 0 0 0 .75.75h.25V18A3.383 3.383 0 0 0 7 21.75h10A3.383 3.383 0 0 0 20.75 18v-5.25H21a.75.75 0 0 0 .75-.75V8.5a2.253 2.253 0 0 0-2.25-2.25zm.75 2.25v2.75h-7.5v-3.5h6.75a.751.751 0 0 1 .75.75zm-5.211-4.293A1.223 1.223 0 0 1 16 3.75a1.25 1.25 0 0 1 0 2.5h-2.5l1.539-2.043zM6.75 5A1.252 1.252 0 0 1 8 3.75a1.213 1.213 0 0 1 .948.441L10.5 6.25H8A1.252 1.252 0 0 1 6.75 5zm-3 3.5a.751.751 0 0 1 .75-.75h6.75v3.5h-7.5zm1 9.5v-5.25h6.5v7.5H7c-1.577 0-2.25-.673-2.25-2.25zm14.5 0c0 1.577-.673 2.25-2.25 2.25h-4.25v-7.5h6.5z"/>
    </svg>
  </div>
      <span>
        <small>FREE</small>
        STICKER SET
      </span>
    </div>

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
      <img src="${item.image || "/assets/img/logo_Image.png"}" alt="${
    item.title
  }" />

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
        
<button type="button" class="cart-remove" data-index="${index}">
<svg viewBox="0 0 24 24" width="18" height="18">
  <path d="M11.5 8.25a.75.75 0 0 1 .75.75v4.25a.75.75 0 0 1-1.5 0v-4.25a.75.75 0 0 1 .75-.75Z"/>
  <path d="M9.25 9a.75.75 0 0 0-1.5 0v4.25a.75.75 0 0 0 1.5 0v-4.25Z"/>
  <path fill-rule="evenodd" d="M7.25 5.25a2.75 2.75 0 0 1 5.5 0h3a.75.75 0 0 1 0 1.5h-.75v5.45c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311c-.642.327-1.482.327-3.162.327h-.4c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311c-.327-.642-.327-1.482-.327-3.162v-5.45h-.75a.75.75 0 0 1 0-1.5h3Zm1.5 0a1.25 1.25 0 1 1 2.5 0h-2.5Zm-2.25 1.5h7v5.45c0 .865-.001 1.423-.036 1.848-.033.408-.09.559-.128.633a1.5 1.5 0 0 1-.655.655c-.074.038-.225.095-.633.128-.425.035-.983.036-1.848.036h-.4c-.865 0-1.423-.001-1.848-.036-.408-.033-.559-.09-.633-.128a1.5 1.5 0 0 1-.656-.655c-.037-.074-.094-.225-.127-.633-.035-.425-.036-.983-.036-1.848v-5.45Z"/>
</svg>
</button>

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
      .filter(
        (product) => product.active !== false && !currentIds.has(product.id)
      )
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);

    if (suggestions.length === 0) return "";

    return `
    <h3 class="cross-header">
    Others also bought:
    <div class="cross-arrows">
      <button type="button" class="cross-prev">‹</button>
      <button type="button" class="cross-next">›</button>
    </div>
  </h3>
    
        <div class="cart-cross-sell-row">
          ${suggestions
            .map((product) => {
              const image = getProductImage(product);

              return `
              <article class="cart-cross-card" data-id="${product.id}">
              <img src="${image}" />
            
              <h4>${product.title}</h4>
              <p>${formatPrice(product.priceEUR)}</p>
            
              <button class="cross-add" data-id="${product.id}">
                Add
              </button>
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
  container.classList.remove("cart-empty-state");

  if (items.length === 0) {
    container.classList.add("cart-empty-state");

    container.innerHTML = `
      <section class="cart-empty">
        <h2>Your cart is empty</h2>  
        <a class="btn-primary cart-empty-btn" href="/src/pages/products/products.html">
          SHOP PRODUCTS
        </a>
      </section>
    `;

    document.getElementById("checkoutBtn")?.addEventListener("click", () => {
      window.location.href = "/src/pages/checkout/checkout.html";
    });

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

    

    <div class="checkout-container">
    <button id="checkoutBtn" class="btn-primary drawer-checkout">
      Proceed to Checkout
    </button>
  </div>
  

  `;
}

async function refreshAllCartViews(): Promise<void> {
  const loading = document.getElementById("cartLoading");
  const error = document.getElementById("cartError");

  if (loading) loading.hidden = false;
  if (error) error.hidden = true;

  try {
    await renderCart("cartDrawerContent");
    await updateCartBadge();
  } catch (err) {
    console.error("Cart render failed:", err);

    if (error) {
      error.hidden = false;
      error.textContent =
        err instanceof Error ? err.message : "Failed to load cart.";
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
    showToast("We don't have more items in this size.");
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

    const card = target.closest(".cart-cross-card");

    if (card && !target.closest(".cross-add")) {
      const id = (card as HTMLElement).dataset.id;

      window.location.href = `/src/pages/product-details/product-details.html?id=${encodeURIComponent(
        id!
      )}`;

      return;
    }

    const addBtn = target.closest(".cross-add");

    if (addBtn) {
      const id = (addBtn as HTMLElement).dataset.id;

      getAllProducts().then((products) => {
        const product = products.find((p) => p.id === id);
        if (!product) return;

        const cart = getCart();

        cart.push({
          productId: product.id,
          title: product.title,
          priceEUR: product.priceEUR,
          image: product.image || product.images?.[0],
          quantity: 1,
        });

        saveCart(cart);
        refreshAllCartViews();
      });

      return; // ✅ ΚΑΤΑΠΙΝΕΙ το click (ΔΕΝ κάνει redirect)
    }

    const nextBtn = target.closest(".cross-next");
    const prevBtn = target.closest(".cross-prev");

    if (nextBtn) {
      const row = document.querySelector(".cart-cross-sell-row");
      row?.scrollBy({ left: 260, behavior: "smooth" });
      return;
    }

    if (prevBtn) {
      const row = document.querySelector(".cart-cross-sell-row");
      row?.scrollBy({ left: -260, behavior: "smooth" });
      return;
    }

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
      window.location.href = "/src/pages/checkout/checkout.html";
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
