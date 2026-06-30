"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCart,
  removeCartItem,
  updateCartItem,
  type Cart,
  type CartItem,
} from "@/lib/cart";

const FREE_SHIPPING_TARGET = 50;
const FREE_STICKERS_TARGET = 80;

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState("");

  async function loadCart() {
    try {
      setError("");
      const nextCart = await getCart();
      setCart(nextCart);
    } catch (err: any) {
      setError(err?.message || "Failed to load cart.");
    }
  }

  useEffect(() => {
    void loadCart();

    function openDrawer(event: Event) {
      event.preventDefault();
      setOpen(true);
      void loadCart();
    }

    document.querySelectorAll(".cart-link").forEach((link) => {
      link.addEventListener("click", openDrawer);
    });

    return () => {
      document.querySelectorAll(".cart-link").forEach((link) => {
        link.removeEventListener("click", openDrawer);
      });
    };
  }, []);

  const items = cart?.items || [];

  const total = useMemo(() => {
    if (typeof cart?.subtotal === "number") return cart.subtotal;

    return items.reduce((sum, item) => {
      const price = Number(item.price ?? item.priceEUR ?? 0);
      return sum + price * Number(item.quantity || 0);
    }, 0);
  }, [cart, items]);

  async function changeQuantity(item: CartItem, quantity: number) {
    if (quantity <= 0) {
      await removeCartItem(item.id);
    } else {
      await updateCartItem(item.id, {
        quantity,
        qrDestination: item.qrDestination || "https://skanare.com",
      });
    }

    await loadCart();
  }

  async function removeItem(item: CartItem) {
    await removeCartItem(item.id);
    await loadCart();
  }

  return (
    <>
      <div
        className={`cart-overlay ${open ? "" : "hidden"}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`cart-drawer ${open ? "open" : "hidden"}`}>
        <header className="cart-header">
          <h2>Your Cart</h2>
          <button type="button" onClick={() => setOpen(false)}>
            ✕
          </button>
        </header>

        <div id="cartDrawerContent">
          {error ? (
            <p className="meta" style={{ color: "#dc2626" }}>
              {error}
            </p>
          ) : null}

          {items.length === 0 ? (
            <section className="cart-empty">
              <h2>Your cart is empty</h2>
              <Link className="btn-primary cart-empty-btn" href="/products">
                SHOP PRODUCTS
              </Link>
            </section>
          ) : (
            <>
              <CartProgress total={total} />

              <section className="drawer-cart-list">
                {items.map((item) => {
                  const price = Number(item.price ?? item.priceEUR ?? 0);
                  const image = item.image || "/assets/img/logo_Image.png";
                  const variant = item.variant || item.selectedVariant;

                  return (
                    <article className="drawer-cart-item" key={item.id}>
                      <img src={image} alt={item.title} />

                      <div className="drawer-cart-info">
                        <h3>{item.title}</h3>

                        {variant?.size ? <p>Size: {variant.size}</p> : null}
                        {variant?.color ? <p>Color: {variant.color}</p> : null}
                        {item.qrDestination ? (
                          <p>QR-Code: {item.qrDestination}</p>
                        ) : null}

                        <div className="drawer-qty">
                          <button
                            type="button"
                            onClick={() =>
                              void changeQuantity(
                                item,
                                Number(item.quantity || 0) - 1
                              )
                            }
                          >
                            −
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            type="button"
                            onClick={() =>
                              void changeQuantity(
                                item,
                                Number(item.quantity || 0) + 1
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="drawer-cart-price">
                        <button
                          type="button"
                          onClick={() => void removeItem(item)}
                        >
                          🗑
                        </button>

                        <strong>{formatPrice(price * item.quantity)}</strong>
                      </div>
                    </article>
                  );
                })}
              </section>

              <div className="checkout-container">
                <Link className="btn-primary drawer-checkout" href="/checkout">
                  Proceed to Checkout
                </Link>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function CartProgress({ total }: { total: number }) {
  const percent = Math.min(
    total < FREE_SHIPPING_TARGET
      ? (total / FREE_SHIPPING_TARGET) * 50
      : total < FREE_STICKERS_TARGET
      ? 50 +
        ((total - FREE_SHIPPING_TARGET) /
          (FREE_STICKERS_TARGET - FREE_SHIPPING_TARGET)) *
          50
      : 100,
    100
  );

  const message =
    total < FREE_SHIPPING_TARGET
      ? `Only ${formatPrice(FREE_SHIPPING_TARGET - total)} away from free shipping`
      : total < FREE_STICKERS_TARGET
      ? `Add ${formatPrice(FREE_STICKERS_TARGET - total)} more and get a Sticker Set for free`
      : "You unlocked all rewards";

  return (
    <div className="cart-progress-new">
      <p>{message}</p>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percent}%` }} />

        <div
          className={`progress-step step-1 ${
            total >= FREE_SHIPPING_TARGET ? "done" : ""
          }`}
        >
          <div className="icon">🚚</div>
          <span>
            <small>FREE</small>
            SHIPPING
          </span>
        </div>

        <div
          className={`progress-step step-2 ${
            total >= FREE_STICKERS_TARGET ? "done" : ""
          }`}
        >
          <div className="icon">🎁</div>
          <span>
            <small>FREE</small>
            STICKER SET
          </span>
        </div>
      </div>
    </div>
  );
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}