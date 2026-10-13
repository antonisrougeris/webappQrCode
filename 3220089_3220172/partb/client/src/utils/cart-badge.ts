/* Header cart quantity badge (also works for guest sessions). */
import "./cart-badge.css";
import { getCart } from "../services/cart";
import { waitForAuthReady } from "../services/auth";
import { firebaseAuth } from "../services/firebase";

type CartCountData = {
  totalItems?: number;
  items?: Array<{ quantity?: number; isFreeReward?: boolean }>;
};

let initialized = false;
let revision = 0;

export function getCartCount(cart: CartCountData): number {
  // The free NFC keychain is a separate promotional reward and must not
  // increase the customer's paid product quantity.
  if (Array.isArray(cart.items)) {
    return cart.items.reduce((sum, item) => {
      if (item.isFreeReward) return sum;
      const quantity = Number(item.quantity);
      return sum + (Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0);
    }, 0);
  }

  const count = Number(cart.totalItems);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function cartLinks(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>(".site-header .cart-link");
}

function ensureBadge(link: HTMLElement): HTMLElement {
  let badge = link.querySelector<HTMLElement>(".header__cart-count");
  if (badge) return badge;

  badge = document.createElement("div");
  badge.className = "header__cart-count";
  badge.hidden = true;
  badge.setAttribute("aria-hidden", "true");
  const bubble = document.createElement("span");
  bubble.className = "count-bubble";
  badge.appendChild(bubble);
  link.appendChild(badge);
  return badge;
}

function renderCount(count: number): void {
  const lang = document.documentElement.lang.toLowerCase().startsWith("el") ? "el" : "en";
  const itemWord = lang === "el"
    ? (count === 1 ? "προϊόν" : "προϊόντα")
    : (count === 1 ? "item" : "items");

  for (const link of cartLinks()) {
    const badge = ensureBadge(link);
    const bubble = badge.querySelector<HTMLElement>(".count-bubble");
    badge.hidden = count === 0;
    if (bubble) bubble.textContent = String(count);
    link.setAttribute("aria-label", lang === "el"
      ? `Καλάθι, ${count} ${itemWord}`
      : `Cart, ${count} ${itemWord}`);
  }
}

/** Display the authoritative cart response right after cart changes. */
export function updateCartBadgeFromCart(cart: CartCountData): void {
  revision += 1;
  renderCount(getCartCount(cart));
}

/**
 * Read the current server cart on navigation / refresh. A slower fetch must
 * never overwrite an add/remove/update that finished in the meantime.
 */
export async function updateCartBadge(): Promise<void> {
  initCartBadge();
  const requestRevision = revision;
  try {
    await waitForAuthReady();
    const cart = await getCart();
    if (requestRevision !== revision) return;
    updateCartBadgeFromCart(cart);
  } catch (error) {
    if (requestRevision !== revision) return;
    console.error("Failed to refresh cart count:", error);
    revision += 1;
    renderCount(0);
  }
}

/** Install once; all page templates with a header benefit automatically. */
export function initCartBadge(): void {
  // The module may be imported by both the page and the shared cart drawer.
  for (const link of cartLinks()) ensureBadge(link);
  if (initialized) return;
  initialized = true;

  document.addEventListener("cart:change", (event: Event) => {
    const cart = (event as CustomEvent<{ cart?: CartCountData }>).detail?.cart;
    if (cart) updateCartBadgeFromCart(cart);
    else void updateCartBadge();
  });
  document.addEventListener("cart:refresh", () => { void updateCartBadge(); });
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) void updateCartBadge();
  });
  firebaseAuth.onAuthStateChanged(() => { void updateCartBadge(); });
}
