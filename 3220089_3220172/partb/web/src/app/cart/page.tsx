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

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCart() {
    try {
      setLoading(true);
      setError("");
      const nextCart = await getCart();
      setCart(nextCart);
    } catch (err: any) {
      setError(err?.message || "Failed to load cart.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCart();
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
    try {
      if (quantity <= 0) {
        await removeCartItem(item.id);
      } else {
        await updateCartItem(item.id, {
          quantity,
          qrDestination: item.qrDestination || "https://skanare.com",
        });
      }

      await loadCart();
    } catch (err: any) {
      setError(err?.message || "Failed to update cart.");
    }
  }

  async function removeItem(item: CartItem) {
    try {
      await removeCartItem(item.id);
      await loadCart();
    } catch (err: any) {
      setError(err?.message || "Failed to remove item.");
    }
  }

  return (
    <main className="container page-content">
      <h1 className="section-title">Your Cart</h1>

      {loading ? <p className="meta">Loading your cart...</p> : null}

      {error ? (
        <p className="meta" style={{ color: "#dc2626" }}>
          {error}
        </p>
      ) : null}

      {!loading && items.length === 0 ? (
        <section className="cart-empty">
          <h2>Your cart is empty</h2>
          <Link className="btn-primary cart-empty-btn" href="/products">
            SHOP PRODUCTS
          </Link>
        </section>
      ) : null}

      {items.length > 0 ? (
        <>
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
                          void changeQuantity(item, Number(item.quantity) - 1)
                        }
                      >
                        −
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        type="button"
                        onClick={() =>
                          void changeQuantity(item, Number(item.quantity) + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="drawer-cart-price">
                    <button type="button" onClick={() => void removeItem(item)}>
                      ✕
                    </button>

                    <strong>{formatPrice(price * item.quantity)}</strong>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="cart-summary">
            <div>
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </div>
          </section>

          <div className="checkout-container">
            <Link className="btn-primary drawer-checkout" href="/checkout">
              Proceed to Checkout
            </Link>
          </div>
        </>
      ) : null}
    </main>
  );
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}