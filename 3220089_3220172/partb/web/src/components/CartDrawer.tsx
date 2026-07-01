"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
  type Cart,
  type CartItem,
} from "@/lib/cart";
import { getProducts, type Product } from "@/lib/products";

const FREE_SHIPPING_TARGET = 50;
const FREE_STICKERS_TARGET = 80;

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState("");
  const [crossSell, setCrossSell] = useState<Product[]>([]);
  const [toast, setToast] = useState("");

  async function loadCart() {
    try {
      setError("");
      const nextCart = await getCart();
      setCart(nextCart);
      await loadCrossSell(nextCart);
    } catch (err: any) {
      setError(err?.message || "Failed to load cart.");
    }
  }

  async function loadCrossSell(nextCart: Cart | null) {
    try {
      const items = nextCart?.items || [];
      const products = await getProducts({ active: true });

      const currentIds = new Set(
        items
          .map((item) => getCartItemProductId(item))
          .filter(Boolean)
      );

      const suggestions = products
        .filter(
          (product) =>
            product.active !== false &&
            !currentIds.has(product.id) &&
            !currentIds.has(product._id || "")
        )
        .sort(() => Math.random() - 0.5)
        .slice(0, 6);

      setCrossSell(suggestions);
    } catch {
      setCrossSell([]);
    }
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  }

  function openDrawer(event?: Event) {
    event?.preventDefault();
    setOpen(true);
    void loadCart();
  }

  function closeDrawer() {
    setOpen(false);
  }

  useEffect(() => {
    void loadCart();

    window.addEventListener("skanare:open-cart", openDrawer);

    document.querySelectorAll(".cart-link").forEach((link) => {
      link.addEventListener("click", openDrawer);
    });

    return () => {
      window.removeEventListener("skanare:open-cart", openDrawer);

      document.querySelectorAll(".cart-link").forEach((link) => {
        link.removeEventListener("click", openDrawer);
      });
    };
  }, []);

  const items = cart?.items || [];

  const total = useMemo(() => {
    if (typeof cart?.subtotal === "number") return cart.subtotal;

    return items.reduce((sum, item) => {
      const price = getCartItemUnitPrice(item);
      return sum + price * Number(item.quantity || 0);
    }, 0);
  }, [cart, items]);

  async function changeQuantity(item: CartItem, nextQuantity: number) {
    try {
      if (nextQuantity <= 0) {
        await removeCartItem(getCartItemKey(item));
        await loadCart();
        return;
      }

      const maxStock = getItemAvailableStock(item);

      if (nextQuantity > maxStock) {
        showToast("We don't have more items in this size.");
        return;
      }

      await updateCartItem(getCartItemKey(item), {
        quantity: nextQuantity,
        qrDestination: item.qrDestination || "https://skanare.com",
      });

      await loadCart();
    } catch (err: any) {
      showToast(err?.message || "Failed to update quantity.");
    }
  }

  async function deleteItem(item: CartItem) {
    try {
      await removeCartItem(getCartItemKey(item));
      await loadCart();
    } catch (err: any) {
      showToast(err?.message || "Failed to remove item.");
    }
  }

  async function addCrossSell(product: Product) {
    try {
      const selectedVariant =
        product.variants?.find((variant) => Number(variant.stock || 0) > 0) ||
        null;

      await addCartItem({
        productId: product._id || product.id,
        quantity: 1,
        variant: selectedVariant,
        qrDestination: "https://skanare.com",
      });

      await loadCart();
      setOpen(true);
      showToast("Added to cart.");
    } catch (err: any) {
      showToast(err?.message || "Failed to add product to cart.");
    }
  }

  function scrollCrossSell(amount: number) {
    const row = document.querySelector(".cart-cross-sell-row");
    row?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <>
      <div
        className={`cart-overlay ${open ? "" : "hidden"}`}
        onClick={closeDrawer}
      />

      <aside className={`cart-drawer ${open ? "open" : "hidden"}`}>
        <header className="cart-header">
          <h2>Your Cart</h2>
          <button type="button" onClick={closeDrawer}>
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
                  const variant = getCartItemVariant(item);
                  const title = getCartItemTitle(item);
                  const image = getCartItemImage(item);
                  const unitPrice = getCartItemUnitPrice(item);

                  return (
                    <article className="drawer-cart-item" key={getCartItemKey(item)}>
                      <img src={image} alt={title} />

                      <div className="drawer-cart-info">
                        <h3>{title}</h3>

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
                          className="cart-remove"
                          onClick={() => void deleteItem(item)}
                          aria-label="Remove item"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18">
                            <path d="M11.5 8.25a.75.75 0 0 1 .75.75v4.25a.75.75 0 0 1-1.5 0v-4.25a.75.75 0 0 1 .75-.75Z" />
                            <path d="M9.25 9a.75.75 0 0 0-1.5 0v4.25a.75.75 0 0 0 1.5 0v-4.25Z" />
                            <path
                              fillRule="evenodd"
                              d="M7.25 5.25a2.75 2.75 0 0 1 5.5 0h3a.75.75 0 0 1 0 1.5h-.75v5.45c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311c-.642.327-1.482.327-3.162.327h-.4c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311c-.327-.642-.327-1.482-.327-3.162v-5.45h-.75a.75.75 0 0 1 0-1.5h3Zm1.5 0a1.25 1.25 0 1 1 2.5 0h-2.5Zm-2.25 1.5h7v5.45c0 .865-.001 1.423-.036 1.848-.033.408-.09.559-.128.633a1.5 1.5 0 0 1-.655.655c-.074.038-.225.095-.633.128-.425.035-.983.036-1.848.036h-.4c-.865 0-1.423-.001-1.848-.036-.408-.033-.559-.09-.633-.128a1.5 1.5 0 0 1-.656-.655c-.037-.074-.094-.225-.127-.633-.035-.425-.036-.983-.036-1.848v-5.45Z"
                            />
                          </svg>
                        </button>

                        <strong>{formatPrice(unitPrice * item.quantity)}</strong>
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

                <div className="cart-summary-meta">
                  <small>
                    {getCartCount(cart)} item{getCartCount(cart) === 1 ? "" : "s"}
                  </small>
                </div>
              </section>

              {crossSell.length > 0 ? (
                <section className="cart-cross-sell">
                  <h3 className="cross-header">
                    Others also bought:
                    <div className="cross-arrows">
                      <button type="button" onClick={() => scrollCrossSell(-260)}>
                        ‹
                      </button>
                      <button type="button" onClick={() => scrollCrossSell(260)}>
                        ›
                      </button>
                    </div>
                  </h3>

                  <div className="cart-cross-sell-row">
                    {crossSell.map((product) => {
                      const image =
                        product.image ||
                        product.images?.[0] ||
                        "/assets/img/logo_Image.png";

                      return (
                        <article
                          className="cart-cross-card"
                          key={product.id}
                          onClick={() => {
                            window.location.href = `/product/${encodeURIComponent(
                              product.slug || product.id
                            )}`;
                          }}
                        >
                          <img src={image} alt={product.title} />
                          <h4>{product.title}</h4>
                          <p>{formatPrice(product.price)}</p>

                          <button
                            className="cross-add"
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void addCrossSell(product);
                            }}
                          >
                            Add
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <div className="checkout-container">
                <Link className="btn-primary drawer-checkout" href="/checkout">
                  Proceed to Checkout
                </Link>
              </div>
            </>
          )}
        </div>
      </aside>

      {toast ? (
        <div id="toastStack" className="toast-stack">
          <div className="toast-message">{toast}</div>
        </div>
      ) : null}
    </>
  );
}

function CartProgress({ total }: { total: number }) {
  let percent = 0;

  if (total < FREE_SHIPPING_TARGET) {
    percent = (total / FREE_SHIPPING_TARGET) * 50;
  } else if (total < FREE_STICKERS_TARGET) {
    percent =
      50 +
      ((total - FREE_SHIPPING_TARGET) /
        (FREE_STICKERS_TARGET - FREE_SHIPPING_TARGET)) *
        50;
  } else {
    percent = 100;
  }

  percent = Math.min(percent, 100);

  const isShippingDone = total >= FREE_SHIPPING_TARGET;
  const isStickerDone = total >= FREE_STICKERS_TARGET;

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

        <div className={`progress-step step-1 ${isShippingDone ? "done" : ""}`}>
          <div className="icon">
          <svg viewBox="0 0 512 512" width="18" height="18">
              <path d="M386.689 304.403c-35.587 0-64.538 28.951-64.538 64.538s28.951 64.538 64.538 64.538c35.593 0 64.538-28.951 64.538-64.538s-28.951-64.538-64.538-64.538zm0 96.807c-17.796 0-32.269-14.473-32.269-32.269s14.473-32.269 32.269-32.269 32.269 14.473 32.269 32.269-14.473 32.269-32.269 32.269zm-220.504-96.807c-35.587 0-64.538 28.951-64.538 64.538s28.951 64.538 64.538 64.538 64.538-28.951 64.538-64.538-28.951-64.538-64.538-64.538zm0 96.807c-17.796 0-32.269-14.473-32.269-32.269s14.473-32.269 32.269-32.269 32.269 14.473 32.269 32.269-14.473 32.269-32.269 32.269zM430.15 119.675c-2.743-5.448-8.32-8.885-14.419-8.885h-84.975v32.269h75.025l43.934 87.384 28.838-14.5-48.403-96.268z"/>
              <path d="M216.202 353.345h122.084v32.269H216.202zm-98.421 0H61.849c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h55.933c8.912 0 16.134-7.223 16.134-16.134s-7.223-16.134-16.135-16.134zm390.831-98.636l-31.736-40.874c-3.049-3.937-7.755-6.239-12.741-6.239H346.891V94.655c0-8.912-7.223-16.134-16.134-16.134H61.849c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h252.773V223.73c0 8.912 7.223 16.134 16.134 16.134h125.478l23.497 30.268v83.211h-44.639c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h60.773c8.912 0 16.134-7.223 16.135-16.134V264.605c0-3.582-1.194-7.067-3.388-9.896zm-391.906 16.888H42.487c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h74.218c8.912 0 16.134-7.223 16.134-16.134s-7.222-16.134-16.133-16.134zm37.109-63.463H16.134C7.223 208.134 0 215.357 0 224.269s7.223 16.134 16.134 16.134h137.681c8.912 0 16.134-7.223 16.134-16.134s-7.222-16.135-16.134-16.135zm26.353-63.462H42.487c-8.912 0-16.134 7.223-16.134 16.134s7.223 16.134 16.134 16.134h137.681c8.912 0 16.134-7.223 16.134-16.134s-7.222-16.134-16.134-16.134z"/>
            </svg>
          </div>
          <span>
            <small>FREE</small>
            SHIPPING
          </span>
        </div>

        <div className={`progress-step step-2 ${isStickerDone ? "done" : ""}`}>
          <div className="icon">
          <svg viewBox="0 0 22 22" width="18" height="18">
              <path d="M19.5 6.25h-1.065A2.709 2.709 0 0 0 18.75 5a2.747 2.747 0 0 0-4.876-1.739L12 5.752l-1.881-2.5A2.747 2.747 0 0 0 5.25 5a2.709 2.709 0 0 0 .315 1.25H4.5A2.253 2.253 0 0 0 2.25 8.5V12a.75.75 0 0 0 .75.75h.25V18A3.383 3.383 0 0 0 7 21.75h10A3.383 3.383 0 0 0 20.75 18v-5.25H21a.75.75 0 0 0 .75-.75V8.5a2.253 2.253 0 0 0-2.25-2.25zm.75 2.25v2.75h-7.5v-3.5h6.75a.751.751 0 0 1 .75.75zm-5.211-4.293A1.223 1.223 0 0 1 16 3.75a1.25 1.25 0 0 1 0 2.5h-2.5l1.539-2.043zM6.75 5A1.252 1.252 0 0 1 8 3.75a1.213 1.213 0 0 1 .948.441L10.5 6.25H8A1.252 1.252 0 0 1 6.75 5zm-3 3.5a.751.751 0 0 1 .75-.75h6.75v3.5h-7.5zm1 9.5v-5.25h6.5v7.5H7c-1.577 0-2.25-.673-2.25-2.25zm14.5 0c0 1.577-.673 2.25-2.25 2.25h-4.25v-7.5h6.5z"/>
            </svg>
          </div>
          <span>
            <small>FREE</small>
            STICKER SET
          </span>
        </div>
      </div>
    </div>
  );
}

function getCartItemKey(item: CartItem): string {
  return String(item.id);
}

function getCartItemProductId(item: CartItem): string {
  const productId = item.productId as any;

  if (typeof productId === "string") return productId;
  if (productId && typeof productId === "object") return productId.id || "";

  return "";
}

function getCartItemTitle(item: CartItem): string {
  return item.title || "Product";
}

function getCartItemImage(item: CartItem): string {
  return item.image || "/assets/img/logo_Image.png";
}

function getCartItemUnitPrice(item: CartItem): number {
  return Number(item.price ?? item.priceEUR ?? 0);
}

function getCartItemVariant(item: CartItem) {
  return item.variant || item.selectedVariant || null;
}

function getItemAvailableStock(item: CartItem): number {
  const variant = getCartItemVariant(item);

  if (variant && typeof variant.stock === "number") {
    return variant.stock;
  }

  return 99;
}

function getCartCount(cart: Cart | null): number {
  if (!cart) return 0;

  if (typeof cart.totalItems === "number") {
    return cart.totalItems;
  }

  return (cart.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}