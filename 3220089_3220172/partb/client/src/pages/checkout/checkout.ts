/* 3220089_3220172 */

import { firebaseAuth } from "../../services/firebase";
import { getCart, type CartItem } from "../../services/cart";
import { checkout } from "../../services/checkout";
const CHECKOUT_DRAFT_KEY = "skanare_checkout_draft";

function saveCheckoutDraft(formEl: HTMLFormElement): void {
  const form = new FormData(formEl);
  const draft: Record<string, string> = {};

  form.forEach((value, key) => {
    draft[key] = String(value);
  });

  localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
}

function restoreCheckoutDraft(): void {
  const raw = localStorage.getItem(CHECKOUT_DRAFT_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw) as Record<string, string>;

    Object.entries(draft).forEach(([key, value]) => {
      const el = document.querySelector<HTMLInputElement>(
        `[name="${CSS.escape(key)}"]`
      );

      if (!el) return;

      if (el.type === "radio") {
        const radio = document.querySelector<HTMLInputElement>(
          `input[name="${CSS.escape(key)}"][value="${CSS.escape(value)}"]`
        );
        if (radio) radio.checked = true;
        return;
      }

      el.value = value;
    });
  } catch {
    localStorage.removeItem(CHECKOUT_DRAFT_KEY);
  }
}

let discount = 0;

function formatPrice(n: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(n || 0);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCartItemTitle(item: CartItem): string {
  return item.title || "Product";
}

function getCartItemImage(item: CartItem): string {
  return item.image || "/assets/img/logo_Image.png";
}

function getCartItemUnitPrice(item: CartItem): number {
  return typeof item.price === "number" ? item.price : 0;
}

function getCartItemVariant(item: CartItem) {
  return item.variant || null;
}

function getCartItemQr(item: CartItem): string {
  return item.qrDestination || "";
}

function calculateShipping(subtotal: number, delivery: string): number {
  if (subtotal >= 50) return 0;
  if (delivery === "boxnow") return 2.0;
  return 3.5;
}

function setPayButtonState(): void {
  const button = document.querySelector<HTMLButtonElement>(
    "#checkoutForm button[type='submit']"
  );

  if (!button) return;

  const user = firebaseAuth.currentUser;

  if (!user) {
    button.textContent = "Sign in to pay with viva.com";
  } else {
    button.textContent = "Pay with viva.com";
  }
}

async function render(): Promise<void> {
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
      const title = escapeHtml(getCartItemTitle(item));
      const image = escapeHtml(getCartItemImage(item));
      const qr = escapeHtml(getCartItemQr(item));
      const quantity = Number(item.quantity || 0);

      return `
        <div class="checkout-item">
          <div class="checkout-item__image-wrapper">
            <img src="${image}" alt="${title}" />
            <span class="checkout-item__badge">${quantity}</span>
          </div>

          <div class="checkout-item__info">
            <p>${title}</p>
            <small>Size: ${escapeHtml(variant?.size || "-")}</small>
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

function getRequiredFormString(
  form: FormData,
  field: string,
  label: string
): string {
  const value = String(form.get(field) || "").trim();

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

document.addEventListener("DOMContentLoaded", () => {
  restoreCheckoutDraft();
  void render();

  firebaseAuth.onAuthStateChanged(() => {
    setPayButtonState();
  });

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

      const user = firebaseAuth.currentUser;

      if (!user) {
  saveCheckoutDraft(e.target as HTMLFormElement);

  alert("Please sign in or create an account before checkout.");

  window.location.href =
    "/src/pages/login/login.html?redirect=" +
    encodeURIComponent("/src/pages/checkout/checkout.html");

  return;
}

      const submitButton = document.querySelector<HTMLButtonElement>(
        "#checkoutForm button[type='submit']"
      );

      try {
        submitButton && (submitButton.disabled = true);
        submitButton && (submitButton.textContent = "Preparing payment...");

        const form = new FormData(e.target as HTMLFormElement);
        const cart = await getCart();
        const items: CartItem[] = cart?.items || [];

        if (items.length === 0) {
          throw new Error("Your cart is empty.");
        }

        const firstName = getRequiredFormString(
          form,
          "firstName",
          "First name"
        );
        const lastName = getRequiredFormString(form, "lastName", "Last name");
        const email =
          String(form.get("email") || "").trim() || user.email || "";
        const phone = String(form.get("phone") || "").trim();
        const country = String(form.get("country") || "Greece").trim();
        const city = getRequiredFormString(form, "city", "City");
        const postalCode = String(form.get("postalCode") || "").trim();
        const addressLine1 = getRequiredFormString(form, "address", "Address");

        if (!email) {
          throw new Error("Email is required.");
        }

        const delivery = String(form.get("delivery") || "home") as
          | "home"
          | "boxnow";

        const result = await checkout({
          customer: {
            firstName,
            lastName,
            email,
            phone,
          },
          shippingAddress: {
            firstName,
            lastName,
            email,
            phone,
            country,
            city,
            postalCode,
            addressLine1,
            addressLine2: "",
          },
          delivery,
          locker: String(form.get("locker") || "").trim(),
          notes: "",
        });

        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }

        alert("Order created, but payment URL was not returned.");
      } catch (error) {
        console.error("Checkout failed:", error);
        alert(error instanceof Error ? error.message : "Checkout failed.");
      } finally {
        submitButton && (submitButton.disabled = false);
        setPayButtonState();
      }
    });
});
