import { isLoggedIn } from "../../services/auth";
import { db } from "../../services/firebase";
import { addDoc, collection } from "firebase/firestore";

const CART_KEY = "skanare_cart";

if (!isLoggedIn()) {
  alert("Login required");
  window.location.href = "/src/pages/login/login.html";
}

function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}

function formatPrice(n: number) {
  return n.toFixed(2) + " €";
}

function calculateShipping(subtotal: number, delivery: string) {
  if (subtotal >= 50) {
    return 0; // ✅ FREE SHIPPING
  }

  if (delivery === "boxnow") {
    return 2.0; // πιο φθηνό
  }

  return 3.5; // home delivery
}

let discount = 0;

function render() {
  const items = getCart();

  const delivery =
    (
      document.querySelector(
        "input[name='delivery']:checked"
      ) as HTMLInputElement
    )?.value || "home";

  let subtotal = 0;

  const container = document.getElementById("checkoutItems")!;

  container.innerHTML = items
    .map((item: any) => {
      const itemTotal = item.priceEUR * item.quantity;
      subtotal += itemTotal;

      return `
      <div class="checkout-item">

        <div class="checkout-item__image-wrapper">

        <img src="${item.image || "/assets/img/logo_Image.png"}" />
        <span class="checkout-item__badge">${item.quantity}</span>
        </div>

        <div class="checkout-item__info">
          <p>${item.title}</p>
          <small>Size: ${item.selectedVariant?.size || "-"}</small>
          <small>${item.qrDestination || ""}</small>
        </div>

        <strong>${formatPrice(itemTotal)}</strong>
      </div>
    `;
    })
    .join("");

  // ✅ discount apply
  const discountedSubtotal = subtotal * (1 - discount / 100);

  const shipping = calculateShipping(discountedSubtotal, delivery);
  const total = discountedSubtotal + shipping;

  document.getElementById("subtotal")!.textContent =
    formatPrice(discountedSubtotal);

  document.getElementById("shipping")!.textContent =
    shipping === 0 ? "Free" : formatPrice(shipping);

  document.getElementById("total")!.textContent = formatPrice(total);

  // ✅ free shipping message
  const msg = document.getElementById("freeShippingMsg")!;

  if (discountedSubtotal < 50) {
    msg.textContent = `Add ${(50 - discountedSubtotal).toFixed(
      2
    )}€ for FREE shipping`;
  } else {
    msg.textContent = "You unlocked FREE shipping 🎉";
  }
}

render();

document.getElementById("applyDiscount")?.addEventListener("click", () => {
  const code = (document.getElementById("discountInput") as HTMLInputElement)
    .value;

  if (code === "SKANARE10") {
    discount = 10;
    alert("10% discount applied ✅");
  } else {
    discount = 0;
    alert("Invalid code");
  }

  render();
});

document.getElementById("openLockerMap")?.addEventListener("click", () => {
  window.open("https://boxnow.gr/en/locker-finder", "_blank");
});

// ✅ submit
document
  .getElementById("checkoutForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = new FormData(e.target as HTMLFormElement);

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
      cart: getCart(),
      total: document.getElementById("total")?.textContent,
      createdAt: new Date(),
    };

    // ✅ save order
    await addDoc(collection(db, "orders"), order);

    // ✅ CLEAR CART
    localStorage.removeItem(CART_KEY);

    // ✅ Viva redirect (real flow later via backend)
    window.location.href = "https://demo.vivapayments.com/web/checkout";
  });
