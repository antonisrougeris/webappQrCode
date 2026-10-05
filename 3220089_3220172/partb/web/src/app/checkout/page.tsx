"use client";

import { useEffect, useMemo, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";
import { getCart, type CartItem } from "@/lib/cart";
import { checkout } from "@/lib/checkout";
import { getMe } from "@/lib/api";

const CHECKOUT_DRAFT_KEY = "skanare_checkout_draft";
const PREMIUM_GIFT_PRICE = 1.5;

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [delivery, setDelivery] = useState<"home" | "boxnow">("home");
  const [discount, setDiscount] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [status, setStatus] = useState("");
  const [payText, setPayText] = useState("Pay with viva.com");
  const [submitting, setSubmitting] = useState(false);
  const [giftTier, setGiftTier] = useState<"none" | "simple" | "premium">("none");
  const [personalNote, setPersonalNote] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);

  useEffect(() => {
    restoreDraft();
    void loadCart();

    const unsub = firebaseAuth.onAuthStateChanged((user) => {
      setPayText(user ? "Pay with viva.com" : "Sign in to pay with viva.com");
    });

    return () => unsub();
  }, []);

  async function loadCart() {
    const cart = await getCart();
    setItems(cart?.items || []);
    const nextTier =
      cart?.giftOptions?.tier === "simple" ||
      cart?.giftOptions?.tier === "premium"
        ? cart.giftOptions.tier
        : cart?.giftOptions?.giftBox
          ? "premium"
          : "none";
    setGiftTier(nextTier);
    setPersonalNote(cart?.giftOptions?.personalNote || "");
  }

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + getCartItemUnitPrice(item) * Number(item.quantity || 0);
    }, 0);
  }, [items]);

  const discountedSubtotal = subtotal * (1 - discount / 100);
  const shipping = calculateShipping(discountedSubtotal, delivery);
  const giftFee = giftTier === "premium" ? PREMIUM_GIFT_PRICE : 0;
  const total = discountedSubtotal + shipping + giftFee;

  function applyDiscount(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    if (discountCode.trim() === "SKANARE10") {
      setDiscount(10);
      setStatus("10% discount applied ✅");
    } else {
      setDiscount(0);
      setStatus("Invalid code");
    }
  }

  function saveDraft(formEl: HTMLFormElement) {
    const form = new FormData(formEl);
    const draft: Record<string, string> = {};

    form.forEach((value, key) => {
      draft[key] = String(value);
    });

    localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
  }

  function restoreDraft() {
    const raw = localStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return;

    try {
      const draft = JSON.parse(raw) as Record<string, string>;

      setTimeout(() => {
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
            if (
              key === "delivery" &&
              (value === "home" || value === "boxnow")
            ) {
              setDelivery(value);
            }
            return;
          }

          el.value = value;
        });
      }, 0);
    } catch {
      localStorage.removeItem(CHECKOUT_DRAFT_KEY);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formEl = event.currentTarget;
    const user = firebaseAuth.currentUser;

    if (!user) {
      saveDraft(formEl);
      setStatus("Please sign in or create an account before checkout.");

      window.location.href =
        "/login?redirect=" + encodeURIComponent("/checkout");
      return;
    }

    const me = await getMe();

    if (!me?.emailVerified) {
      saveDraft(formEl);
      setStatus("Please verify your email before checkout.");

      window.location.href =
        "/verify-email?redirect=" + encodeURIComponent("/checkout");
      return;
    }

    try {
      setSubmitting(true);
      setPayText("Preparing payment...");

      const form = new FormData(formEl);
      const cart = await getCart();
      const cartItems = cart?.items || [];

      if (cartItems.length === 0) {
        throw new Error("Your cart is empty.");
      }

      const firstName = getRequiredFormString(form, "firstName", "First name");
      const lastName = getRequiredFormString(form, "lastName", "Last name");
      const email = String(form.get("email") || "").trim() || user.email || "";
      const phone = getRequiredFormString(form, "phone", "Phone");
      const country = String(form.get("country") || "Greece").trim();
      const city = getRequiredFormString(form, "city", "City");
      const postalCode = getRequiredFormString(
        form,
        "postalCode",
        "Postal code"
      );
      const addressLine1 = getRequiredFormString(form, "address", "Address");

      if (!email) throw new Error("Email is required.");

      const selectedDelivery = String(form.get("delivery") || "home") as
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
        delivery: selectedDelivery,
        locker: String(form.get("locker") || "").trim(),
        notes: "",
        giftOptions: {
          tier: giftTier,
          giftBox: giftTier === "premium",
          personalNote:
            giftTier === "premium"
              ? personalNote.trim()
              : "",
        },
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      setStatus("Order created, but payment URL was not returned.");
    } catch (error) {
      console.error("Checkout failed:", error);
      setStatus(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
      setPayText(
        firebaseAuth.currentUser
          ? "Pay with viva.com"
          : "Sign in to pay with viva.com"
      );
    }
  }

  return (
    <main className="checkout-page">
      <div className="checkout-page__container">
        <form className="checkout-page__form" onSubmit={handleSubmit}>
          <h2>Checkout</h2>

          <div className="checkout-page__section">
            <h3>Contact</h3>

            <div className="row">
              <input name="firstName" placeholder="First name" required />
              <input name="lastName" placeholder="Last name" required />
            </div>

            <input name="email" type="email" placeholder="Email" required />
            <input name="phone" placeholder="Phone" required />
          </div>

          <div className="checkout-page__section">
            <h3>Shipping</h3>

            <input name="address" placeholder="Address" required />

            <div className="row">
              <input name="city" placeholder="City" required />
              <input name="postalCode" placeholder="Postal code" required />
            </div>

            <input name="country" placeholder="Country" required />
          </div>

          <div className="checkout-page__section">
            <h3>Delivery</h3>

            <label>
              <input
                type="radio"
                name="delivery"
                value="home"
                checked={delivery === "home"}
                onChange={() => setDelivery("home")}
              />
              Home delivery
            </label>

            <label>
              <input
                type="radio"
                name="delivery"
                value="boxnow"
                checked={delivery === "boxnow"}
                onChange={() => setDelivery("boxnow")}
              />
              Box Now locker
            </label>

            <div id="boxnowmap"></div>

            <button type="button" className="boxnow-widget-button">
              📍 Select Box Now Locker
            </button>

            <input
              id="lockerInput"
              name="locker"
              placeholder="Selected locker will appear here"
            />
          </div>

          <div className="checkout-page__section checkout-gift-section" id="gift-options">
            <button
              type="button"
              className="checkout-gift-summary"
              onClick={() => setGiftOpen((value) => !value)}
              aria-expanded={giftOpen}
            >
              <span className="checkout-gift-summary__index">04</span>
              <span className="checkout-gift-summary__copy">
                <strong>Gift options</strong>
                <small>Choose gift-ready or premium packaging.</small>
              </span>
              <span className="checkout-gift-summary__action">
                {giftTier === "none" ? "Add" : "Added"}
                {giftOpen ? " −" : " +"}
              </span>
            </button>

            {giftOpen ? (
              <div className="checkout-gift-body">
                <div className="checkout-gift-tiers" role="radiogroup" aria-label="Gift options">
                  {[
                    {
                      value: "simple",
                      title: "Gift-ready",
                      copy: "Hide prices and include a gift/returns receipt card.",
                      price: "Free",
                    },
                    {
                      value: "premium",
                      title: "Premium gift",
                      copy: "Gift box, hidden prices, gift/returns receipt and personal note.",
                      price: "+€1.50",
                    },
                  ].map((option) => (
                    <label
                      className="checkout-gift-tier"
                      key={option.value}
                      onClick={(event) => {
                        event.preventDefault();

                        const value =
                          option.value as "simple" | "premium";

                        setGiftTier((current) =>
                          current === value ? "none" : value
                        );
                      }}
                    >
                      <input
                        type="radio"
                        name="giftTier"
                        value={option.value}
                        checked={giftTier === option.value}
                        readOnly
                      />
                      <span className="checkout-gift-tier__copy">
                        <strong>{option.title}</strong>
                        <small>{option.copy}</small>
                      </span>
                      <span className="checkout-gift-tier__price">{option.price}</span>
                    </label>
                  ))}
                </div>

                {giftTier === "premium" ? (
                  <label className="checkout-gift-note">
                    <span>
                      Personal note <small>(premium only)</small>
                    </span>
                    <textarea
                      rows={5}
                      maxLength={200}
                      value={personalNote}
                      onChange={(event) => setPersonalNote(event.target.value)}
                      placeholder="Write your message..."
                    />
                    <small>{personalNote.length}/200 characters</small>
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            className="checkout-page__btn"
            disabled={submitting}
          >
            {payText}
          </button>

          {status ? <p className="auth-status">{status}</p> : null}
        </form>

        <div className="checkout-page__summary">
          <div>
            {items.length === 0 ? (
              <p>Your cart is empty.</p>
            ) : (
              items.map((item) => {
                const unitPrice = getCartItemUnitPrice(item);
                const itemTotal = unitPrice * Number(item.quantity || 0);
                const variant = item.variant || item.selectedVariant;

                return (
                  <div className="checkout-item" key={item.id}>
                    <div className="checkout-item__image-wrapper">
                      <img
                        src={item.image || "/assets/img/logo_Image.png"}
                        alt={item.title}
                      />
                      <span className="checkout-item__badge">
                        {item.quantity}
                      </span>
                    </div>

                    <div className="checkout-item__info">
                      <p>{item.title}</p>
                      <small>Size: {variant?.size || "-"}</small>
                      {item.qrDestination ? (
                        <small>{item.qrDestination}</small>
                      ) : null}
                    </div>

                    <strong>{formatPrice(itemTotal)}</strong>
                  </div>
                );
              })
            )}
          </div>

          <div className="checkout-discount">
            <input
              placeholder="Discount code or gift card"
              value={discountCode}
              onChange={(event) => setDiscountCode(event.target.value)}
            />
            <button type="button" onClick={applyDiscount}>
              Apply
            </button>
          </div>

          <div className="checkout-line">
            <span>Subtotal</span>
            <span>{formatPrice(discountedSubtotal)}</span>
          </div>

          <p className="checkout-free-msg">
            {discountedSubtotal < 50
              ? `Add ${(50 - discountedSubtotal).toFixed(2)}€ for FREE shipping`
              : "You unlocked FREE shipping 🎉"}
          </p>

          <div className="checkout-line">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
          </div>

          {giftFee > 0 ? (
            <div className="checkout-line checkout-gift-fee">
              <span>Premium gift</span>
              <span>+{formatPrice(giftFee)}</span>
            </div>
          ) : null}

          <div className="checkout-total">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </div>
      </div>
    </main>
  );
}

function getCartItemUnitPrice(item: CartItem): number {
  return typeof item.price === "number" ? item.price : 0;
}

function calculateShipping(subtotal: number, delivery: string): number {
  if (subtotal >= 50) return 0;
  if (delivery === "boxnow") return 2.0;
  return 3.5;
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

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}
