import { updateCartBadge } from "../../utils/cart-badge";
import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";

initNav();
initMobileMenu();
updateCartBadge();

const CART_KEY = "skanare_cart";

interface CartItem {
  title: string;
  priceEUR: number;
  quantity: number;
}

// ✅ get cart
function getCart(): CartItem[] {
  const raw = localStorage.getItem(CART_KEY);

  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ✅ format price
function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

// ✅ render checkout items
function renderCheckout() {
  const container = document.getElementById("checkoutItems");
  const totalEl = document.getElementById("checkoutTotal");

  if (!container || !totalEl) return;

  const cart = getCart();

  let total = 0;

  container.innerHTML = cart
    .map((item) => {
      const itemTotal = item.priceEUR * item.quantity;
      total += itemTotal;

      return `
        <div class="checkout-item">
          <span>${item.title} ×${item.quantity}</span>
          <strong>${formatPrice(itemTotal)}</strong>
        </div>
      `;
    })
    .join("");

  totalEl.textContent = formatPrice(total);
}

renderCheckout();

// ✅ place order
document.getElementById("placeOrderBtn")?.addEventListener("click", () => {
  // ✅ clear cart
  localStorage.removeItem(CART_KEY);

  alert("Order placed successfully ✅");

  // ✅ redirect home
  window.location.href = "/index.html";
});
