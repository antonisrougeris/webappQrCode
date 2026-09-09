/* 3220089_3220172 */

import { firebaseAuth } from "../../services/firebase";
import { getCart, type CartItem } from "../../services/cart";
import { checkout } from "../../services/checkout";
import { apiRequest, getMe } from "../../services/api";
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
const CHECKOUT_DRAFT_KEY = "skanare_checkout_draft";
import { setFlashToast } from "../../utils/toast.ts";


const BYPASS_BOXNOW_LOCKER = true;
const TEST_BOXNOW_LOCKER_ID = "TEST_LOCKER";

function saveCheckoutDraft(formEl: HTMLFormElement): void {
  const form = new FormData(formEl)
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

function saveCheckoutDraftFromPage(): void {
  const form = document.getElementById("checkoutForm") as HTMLFormElement | null;
  if (form) saveCheckoutDraft(form);
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

function calculateShipping(
  subtotal: number
): number {
  if (subtotal >= 50) {
    return 0;
  }

  return 2.0;
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
const shipping =
  calculateShipping(
    discountedSubtotal
  );
    const total = discountedSubtotal + shipping;

  document.getElementById("subtotal")!.textContent =
    formatPrice(discountedSubtotal);

  document.getElementById("shipping")!.textContent =
    shipping === 0 ? "Free" : formatPrice(shipping);

  document.getElementById("total")!.textContent = formatPrice(total);

  const msg =
  document.getElementById(
    "freeShippingMsg"
  );

if (msg) {

  msg.classList.remove(
    "is-unlocked"
  );

  if (discountedSubtotal < 50) {

    const amountLeft =
      50 - discountedSubtotal;

    msg.textContent =
      `Add ${formatPrice(
        amountLeft
      )} for FREE shipping`;

  } else if (
    discountedSubtotal < 80
  ) {

    const amountLeft =
      80 - discountedSubtotal;

    msg.textContent =
      `Add ${formatPrice(
        amountLeft
      )} more to get a FREE sticker set`;

  } else {

    msg.textContent =
      "FREE Skanare sticker set added 🎁";

    msg.classList.add(
      "is-unlocked"
    );
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




const PHONE_RULES: Record<string, { length: number; prefix?: RegExp }> = {
  GR: { length: 10, prefix: /^69/ },
  CY: { length: 8, prefix: /^9/ },
  GB: { length: 10, prefix: /^7/ },
  DE: { length: 10 },
  FR: { length: 9, prefix: /^[67]/ },
  IT: { length: 9, prefix: /^3/ },
  ES: { length: 9, prefix: /^[6789]/ },
  US: { length: 10 },
  CA: { length: 10 },
  AU: { length: 9, prefix: /^4/ },
  NL: { length: 9, prefix: /^6/ },
  BE: { length: 9, prefix: /^4/ },
  AT: { length: 10 },
  PT: { length: 9, prefix: /^9/ },
  IE: { length: 9, prefix: /^8/ },
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}



function keepDigitsOnly(input: HTMLInputElement): void {
  input.value = input.value.replace(/\D/g, "");
}

function getPhoneValidationMessage(
  phoneNumber: string,
  phoneCountryCode: string
): string {
  if (!phoneNumber) return "Phone number is required.";
  if (!/^\d+$/.test(phoneNumber)) return "Phone number must contain digits only.";

  const phoneRule = PHONE_RULES[phoneCountryCode];
  if (!phoneRule) return "Select a valid phone country.";

  const prefixMessage = phoneRule.prefix
    ? phoneCountryCode === "GR"
      ? "Greek phone numbers must start with 69."
      : "Phone number does not have the correct prefix for the selected country."
    : "";

  if (phoneNumber.length !== phoneRule.length) {
    return phoneCountryCode === "GR"
      ? "Greek phone numbers must start with 69 and contain exactly 10 digits."
      : `Phone number must contain exactly ${phoneRule.length} digits for the selected country.`;
  }

  if (phoneRule.prefix && !phoneRule.prefix.test(phoneNumber)) {
    return prefixMessage;
  }

  const parsedPhone = parsePhoneNumberFromString(
    phoneNumber,
    phoneCountryCode as CountryCode
  );
  if (!parsedPhone?.isValid()) {
    return "Enter a valid phone number for the selected country.";
  }

  return "";
}

function updatePhoneValidity(): void {
  const phoneInput = document.querySelector<HTMLInputElement>(
    "input[name='phoneNumber']"
  );
  const countrySelect = document.querySelector<HTMLSelectElement>(
    "select[name='phoneCountryCode']"
  );
  if (!phoneInput || !countrySelect) return;

  phoneInput.setCustomValidity(
    getPhoneValidationMessage(phoneInput.value.trim(), countrySelect.value)
  );

  const message = document.getElementById("phoneValidationMessage");
  const validationMessage = phoneInput.validationMessage;
  if (message) {
    message.textContent = validationMessage;
    message.hidden = !validationMessage;
  }
}

function readAndValidateCheckoutForm(
  form: FormData,
  fallbackEmail = ""
) {
  const firstName =
    getRequiredFormString(
      form,
      "firstName",
      "First name"
    );

  const lastName =
    getRequiredFormString(
      form,
      "lastName",
      "Last name"
    );

  const email =
    String(
      form.get("email") || ""
    ).trim() ||
    fallbackEmail;

  const phoneCountryCode =
    getRequiredFormString(
      form,
      "phoneCountryCode",
      "Phone country"
    );

  const phoneNumber =
    getRequiredFormString(
      form,
      "phoneNumber",
      "Phone"
    );


  const phoneValidationMessage =
    getPhoneValidationMessage(
      phoneNumber,
      phoneCountryCode
    );

  if (phoneValidationMessage) {
    throw new Error(
      phoneValidationMessage
    );
  }


  if (!isValidEmail(email)) {
    throw new Error(
      "Enter a valid email address."
    );
  }


  const parsedPhone =
    parsePhoneNumberFromString(
      phoneNumber,
      phoneCountryCode as CountryCode
    );


  if (!parsedPhone) {
    throw new Error(
      "Enter a valid phone number."
    );
  }


  return {
    firstName,
    lastName,
    email,

    phone:
      parsedPhone.number,

    phoneCountryCode,
  };
}

function restoreAfterAuth(): void {
  const flag = localStorage.getItem("skanare_returning_from_auth");

  if (flag === "1") {
    restoreCheckoutDraft();
    localStorage.removeItem("skanare_returning_from_auth");
  }
}




document.addEventListener("DOMContentLoaded", () => {

    if (BYPASS_BOXNOW_LOCKER) {
    const lockerInput =
      document.getElementById("lockerInput") as HTMLInputElement | null;

    if (lockerInput) {
      lockerInput.value = TEST_BOXNOW_LOCKER_ID;
    }

    const lockerMessage =
      document.getElementById("lockerValidationMessage");

    if (lockerMessage) {
      lockerMessage.textContent = "";
      lockerMessage.hidden = true;
    }

    console.log("BOX NOW bypass enabled:", TEST_BOXNOW_LOCKER_ID);
  }
  restoreAfterAuth();
  restoreCheckoutDraft();

  const editCartButton =
  document.getElementById(
    "checkoutEditCart"
  ) as HTMLButtonElement | null;

editCartButton?.addEventListener(
  "click",
  () => {
    const cartButton =
      document.querySelector<HTMLElement>(
        "[data-cart-link], .cart-link"
      );

    cartButton?.click();
  }
);

  const checkoutForm = document.getElementById("checkoutForm") as HTMLFormElement | null;
  checkoutForm?.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (target?.name === "phoneNumber" || target?.name === "postalCode") {
      keepDigitsOnly(target as HTMLInputElement);
    }
    updatePhoneValidity();
    saveCheckoutDraftFromPage();
  });
  checkoutForm?.addEventListener("change", () => {
    updatePhoneValidity();
    saveCheckoutDraftFromPage();
  });
  updatePhoneValidity();

  firebaseAuth.onAuthStateChanged(() => {
    setPayButtonState();
    void render();
  });



  document.getElementById("applyDiscount")?.addEventListener("click", (e) => {
    e.preventDefault();

    const code = (
      document.getElementById("discountInput") as HTMLInputElement | null
    )?.value?.trim();

    if (code === "SKANARE10") {
      discount = 10;
      setFlashToast("10% discount applied ✅");
    } else {
      discount = 0;
      setFlashToast("Invalid code");
    }

    void render();
  });

  document
    .getElementById("checkoutForm")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formEl = e.target as HTMLFormElement;
      if (!formEl.reportValidity()) return;

      let formValues;
      try {
        formValues = readAndValidateCheckoutForm(new FormData(formEl));
      } catch (error) {
        setFlashToast(error instanceof Error ? error.message : "Invalid checkout details.");
        return;
      }

      const user = firebaseAuth.currentUser;

      
if (!user) {
  saveCheckoutDraft(e.target as HTMLFormElement);

  const email = formValues.email;
  const firstName = formValues.firstName;
  const lastName = formValues.lastName;

  if (!email) {
    setFlashToast("Email is required");
    return;
  }

  const res = await apiRequest<{ exists: boolean }>("/auth/check-email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

const payload = new URLSearchParams({
  redirect: "/src/pages/checkout/checkout.html",
  email,
  firstName,
  lastName,
});

  if (res.exists) {
    window.location.href = `/src/pages/login/login.html?${payload}`;
  } else {
    window.location.href = `/src/pages/register/register.html?${payload}`;
  }

  return;
}

const me = await getMe();

if (!me?.emailVerified) {
  saveCheckoutDraft(e.target as HTMLFormElement);

  setFlashToast("Please verify your email before checkout.");

  window.location.href =
    "/src/pages/verify-email/verify-email.html?redirect=" +
    encodeURIComponent("/src/pages/checkout/checkout.html");
  return;
}

      const submitButton = document.querySelector<HTMLButtonElement>(
        "#checkoutForm button[type='submit']"
      );

      try {
        submitButton && (submitButton.disabled = true);
        submitButton && (submitButton.textContent = "Preparing payment...");

        const form = new FormData(formEl);
        const cart = await getCart();
        const items: CartItem[] = cart?.items || [];

        if (items.length === 0) {
          throw new Error("Your cart is empty.");
        }

        const {
  firstName,
  lastName,
  email,
  phone,
  phoneCountryCode,
} =
  readAndValidateCheckoutForm(
    form,
    user.email || ""
  );

const delivery = "boxnow" as const;

let locker =
  String(
    form.get("locker") || ""
  ).trim();

if (BYPASS_BOXNOW_LOCKER) {
  locker = TEST_BOXNOW_LOCKER_ID;
}

const lockerValidationMessage =
  document.getElementById("lockerValidationMessage");

if (!locker) {
  if (lockerValidationMessage) {
    lockerValidationMessage.textContent =
      "Please select a BOX NOW locker.";
    lockerValidationMessage.hidden = false;
  }

  return;
}

if (lockerValidationMessage) {
  lockerValidationMessage.textContent = "";
  lockerValidationMessage.hidden = true;
}
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
    country: "Greece",
    city: "",
    postalCode: "",
    addressLine1: "",
    addressLine2: "",
  },

  delivery,
  locker,
  phoneCountryCode,
  notes: "",
});

        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }

        setFlashToast("Order created, but payment URL was not returned.");
      } catch (error) {
        console.error("Checkout failed:", error);
        setFlashToast(error instanceof Error ? error.message : "Checkout failed.");
      } finally {
        submitButton && (submitButton.disabled = false);
        setPayButtonState();
      }
    });
});
