import { addDoc, collection, setDoc, doc } from "firebase/firestore";
import { db, firebaseAuth } from "../../services/firebase";
import { getCart, type CartItem } from "../../services/cart";

let discount = 0;

function formatPrice(n: number) {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(n || 0);
}

function getCartItemTitle(item: CartItem): string {
  if (item.title) return item.title;
  if (item.product?.title) return item.product.title;
  return "Product";
}

function getCartItemImage(item: CartItem): string {
  if (item.image) return item.image;
  if (item.product?.image) return item.product.image;
  if (item.product?.images?.[0]) return item.product.images[0];
  return "/assets/img/logo_Image.png";
}

function getCartItemUnitPrice(item: CartItem): number {
  if (typeof item.unitPrice === "number") return item.unitPrice;
  if (typeof item.price === "number") return item.price;
  if (typeof item.priceEUR === "number") return item.priceEUR;
  if (typeof item.product?.price === "number") return item.product.price;
  if (typeof item.product?.priceEUR === "number") return item.product.priceEUR;
  return 0;
}

function getCartItemVariant(item: CartItem) {
  return item.variant || item.selectedVariant || null;
}

function getCartItemQr(item: CartItem): string {
  return item.qrDestination || item.qrCodeUrl || "";
}

function calculateShipping(subtotal: number, delivery: string) {
  if (subtotal >= 50) return 0;
  if (delivery === "boxnow") return 2.0;
  return 3.5;
}

async function createQRsForOrder(cartItems: CartItem[]) {
  const user = firebaseAuth.currentUser;

  for (const item of cartItems) {
    const id = Math.random().toString(36).substring(2, 10);

    await setDoc(doc(db, "qrCodes", id), {
      userId: user?.uid || null,
      productTitle: getCartItemTitle(item),
      targetUrl: getCartItemQr(item) || "https://skanare.com",
      scans: 0,
      createdAt: new Date(),
    });
  }
}

async function render() {
  const cart = await getCart();
  const items: CartItem[] = cart?.items || [];

  const delivery =
    (
      document.querySelector(
        "input[name='delivery']:checked"
      ) as HTMLInputElement | null
    )?.value || "home";

  const container = document.getElementById("checkoutItems");
  if (!container) return;

  let subtotal = 0;

  if (items.length === 0) {
    container.innerHTML = `<p>Your cart is empty.</p>`;
    document.getElementById("subtotal")!.textContent = formatPrice(0);
    document.getElementById("shipping")!.textContent = formatPrice(0);
    document.getElementById("total")!.textContent = formatPrice(0);
    const msg = document.getElementById("freeShippingMsg");
    if (msg) msg.textContent = "";
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const unitPrice = getCartItemUnitPrice(item);
      const itemTotal = unitPrice * Number(item.quantity || 0);
      subtotal += itemTotal;

      const variant = getCartItemVariant(item);
      const title = getCartItemTitle(item);
      const image = getCartItemImage(item);
      const qr = getCartItemQr(item);

      return `
        <div class="checkout-item">
          <div class="checkout-item__image-wrapper">
            <img src="${image}" alt="${title}" />
            <span class="checkout-item__badge">${item.quantity}</span>
          </div>

          <div class="checkout-item__info">
            <p>${title}</p>
            <small>Size: ${variant?.size || "-"}</small>
            ${qr ? `<small>${qr}</small>` : ""}
          </div>

          <strong>${formatPrice(itemTotal)}</strong>
        </div>
      `;
    })
    .join("");

  const discountedSubtotal = subtotal * (1 - discount / 100);
  const shipping = calculateShipping(discountedSubtotal, delivery);
  const total = discountedSubtotal + shipping;

  document.getElementById("subtotal")!.textContent =
    formatPrice(discountedSubtotal);

  document.getElementById("shipping")!.textContent =
    shipping === 0 ? "Free" : formatPrice(shipping);

  document.getElementById("total")!.textContent = formatPrice(total);

  const msg = document.getElementById("freeShippingMsg");
  if (msg) {
    if (discountedSubtotal < 50) {
      msg.textContent = `Add ${(50 - discountedSubtotal).toFixed(
        2
      )}€ for FREE shipping`;
    } else {
      msg.textContent = "You unlocked FREE shipping 🎉";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void render();

  document
    .querySelectorAll<HTMLInputElement>("input[name='delivery']")
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        void render();
      });
    });

  document.getElementById("applyDiscount")?.addEventListener("click", (e) => {
    e.preventDefault();

    const code = (
      document.getElementById("discountInput") as HTMLInputElement | null
    )?.value?.trim();

    if (code === "SKANARE10") {
      discount = 10;
      alert("10% discount applied ✅");
    } else {
      discount = 0;
      alert("Invalid code");
    }

    void render();
  });

  document
    .getElementById("checkoutForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const form = new FormData(e.target as HTMLFormElement);
      const cart = await getCart();
      const items: CartItem[] = cart?.items || [];

      if (items.length === 0) {
        alert("Your cart is empty.");
        return;
      }

      const totalText =
        document.getElementById("total")?.textContent || formatPrice(0);

      const order = {
        user: {
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          phone: form.get("phone"),
        },
        address: {
          address: form.get("address"),
          city: form.get("city"),
          postalCode: form.get("postalCode"),
          country: form.get("country"),
        },
        delivery: form.get("delivery"),
        locker: form.get("locker"),
        cart: items,
        total: totalText,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "orders"), order);
      await createQRsForOrder(items);

      // εδώ μετά μπορείς να καθαρίσεις cart από backend/service αν έχεις clearCart()
      // π.χ. await clearCart();

      window.location.href = "https://demo.vivapayments.com/web/checkout";
    });
});
