/* 3220089_3220172  2025 */
// cart-badge.ts - Utility for updating cart badge in navigation
import { getCart } from "../services/api";
import { isLoggedIn } from "../services/auth";

/**
 * Updates the cart badge in the navigation with the current cart item count
 */
export async function updateCartBadge(): Promise<void> {
  try {
    const cartLink = document.querySelector("[data-cart-link]");
    if (!cartLink) return;

    if (!isLoggedIn()) {
      // If not logged in, just show "Cart"
      cartLink.textContent = "Cart";
      return;
    }

    // Fetch cart from server API
    const cartData = await getCart();
    const totalItems = cartData.length || 0;

    if (totalItems > 0) {
      cartLink.textContent = `Cart (${totalItems})`;
    } else {
      cartLink.textContent = "Cart";
    }
  } catch (error) {
    console.error("Failed to update cart badge:", error);
    const cartLink = document.querySelector("[data-cart-link]");
    if (cartLink) {
      cartLink.textContent = "Cart";
    }
  }
}
