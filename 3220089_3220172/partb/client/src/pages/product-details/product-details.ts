/* 3220089_3220172 */

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";
import {
  getProductById,
  getProducts,
  type Product,
  type ProductVariant,
  type ProductReview,
} from "../../services/products";
import { addCartItem } from "../../services/cart";

import { showToast } from "../../utils/toast.ts";


initNav();
initMobileMenu();
void updateCartBadge();

let selectedVariantStock = 0;
let quantity = 1;

function getQueryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function setText(el: HTMLElement | null, text: string): void {
  if (el) el.textContent = text;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}



function openExistingCartDrawer(): void {
  const cartLink = document.querySelector<HTMLElement>(
    "[data-cart-link], .cart-link"
  );
  cartLink?.click();
}

function getProductImage(product: Product): string {
  return product.image || product.images?.[0] || "";
}

function isInStock(product: Product, variant?: ProductVariant): boolean {
  if (variant) return Number(variant.stock || 0) > 0;

  if (typeof product.stock === "number") return product.stock > 0;

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.some((item) => Number(item.stock || 0) > 0);
  }

  return true;
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function productUrl(product: Product): string {
  const identifier = product.slug || product.id;
  return `/src/pages/product-details/product-details.html?id=${encodeURIComponent(
    identifier
  )}`;
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

function renderReviews(reviews: ProductReview[]): void {
  const reviewsList = document.getElementById("reviewsList");
  const reviewLinkText = document.getElementById("reviewLinkText");
  const productStars = document.getElementById("productStars");

  if (reviewLinkText) {
    reviewLinkText.textContent = `${reviews.length} reviews`;
  }

  if (productStars) {
    const average =
      reviews.length > 0
        ? Math.round(
            reviews.reduce((sum, review) => sum + review.rating, 0) /
              reviews.length
          )
        : 0;

    productStars.textContent = "★".repeat(average) + "☆".repeat(5 - average);
  }

  if (!reviewsList) return;

  if (reviews.length === 0) {
    reviewsList.innerHTML = `<p class="meta">No reviews yet.</p>`;
    return;
  }

  reviewsList.innerHTML = reviews
    .map(
      (review) => `
        <article class="review-card">
          <strong>${review.name}</strong>
          <div class="review-stars">
            ${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}
          </div>
          <p>${review.comment}</p>
        </article>
      `
    )
    .join("");
}

function setupVariantControls(
  product: Product
): () => ProductVariant | undefined {
  const wrapper = document.getElementById(
    "variantControls"
  ) as HTMLElement | null;
  const sizeOptions = document.getElementById("sizeOptions");
  const selectedSizeText = document.getElementById("selectedSizeText");
  const stockEl = document.getElementById("productStock");

  const variants = product.variants || [];

  if (!wrapper || variants.length === 0) {
    if (wrapper) wrapper.hidden = true;
    return () => undefined;
  }

  const sizes = Array.from(
    new Set(variants.map((v) => v.size).filter(Boolean) as string[])
  );

  const firstAvailable = variants.find((v) => (v.stock ?? 0) > 0);
  let selectedSize = firstAvailable?.size || sizes[0];

  function getStock(size: string): number {
    const v = variants.find((x) => x.size === size);
    return v?.stock ?? 0;
  }

  function isSizeOut(size: string): boolean {
    return getStock(size) <= 0;
  }

  function getSelectedVariant(): ProductVariant | undefined {
    return variants.find((v) => v.size === selectedSize);
  }

  function updateStock(): void {
    const variant = getSelectedVariant();
    selectedVariantStock = variant?.stock ?? product.stock ?? 0;
  }

  function updateUI(): void {
    updateStock();

    if (selectedSizeText) {
      selectedSizeText.textContent = selectedSize || "-";
    }

    document
      .querySelectorAll<HTMLButtonElement>("[data-size]")
      .forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.size === selectedSize);
      });

    const variant = getSelectedVariant();

    if ((variant?.stock ?? 0) <= 0) {
      quantity = 1;
    }

    if (!stockEl) return;

    const allOut = variants.every((v) => Number(v.stock || 0) <= 0);

    if (allOut) {
      stockEl.textContent = "Out of stock";
      stockEl.style.color = "red";
      return;
    }

    stockEl.textContent = isInStock(product, variant)
      ? "In stock"
      : "Out of stock";
    stockEl.style.color = isInStock(product, variant) ? "#129447" : "red";
  }

  if (sizeOptions) {
    sizeOptions.innerHTML = sizes
      .map((size) => {
        const out = isSizeOut(size);

        return `
          <button
            type="button"
            class="option-btn ${out ? "out-of-stock" : ""}"
            data-size="${size}"
            ${out ? "disabled" : ""}
          >
            ${size}
          </button>
        `;
      })
      .join("");
  }

  document.querySelectorAll<HTMLButtonElement>("[data-size]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const size = btn.dataset.size!;
      if (isSizeOut(size)) return;

      selectedSize = size;
      updateUI();
    });
  });

  wrapper.hidden = false;
  updateUI();

  return getSelectedVariant;
}

async function renderRelatedProducts(currentProduct: Product): Promise<void> {
  const relatedProductsEl = document.getElementById("relatedProducts");
  if (!relatedProductsEl) return;

  try {
    const products = await getProducts();

    const related = products
      .filter((item) => item.id !== currentProduct.id && item.active !== false)
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);

    if (related.length === 0) {
      relatedProductsEl.innerHTML = `<p class="meta">No related products found.</p>`;
      return;
    }

    relatedProductsEl.innerHTML = related
      .map((product) => {
        const image = getProductImage(product);

        return `
          <a
            href="${productUrl(product)}"
            class="related-product-card"
          >
            <div class="related-product-image">
              ${
                image
                  ? `<img src="${image}" alt="${product.title}" />`
                  : `<div class="related-product-fallback mini-shirt"></div>`
              }
            </div>

            <div class="related-product-body">
              <h3>${product.title}</h3>
              <p>${formatPrice(product.price)}</p>

              <button
                type="button"
                class="quick-add-btn"
                data-product-id="${product.id}"
                aria-label="Quick add ${product.title} to cart"
              >
                +
              </button>
            </div>
          </a>
        `;
      })
      .join("");

    relatedProductsEl
      .querySelectorAll<HTMLButtonElement>(".quick-add-btn")
      .forEach((btn) => {
        btn.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();

          const productId = btn.dataset.productId;
          const product = related.find((item) => item.id === productId);

          if (!product || !isInStock(product)) {
            showToast("This product is out of stock.");
            return;
          }

          const selectedVariant = product.variants?.find(
            (variant) => Number(variant.stock || 0) > 0
          );

          try {
            btn.disabled = true;
            btn.textContent = "...";

            await addCartItem({
              productId: product.id,
              quantity: 1,
              variant: selectedVariant || null,
              qrDestination: "https://skanare.com",
            });

            await updateCartBadge();

            btn.classList.add("added");
            btn.textContent = "✓";

            setTimeout(() => {
              btn.disabled = false;
              btn.textContent = "+";
            }, 900);

            openExistingCartDrawer();
          } catch (error: any) {
            console.error("Quick add failed:", error);
            showToast(error?.message || "Failed to add product to cart.");
            btn.disabled = false;
            btn.textContent = "+";
          }
        });
      });
  } catch (error) {
    console.error("Failed to load related products:", error);
    relatedProductsEl.innerHTML = `<p class="meta">Related products could not be loaded.</p>`;
  }
}

async function initProductDetailsPage(): Promise<void> {
  
  const details = document.getElementById("productDetails");
  if (!details) return;

  const id = getQueryParam("id");

  const titleEl = document.getElementById("productTitle");
  const metaEl = document.getElementById("productMeta");
  const descEl = document.getElementById("productDescription");
  const priceEl = document.getElementById("productPrice");
  const stockEl = document.getElementById("productStock");
  const badgeEl = document.getElementById("productBadge") as HTMLElement | null;
  const imageEl = document.getElementById(
    "productImage"
  ) as HTMLImageElement | null;
  const imageFallback = document.getElementById(
    "productImageFallback"
  ) as HTMLElement | null;
  const thumbnailsEl = document.getElementById(
    "productThumbnails"
  ) as HTMLElement | null;
  const qrDestinationInput = document.getElementById(
    "qrDestination"
  ) as HTMLInputElement | null;
  const addBtn = document.getElementById(
    "productAddToCartBtn"
  ) as HTMLButtonElement | null;

  const quantityValue = document.getElementById("quantityValue");
  const decreaseQty = document.getElementById(
    "decreaseQty"
  ) as HTMLButtonElement | null;
  const increaseQty = document.getElementById(
    "increaseQty"
  ) as HTMLButtonElement | null;

  function updateQuantity(): void {
    if (selectedVariantStock > 0) {
      quantity = Math.min(quantity, selectedVariantStock);
    }

    quantity = Math.max(1, quantity);

    if (quantityValue) {
      quantityValue.textContent = String(quantity);
    }
  }

  decreaseQty?.addEventListener("click", () => {
    quantity = Math.max(1, quantity - 1);
    updateQuantity();
  });

  increaseQty?.addEventListener("click", () => {
    if (selectedVariantStock > 0 && quantity >= selectedVariantStock) {
      quantity = selectedVariantStock;
      updateQuantity();

      showToast(
        `Only ${selectedVariantStock} item${
          selectedVariantStock === 1 ? "" : "s"
        } available in this size.`
      );
      return;
    }

    quantity += 1;
    updateQuantity();
  });

  updateQuantity();

  if (!id) {
    setText(titleEl, "Product not found");
    setText(descEl, "The product link is invalid.");
    if (addBtn) addBtn.style.display = "none";
    return;
  }

  try {
    const product = await getProductById(id);

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.active === false) {
  throw new Error("This product is no longer available.");
}

document.title = `${product.title} | Skanare`;



const description =
  product.shortDescription ||
  product.description ||
  "QR clothing and accessories by Skanare.";

let meta = document.querySelector<HTMLMetaElement>("meta[name='description']");

if (!meta) {
  meta = document.createElement("meta");
  meta.name = "description";
  document.head.appendChild(meta);
}

meta.content = description;

const productUrl = window.location.href;
let canonical = document.querySelector<HTMLLinkElement>(
  'link[rel="canonical"]'
);

if (!canonical) {
  canonical = document.createElement("link");
  canonical.rel = "canonical";
  document.head.appendChild(canonical);
}

canonical.href = productUrl;
const productImage =
  product.images?.[0] ||
  product.image ||
  "https://skanare.com/assets/img/logo_Image.png";

setMetaName("description", description);

setMetaProperty("og:title", `${product.title} | Skanare`);
setMetaProperty("og:description", description);
setMetaProperty("og:image", productImage);
setMetaProperty("og:url", productUrl);
setMetaProperty("og:type", "product");

setMetaName("twitter:title", `${product.title} | Skanare`);
setMetaName("twitter:description", description);
setMetaName("twitter:image", productImage);

injectProductSchema(product);

    setText(titleEl, product.title);
    setText(
      metaEl,
      product.category === "tshirt"
        ? "T-Shirt • Custom editable QR"
        : "Accessory • Custom editable QR"
    );
    setText(descEl, product.description || product.shortDescription || "");
    setText(priceEl, formatPrice(product.price));
    setText(stockEl, isInStock(product) ? "In stock" : "Out of stock");

    if (badgeEl && product.badge) {
      badgeEl.hidden = false;
      badgeEl.textContent = product.badge;
    } else if (badgeEl) {
      badgeEl.hidden = true;
      badgeEl.textContent = "";
    }

    const productImages = unique([...(product.images || []), product.image]);
    const firstImage = productImages[0] || "";

    const setMainImage = (src: string): void => {
      if (!imageEl || !src) return;

      imageEl.src = src;
      imageEl.alt = product.title;
      imageEl.hidden = false;

      if (imageFallback) imageFallback.hidden = true;

      thumbnailsEl
        ?.querySelectorAll<HTMLButtonElement>(".product-thumbnail")
        .forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.src === src);
        });
    };

    if (firstImage) {
      setMainImage(firstImage);
    } else if (imageFallback) {
      imageFallback.hidden = false;
      if (imageEl) imageEl.hidden = true;
    }

    if (thumbnailsEl && productImages.length > 1) {
      thumbnailsEl.hidden = false;
      thumbnailsEl.innerHTML = productImages
        .map(
          (src, index) => `
            <button
              type="button"
              class="product-thumbnail ${index === 0 ? "active" : ""}"
              data-src="${src}"
            >
              <img src="${src}" alt="${product.title} photo ${index + 1}" />
            </button>
          `
        )
        .join("");

      thumbnailsEl
        .querySelectorAll<HTMLButtonElement>(".product-thumbnail")
        .forEach((btn) => {
          btn.addEventListener("click", () =>
            setMainImage(btn.dataset.src || "")
          );
        });
    } else if (thumbnailsEl) {
      thumbnailsEl.hidden = true;
      thumbnailsEl.innerHTML = "";
    }

    const reviews = getFallbackReviews(product);
    renderReviews(reviews);

    const getSelectedVariant = setupVariantControls(product);
    selectedVariantStock = getSelectedVariant()?.stock ?? product.stock ?? 0;
    updateQuantity();

    await renderRelatedProducts(product);

    if (addBtn) {
      addBtn.disabled = !isInStock(product);

      addBtn.addEventListener("click", async () => {
        const rawQrDestination = qrDestinationInput?.value.trim() || "";
        let qrDestination = rawQrDestination || "https://skanare.com";

        if (!rawQrDestination) {
          showToast("Don’t forget to add your own QR URL later.");
        } else if (/^https?:\/\//i.test(rawQrDestination)) {
          try {
            new URL(rawQrDestination);
          } catch {
            showToast(
              "Please enter a valid URL, for example https://example.com"
            );
            qrDestinationInput?.focus();
            return;
          }
        }

        const selectedVariant = getSelectedVariant();

        if (!isInStock(product, selectedVariant)) {
          showToast("This variant is out of stock.");
          return;
        }

        const availableStock =
          selectedVariant?.stock ?? product.stock ?? selectedVariantStock;

        if (availableStock > 0 && quantity > availableStock) {
          quantity = availableStock;
          updateQuantity();

          showToast(
            `Only ${availableStock} item${
              availableStock === 1 ? "" : "s"
            } available in this size.`
          );
          return;
        }

        try {
          addBtn.disabled = true;
          addBtn.textContent = "Adding...";

          await addCartItem({
            productId: product.id,
            quantity,
            variant: selectedVariant || null,
            qrDestination,
          });

          await updateCartBadge();

          addBtn.textContent = "Added to cart!";
          addBtn.classList.remove("btn-primary");
          addBtn.classList.add("btn-outline");

          setTimeout(() => {
            addBtn.disabled = false;
            addBtn.textContent = "Add to cart";
            addBtn.classList.add("btn-primary");
            addBtn.classList.remove("btn-outline");
          }, 900);

          openExistingCartDrawer();
        } catch (error: any) {
          console.error("Failed to add product to cart:", error);
          showToast(error?.message || "Failed to add product to cart.");
          addBtn.disabled = false;
          addBtn.textContent = "Add to cart";
        }
      });
    }
  } catch (error: any) {
    console.error("Failed to load product:", error);

    setText(titleEl, "Error loading product");
    setText(metaEl, "");
    setText(descEl, error?.message || "Failed to load product details.");
    setText(priceEl, "");
    setText(stockEl, "");

    if (addBtn) addBtn.style.display = "none";
  }
}

void initProductDetailsPage();



function injectProductSchema(product: any): void {
  const old = document.getElementById("productJsonLd");
  old?.remove();

  const script = document.createElement("script");
  script.id = "productJsonLd";
  script.type = "application/ld+json";

  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || product.shortDescription || "",
    image: product.images?.[0] || product.image || "https://skanare.com/assets/img/logo_Image.png",
    brand: {
      "@type": "Brand",
      name: "Skanare"
    },
    offers: {
  "@type": "Offer",
  url: window.location.href,
  price: String(product.price || product.priceEUR || 0),
  priceCurrency: "EUR",
  availability: isInStock(product)
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock",
  seller: {
    "@type": "Organization",
    name: "Skanare"
  }
}
  });

  document.head.appendChild(script);
}

function setMetaProperty(property: string, content: string): void {
  let meta = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`
  );

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }

  meta.content = content;
}

function setMetaName(name: string, content: string): void {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }

  meta.content = content;
}