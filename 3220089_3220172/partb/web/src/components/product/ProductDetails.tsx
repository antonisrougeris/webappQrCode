"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product, ProductReview, ProductVariant } from "@/lib/products";
import { addCartItem } from "@/lib/cart";

type Props = {
  product: Product;
  relatedProducts: Product[];
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function getProductImages(product: Product): string[] {
  return Array.from(
    new Set([...(product.images || []), product.image].filter(Boolean))
  ) as string[];
}

function isInStock(product: Product, variant?: ProductVariant | null): boolean {
  if (variant) return Number(variant.stock || 0) > 0;

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.some((item) => Number(item.stock || 0) > 0);
  }

  if (typeof product.stock === "number") return product.stock > 0;

  return true;
}

function getFallbackReviews(product: Product): ProductReview[] {
  if (Array.isArray(product.reviews) && product.reviews.length > 0) {
    return product.reviews;
  }

  return [
    {
      name: "Maria",
      rating: 5,
      comment: "Great quality and the QR code works perfectly.",
    },
    {
      name: "Alex",
      rating: 5,
      comment: "The print feels durable and the product arrived fast.",
    },
    {
      name: "Nikos",
      rating: 4,
      comment: "Very nice product. I would like more color options.",
    },
  ];
}

function openCartDrawer() {
  window.dispatchEvent(new Event("skanare:open-cart"));
}

export function ProductDetails({ product, relatedProducts }: Props) {
  const images = getProductImages(product);
  const firstImage = images[0] || "";

  const [mainImage, setMainImage] = useState(firstImage);
  const [quantity, setQuantity] = useState(1);
  const [qrDestination, setQrDestination] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);

  const variants = product.variants || [];

  const availableVariant =
    variants.find((variant) => Number(variant.stock || 0) > 0) || variants[0];

  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    availableVariant?.size
  );

  const selectedVariant = useMemo(() => {
    if (!variants.length) return undefined;
    return variants.find((variant) => variant.size === selectedSize);
  }, [variants, selectedSize]);

  const selectedStock = selectedVariant?.stock ?? product.stock ?? 0;

  const reviews = getFallbackReviews(product);

  const averageRating =
    reviews.length > 0
      ? Math.round(
          reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviews.length
        )
      : 0;

  function increaseQuantity() {
    if (selectedStock > 0 && quantity >= selectedStock) {
      setQuantity(selectedStock);
      setStatus(
        `Only ${selectedStock} item${
          selectedStock === 1 ? "" : "s"
        } available in this size.`
      );
      return;
    }

    setQuantity((value) => value + 1);
  }

  function decreaseQuantity() {
    setQuantity((value) => Math.max(1, value - 1));
  }

  async function handleAddToCart() {
    const rawQrDestination = qrDestination.trim();
    const finalQrDestination = rawQrDestination || "https://skanare.com";

    if (!rawQrDestination) {
      setStatus("Don’t forget to add your own QR URL later.");
    } else if (/^https?:\/\//i.test(rawQrDestination)) {
      try {
        new URL(rawQrDestination);
      } catch {
        setStatus("Please enter a valid URL, for example https://example.com");
        return;
      }
    }

    if (!isInStock(product, selectedVariant || null)) {
      setStatus("This variant is out of stock.");
      return;
    }

    if (selectedStock > 0 && quantity > selectedStock) {
      setQuantity(selectedStock);
      setStatus(
        `Only ${selectedStock} item${
          selectedStock === 1 ? "" : "s"
        } available in this size.`
      );
      return;
    }

    try {
      setAdding(true);
      setStatus("Adding...");

      await addCartItem({
        productId: product.id,
        quantity,
        variant: selectedVariant || null,
        qrDestination: finalQrDestination,
      });

      setStatus("Added to cart!");
      openCartDrawer();
    } catch (error: any) {
      setStatus(error?.message || "Failed to add product to cart.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <main className="container product-page">
      <article id="productDetails" className="product-details-card">
        <section className="product-gallery">
          <div className="product-main-image">
            {mainImage ? (
              <img src={mainImage} alt={product.title} />
            ) : (
              <div className="mini-shirt" />
            )}
          </div>

          {images.length > 1 ? (
            <div className="product-thumbnails">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  className={`product-thumbnail ${
                    image === mainImage ? "active" : ""
                  }`}
                  onClick={() => setMainImage(image)}
                >
                  <img
                    src={image}
                    alt={`${product.title} photo ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="product-info">
          {product.badge ? (
            <p className="product-badge">{product.badge}</p>
          ) : null}

          <h1>{product.title}</h1>

          <p className="product-meta">
            {product.category === "tshirt"
              ? "T-Shirt • Custom editable QR"
              : "Accessory • Custom editable QR"}
          </p>

          <a href="#productReviews" className="product-rating">
            <span>
              {"★".repeat(averageRating)}
              {"☆".repeat(5 - averageRating)}
            </span>
            <small>{reviews.length} reviews</small>
          </a>

          <p className="product-price">{formatPrice(product.price)}</p>

          <p className="tax-note">Tax included.</p>

          <details className="product-accordion" open>
            <summary>Product Information</summary>
            <p>{product.description || product.shortDescription}</p>
          </details>

          <div className="qr-box">
            <label htmlFor="qrDestination">Your QR code links to:</label>

            <input
              id="qrDestination"
              type="url"
              placeholder="https://... or TEXT..."
              aria-label="QR destination URL or text"
              value={qrDestination}
              onChange={(event) => setQrDestination(event.target.value)}
            />

            <small>
              Enter your link / text now, or later inside the website.
            </small>
          </div>

          {variants.length > 0 ? (
            <div className="variant-controls">
              <div className="size-row">
                <div>
                  Size: <strong>{selectedSize || "-"}</strong>
                </div>

                <a className="size-chart">Size chart</a>
              </div>

              <div className="size-stock-row">
                <div className="option-buttons">
                  {Array.from(
                    new Set(
                      variants
                        .map((variant) => variant.size)
                        .filter(Boolean) as string[]
                    )
                  ).map((size) => {
                    const variant = variants.find((item) => item.size === size);
                    const out = Number(variant?.stock || 0) <= 0;

                    return (
                      <button
                        key={size}
                        type="button"
                        className={`option-btn ${
                          selectedSize === size ? "active" : ""
                        } ${out ? "out-of-stock" : ""}`}
                        disabled={out}
                        onClick={() => {
                          setSelectedSize(size);
                          setQuantity(1);
                        }}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>

                <div
                  className="stock-inline"
                  style={{
                    color: isInStock(product, selectedVariant || null)
                      ? "#129447"
                      : "red",
                  }}
                >
                  {isInStock(product, selectedVariant || null)
                    ? "In stock"
                    : "Out of stock"}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="stock-inline"
              style={{
                color: isInStock(product) ? "#129447" : "red",
              }}
            >
              {isInStock(product) ? "In stock" : "Out of stock"}
            </div>
          )}

          <div className="quantity-control">
            <span>Quantity:</span>

            <div className="quantity-box">
              <button type="button" onClick={decreaseQuantity}>
                −
              </button>
              <span>{quantity}</span>
              <button type="button" onClick={increaseQuantity}>
                +
              </button>
            </div>
          </div>

          <div className="delivery-info">
            🚚 At your door in 2-5 business days
          </div>

          <button
            className="btn-primary add-to-cart-btn"
            type="button"
            disabled={adding || !isInStock(product, selectedVariant || null)}
            onClick={() => void handleAddToCart()}
          >
            {adding ? "Adding..." : "Add to cart"}
          </button>

          {status ? <p className="auth-status">{status}</p> : null}
        </section>
      </article>

      <section className="trust-section">
        <div className="trust-card">
          <span className="trust-icon">🚚</span>
          <div>
            <strong>Free Shipping</strong>
            <p>from €50 otherwise €4.99</p>
          </div>
        </div>

        <div className="trust-card">
          <span className="trust-icon">↩</span>
          <div>
            <strong>Free Returns</strong>
            <p>simple & hassle-free</p>
          </div>
        </div>

        <div className="trust-card">
          <span className="trust-icon">◇</span>
          <div>
            <strong>Premium quality</strong>
            <p>Made with care by us</p>
          </div>
        </div>

        <div className="trust-card">
          <span className="trust-icon">🛡</span>
          <div>
            <strong>QR Code Warranty</strong>
            <p>Active QR code guaranteed</p>
          </div>
        </div>
      </section>

      <section className="you-may-like">
        <div className="section-head">
          <h2>You may also like</h2>
        </div>

        <div className="related-products-grid">
          {relatedProducts.length ? (
            relatedProducts.map((item) => {
              const image = item.images?.[0] || item.image || "";

              return (
                <Link
                  key={item.id}
                  href={`/product/${item.slug || item.id}`}
                  className="related-product-card"
                >
                  <div className="related-product-image">
                    {image ? (
                      <img src={image} alt={item.title} />
                    ) : (
                      <div className="related-product-fallback mini-shirt" />
                    )}
                  </div>

                  <div className="related-product-body">
                    <h3>{item.title}</h3>
                    <p>{formatPrice(item.price)}</p>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="meta">No related products found.</p>
          )}
        </div>
      </section>

      <section className="reviews-section" id="productReviews">
        <h2>Customer Reviews</h2>

        <div className="reviews-list">
          {reviews.map((review) => (
            <article
              className="review-card"
              key={`${review.name}-${review.comment}`}
            >
              <strong>{review.name}</strong>
              <div className="review-stars">
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </div>
              <p>{review.comment}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">How it works</h2>
          </div>

          <div className="grid grid-3 how-it-works">
            <article className="card step">
              <h3>Choose product</h3>
              <p className="meta">Pick a t-shirt, hoodie or accessory.</p>
            </article>

            <article className="card step">
              <h3>Add your QR link</h3>
              <p className="meta">
                Enter the URL, social profile or text you want to open.
              </p>
            </article>

            <article className="card step">
              <h3>Change it anytime</h3>
              <p className="meta">
                After purchase, edit the QR destination without replacing the
                shirt.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
