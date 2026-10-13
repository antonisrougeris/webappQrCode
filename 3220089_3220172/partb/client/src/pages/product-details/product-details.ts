import { trackEcommerceEvent } from "../../services/analytics";
import "../../i18n/auto";
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
  getColorImages,
} from "../../services/products";
import { addCartItem } from "../../services/cart";
import { firebaseAuth } from "../../services/firebase";
import { getOrders } from "../../services/orders";
import { createProductReview, getProductReviews } from "../../services/reviews";

import { showToast } from "../../utils/toast.ts";
import { locale, productPath, t } from "../../i18n/locale";


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

/** PDP display only: keep cart/checkout currency formatting unchanged. */
function formatProductPrice(value: number): string {
  return `€${new Intl.NumberFormat("el-GR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
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
  return productPath(identifier);
}

function getFallbackReviews(_product: Product): ProductReview[] {
  return [];
}

function renderReviews(reviews: ProductReview[]): void {
  const reviewsList = document.getElementById("reviewsList");
  const reviewLinkText = document.getElementById("reviewLinkText");
  const productStars = document.getElementById("productStars");

  if (reviewLinkText) {
    reviewLinkText.textContent = `${reviews.length} reviews`;
    reviewLinkText.dataset.reviewCount = String(reviews.length);
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
          <strong>${safeProductText(review.name)}</strong>
          <div class="review-stars">
            ${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}
          </div>
          <p>${safeProductText(review.comment)}</p>
          ${review.verifiedPurchase ? '<small class="verified-review">Verified purchase</small>' : ""}
        </article>
      `
    )
    .join("");
}

async function setupReviewForm(productId: string): Promise<void> {
  const form = document.getElementById("reviewForm") as HTMLFormElement | null;
  const eligibility = document.getElementById("reviewEligibility");
  if (!form || !eligibility) return;

  const user = firebaseAuth.currentUser;
  if (!user) {
    eligibility.textContent = "Sign in and purchase this product to leave a review.";
    return;
  }

  const orders = await getOrders();
  const hasPurchased = orders.some(
    (order) =>
      order.paymentStatus === "paid" &&
      (
        String(order.fulfillmentStatus || "").toLowerCase() === "completed" ||
        String(order.shipping?.status || "").toLowerCase() === "delivered"
      ) &&
      order.items?.some(
        (item) => String(item.productId || item.id) === String(productId)
      )
  );

  if (!hasPurchased) {
    eligibility.textContent = "A completed purchase is required to leave a review.";
    return;
  }

  form.hidden = false;
  eligibility.textContent = "You purchased this product. Share your experience.";
  const nameInput = form.elements.namedItem("name") as HTMLInputElement | null;
  if (nameInput && !nameInput.value) {
    nameInput.value = user.displayName || user.email?.split("@")[0] || "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const button = form.querySelector<HTMLButtonElement>("button[type='submit']");
    if (button) button.disabled = true;

    try {
      const result = await createProductReview(productId, {
        name: String(data.get("name") || "").trim(),
        rating: Number(data.get("rating") || 0),
        comment: String(data.get("comment") || "").trim(),
      });
      const reviews = await getProductReviews(productId);
      renderReviews(reviews);
      form.reset();
      if (nameInput) nameInput.value = user.displayName || user.email?.split("@")[0] || "";

      eligibility.textContent =
        result.reward?.code
          ? `Your verified review was added. Your 20% code is ${result.reward.code} (also sent by email).`
          : "Your verified review was added.";
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to submit review.");
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function safeProductText(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}


function setupSizeGuideModal(product: Product): void {
  const button = document.getElementById("sizeGuideButton") as HTMLButtonElement | null;
  const mobileButton = document.getElementById("mobileSizeGuideButton") as HTMLButtonElement | null;
  const modal = document.getElementById("sizeGuideModal");
  const image = document.getElementById("sizeGuideImage") as HTMLImageElement | null;
  const title = document.getElementById("sizeGuideModalTitle");
  const closeButton = document.getElementById("sizeGuideClose") as HTMLButtonElement | null;

  const hasSizes =
    product.category === "tshirt" &&
    (product.variants || []).some(
      (variant) => String(variant.size || "").trim().length > 0
    );

  if (!button || !modal || !image || !hasSizes) {
    if (button) button.hidden = true;
    if (mobileButton) mobileButton.hidden = true;
    return;
  }

  button.hidden = false;
  if (mobileButton) mobileButton.hidden = false;

  const close = () => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("size-guide-open");
    button.focus();
  };

  const open = () => {
    image.src =
      locale === "el"
        ? "/assets/img/size-guide-tshirt-el.svg"
        : "/assets/img/size-guide-tshirt-en.svg";
    image.alt =
      locale === "el"
        ? "SKANARE οδηγός μεγεθών T-shirt"
        : "SKANARE T-shirt size guide";

    if (title) {
      title.textContent =
        locale === "el"
          ? "Οδηγός μεγεθών"
          : "Size guide";
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("size-guide-open");
    closeButton?.focus();
  };

  button.addEventListener("click", open);
  mobileButton?.addEventListener("click", open);
  closeButton?.addEventListener("click", close);
  modal
    .querySelector<HTMLElement>("[data-size-guide-close]")
    ?.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !modal.classList.contains("hidden")
    ) {
      close();
    }
  });
}

/** Only exact color AND size may be selected. Never match by size alone. */
function setupVariantControls(
  product: Product,
  onColorChanged: (color: string) => void
): () => ProductVariant | undefined {
  const wrapper = document.getElementById("variantControls") as HTMLElement | null;
  const sizeOptions = document.getElementById("sizeOptions");
  const sizeLabel = document.getElementById("selectedSizeText");
  const colorRow = document.getElementById("productColorRow");
  const colorOptions = document.getElementById("productColorOptions");
  const colorLabel = document.getElementById("selectedColorText");
  const stockEl = document.getElementById("productStock");
  const addButton = document.getElementById("productAddToCartBtn") as HTMLButtonElement | null;
  const variants = product.variants || [];
  if (!wrapper || !variants.length) {
    if (wrapper) wrapper.hidden = true;
    return () => undefined;
  }

  const colors = unique([
    ...(product.colorOptions || []).map(x => x.name),
    ...variants.map(x => x.color),
  ]);
  const selectableColors = colors.length ? colors : [""];
  const firstAvailable = variants.find(v => Number(v.stock || 0) > 0);
  let selectedColor = selectableColors.find(c => c.toLowerCase() === String(product.defaultColor || "").toLowerCase())
    || firstAvailable?.color || selectableColors[0];
  const variantsForColor = () =>
    variants.filter(
      v =>
        String(v.color || "").toLowerCase() ===
        selectedColor.toLowerCase()
    );

  const productHasSizes =
    product.category === "tshirt" &&
    variants.some(
      variant =>
        String(variant.size || "").trim().length > 0
    );

  const sizesForColor = () =>
    unique(variantsForColor().map(v => v.size));

  let selectedSize = "";

  const getSelectedVariant = () => {
    const candidates = variantsForColor();

    if (!productHasSizes) {
      return (
        candidates.find(
          variant => Number(variant.stock || 0) > 0
        ) ||
        candidates[0]
      );
    }

    return selectedSize
      ? candidates.find(
          v => String(v.size || "") === selectedSize
        )
      : undefined;
  };

  function redraw(): void {
    const candidates = variantsForColor();

    if (
      selectedSize &&
      !candidates.some(
        v => String(v.size || "") === selectedSize
      )
    ) {
      selectedSize = "";
    }

    const sizes = sizesForColor();
    if (sizeOptions) {
      sizeOptions.innerHTML = sizes.map(size => {
        const variant = candidates.find(v => v.size === size);
        const available = Number(variant?.stock || 0) > 0;
        return `<button type="button" data-size="${safeProductText(size)}" class="option-btn ${size === selectedSize ? "active" : ""} ${available ? "" : "out-of-stock"}" ${available ? "" : "disabled"} aria-pressed="${size === selectedSize}">${safeProductText(size)}</button>`;
      }).join("");
      sizeOptions.hidden =
        !productHasSizes ||
        !sizes.length;
    }

    const sizeRow =
      wrapper?.querySelector<HTMLElement>(
        ".size-row"
      );

    if (sizeRow) {
      sizeRow.hidden =
        !productHasSizes ||
        !sizes.length;
    }

    if (sizeLabel) {
      sizeLabel.textContent =
        productHasSizes
          ? (
              selectedSize ||
              (
                sizes.length === 1
                  ? "Select"
                  : "Select a size"
              )
            )
          : "";
    }
    if (colorRow) colorRow.hidden = colors.length === 0;
    if (colorLabel) colorLabel.textContent = selectedColor || "Default";
    if (colorOptions) {
      colorOptions.innerHTML = selectableColors.map(color => {
        const option = product.colorOptions?.find(c => c.name.toLowerCase() === color.toLowerCase());
        const available = variants.some(v => String(v.color || "").toLowerCase() === color.toLowerCase() && Number(v.stock || 0) > 0);
        const hex = /^#[0-9a-fA-F]{6}$/.test(option?.hex || "") ? option!.hex :
          ({white:"#ffffff",black:"#111111",natural:"#e7decb"} as Record<string,string>)[color.toLowerCase()] || "#d5d5d5";
        const cover = option?.images?.[0] || "";
        const validCover = cover.startsWith("/") || /^https:\/\//i.test(cover);
        const preview = validCover
          ? `<img class="product-color-swatch__preview" src="${safeProductText(cover)}" alt="" loading="lazy" decoding="async">`
          : "";
        return `<button type="button" class="product-color-swatch ${selectedColor === color ? "is-selected" : ""}" data-product-color="${safeProductText(color)}" aria-label="Color ${safeProductText(color || "Default")}" aria-pressed="${selectedColor === color}" ${available ? "" : "disabled"}>${preview}<span class="product-color-swatch__dot" style="--swatch-color:${hex}"></span><span class="product-color-swatch__label">${safeProductText(color || "Default")}</span></button>`;
      }).join("");
    }
    const variant = getSelectedVariant();
    const availableInColor = candidates.some(
      candidate => Number(candidate?.stock || 0) > 0
    );

    selectedVariantStock = Number(variant?.stock || 0);

    if (
      selectedVariantStock > 0 &&
      quantity > selectedVariantStock
    ) {
      quantity = 1;
    }

    const quantityText = document.getElementById("quantityValue");
    if (quantityText) quantityText.textContent = String(quantity);

    if (stockEl) {
      if (productHasSizes && !selectedSize) {
        stockEl.textContent =
          availableInColor
            ? "Select a size"
            : "Out of stock";

        stockEl.style.color =
          availableInColor
            ? "#6b6b65"
            : "#b42318";
      } else {
        stockEl.textContent =
          selectedVariantStock > 0
            ? "In stock"
            : "Out of stock";

        stockEl.style.color =
          selectedVariantStock > 0
            ? "#129447"
            : "#b42318";
      }
    }

    if (addButton) {
      addButton.disabled = !availableInColor;
    }
  }

  sizeOptions?.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-size]");
    if (!button || button.disabled) return;
    selectedSize = button.dataset.size || "";
    redraw();
  });
  colorOptions?.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-product-color]");
    if (!button || button.disabled) return;
    selectedColor =
      button.dataset.productColor || "";

    if (productHasSizes) {
      selectedSize = "";
    }

    onColorChanged(selectedColor);
    redraw();
  });
  wrapper.hidden = false;
  onColorChanged(selectedColor);
  redraw();
  return getSelectedVariant;
}

async function renderRelatedProducts(currentProduct: Product): Promise<void> {
  const relatedProductsEl = document.getElementById("relatedProducts");
  if (!relatedProductsEl) return;

  try {
    const products = await getProducts();

    const related = products
      .filter(
        (item) =>
          item.id !== currentProduct.id &&
          item.active !== false &&
          item.category === "accessory"
      )
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
              <p class="related-product-price">
                ${
                  Boolean(product.onSale) &&
                  Number(product.originalPrice ?? product.price) > product.price
                    ? `<span class="related-product-price__old">${formatPrice(Number(product.originalPrice))}</span>`
                    : ""
                }
                <span>${formatPrice(product.price)}</span>
              </p>

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

          // Multi-color products require explicit selection on Product Details.
          if (unique((product.variants || []).map(v => v.color)).length > 1) {
            window.location.href = productUrl(product);
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


function getProductIdentifier(): string | null {
  const queryId = getQueryParam("id") || getQueryParam("productId") || getQueryParam("slug");
  if (queryId) return queryId;

  const match = window.location.pathname.match(/\/product\/([^/]+)$/);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  return null;
}

function removeReviewQueryParams(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("name") && !params.has("rating") && !params.has("comment")) {
    return;
  }

  ["name", "rating", "comment"].forEach((key) => params.delete(key));
  const query = params.toString();
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${query ? `?${query}` : ""}`
  );
}

/**
 * One mobile purchase bar. Native size chips remain the source of truth for
 * stock, chosen variant, quantity and the actual add-to-cart operation.
 */
function setupMobileProductPurchase(originalButton: HTMLButtonElement | null): void {
  const bar = document.getElementById("mobilePurchaseBar");
  const buyButton = document.getElementById("mobileAddToCartBtn") as HTMLButtonElement | null;
  const sizeWrap = document.getElementById("mobileSizeWrap") as HTMLElement | null;
  const sizeTrigger = document.getElementById("mobileSizeTrigger") as HTMLButtonElement | null;
  const sizeValue = document.getElementById("mobileSizeValue");
  const sizeMenu = document.getElementById("mobileSizeMenu") as HTMLElement | null;
  const qtyValue = document.getElementById("mobileAccessoryQtyValue");
  const originalQty = document.getElementById("quantityValue");
  const syncAccessoryQty = () => { if (qtyValue && originalQty) qtyValue.textContent = originalQty.textContent || "1"; };
  const accessoryQtyMinus = document.getElementById("mobileAccessoryQtyMinus");
  const accessoryQtyPlus = document.getElementById("mobileAccessoryQtyPlus");
  accessoryQtyMinus?.addEventListener("click", () => { document.getElementById("decreaseQty")?.click(); syncAccessoryQty(); });
  accessoryQtyPlus?.addEventListener("click", () => { document.getElementById("increaseQty")?.click(); syncAccessoryQty(); });
  if (originalQty) new MutationObserver(syncAccessoryQty).observe(originalQty, {childList: true, characterData: true, subtree: true});
  const sizeOptions = document.getElementById("sizeOptions");
  if (!bar || !buyButton || !originalButton || !sizeWrap || !sizeTrigger || !sizeMenu) return;

  const mainCartButton = originalButton;
  // Only a purchase-triggered size selection should auto-add to cart.
  let addOnSizeSelection = false;
  const placeholder = locale === "el" ? "Μέγεθος" : "Size";
  const currentButtons = (): HTMLButtonElement[] =>
    Array.from(sizeOptions?.querySelectorAll<HTMLButtonElement>("button[data-size]") || []);
  const selectedSize = (): string =>
    currentButtons().find(button => button.classList.contains("active"))?.dataset.size || "";

  function closeSizeMenu(restoreFocus = false): void {
    sizeMenu!.hidden = true;
    sizeTrigger!.setAttribute("aria-expanded", "false");
    // Dismissing the picker must discard any pending purchase intent.
    addOnSizeSelection = false;
    if (restoreFocus) sizeTrigger!.focus();
  }

  function openSizeMenu(): void {
    if (sizeWrap!.hidden) return;
    sizeMenu!.hidden = false;
    sizeTrigger!.setAttribute("aria-expanded", "true");
    const options = Array.from(sizeMenu!.querySelectorAll<HTMLButtonElement>("[role='option']:not(:disabled)"));
    (options.find(option => option.getAttribute("aria-selected") === "true") || options[0])?.focus();
  }

  function syncSizeOptions(): void {
    const buttons = currentButtons();
    if (!buttons.length || sizeOptions?.hidden) {
      sizeWrap!.hidden = true;
      closeSizeMenu();
      return;
    }
    sizeWrap!.hidden = false;
    const chosen = selectedSize();
    if (sizeValue) sizeValue.textContent = chosen || placeholder;
    sizeTrigger!.setAttribute("aria-label",
      chosen ? (locale === "el" ? "Μέγεθος " : "Size ") + chosen
             : (locale === "el" ? "Επιλογή μεγέθους" : "Choose size"));

    const entries = buttons.map(button => {
      const size = button.dataset.size || "";
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mobile-purchase-bar__size-option";
      item.dataset.mobileSize = size;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(chosen === size));
      item.setAttribute("aria-disabled", String(button.disabled));
      item.tabIndex = -1;
      item.textContent = size;
      item.disabled = button.disabled;
      if (chosen === size) item.classList.add("is-selected");
      return item;
    });
    sizeMenu!.replaceChildren(...entries);
  }

  function syncPurchaseState(): void {
    buyButton!.disabled = mainCartButton.disabled;
    const label = buyButton!.querySelector<HTMLElement>("[data-mobile-buy-label]");
    if (label) label.textContent = mainCartButton.textContent?.trim() ||
      t("product.addToCart", "Add to cart");
  }

  sizeTrigger.addEventListener("click", () => {
    // A manually opened size menu is never a request to purchase.
    addOnSizeSelection = false;
    if (sizeMenu.hidden) openSizeMenu();
    else closeSizeMenu(true);
  });
  sizeMenu.addEventListener("click", event => {
    const option = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-mobile-size]");
    if (!option || option.disabled) return;
    const original = currentButtons().find(button =>
      button.dataset.size === option.dataset.mobileSize && !button.disabled);
    if (!original) return;
    const shouldAddToCart = addOnSizeSelection;
    original.click();
    closeSizeMenu(true);
    syncSizeOptions();
    syncPurchaseState();
    // The native variant handler synchronously updates the selected variant.
    // Forward the original purchase once, only when Add to cart opened the picker.
    if (shouldAddToCart && selectedSize() === option.dataset.mobileSize && !mainCartButton.disabled) {
      mainCartButton.click();
    }
  });
  sizeMenu.addEventListener("keydown", event => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" &&
        event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const options = Array.from(sizeMenu.querySelectorAll<HTMLButtonElement>("[role='option']:not(:disabled)"));
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const target = event.key === "Home" ? 0 :
      event.key === "End" ? options.length - 1 :
      (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[target]?.focus();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !sizeMenu.hidden) {
      event.preventDefault();
      closeSizeMenu(true);
    }
  });
  document.addEventListener("pointerdown", event => {
    if (!sizeWrap.contains(event.target as Node) && !sizeMenu.hidden) closeSizeMenu();
  });

  buyButton.addEventListener("click", () => {
    // A size is mandatory for clothing: open this dropdown, never scroll to hidden chips.
    if (!sizeWrap.hidden && !selectedSize()) {
      addOnSizeSelection = true;
      openSizeMenu();
      return;
    }
    if (!mainCartButton.disabled) {
      closeSizeMenu();
      mainCartButton.click();
    }
  });

  // Original variant rendering also runs when changing color. Keep menu and
  // selection in sync, including newly unavailable sizes.
  if (sizeOptions) {
    new MutationObserver(syncSizeOptions).observe(sizeOptions, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "class", "hidden"]
    });
  }
  new MutationObserver(syncPurchaseState).observe(mainCartButton, {
    attributes: true, attributeFilter: ["disabled"], childList: true, characterData: true, subtree: true
  });

  bar.hidden = false;
  bar.classList.remove("is-loading");
  bar.setAttribute("aria-busy", "false");
  sizeTrigger.disabled = false;
  syncSizeOptions();
  syncPurchaseState();
}

async function initProductDetailsPage(): Promise<void> {
  removeReviewQueryParams();
  
  const details = document.getElementById("productDetails");
  if (!details) return;

const id = getProductIdentifier();

  const titleEl = document.getElementById("productTitle");
  const metaEl = document.getElementById("productMeta");
  const descEl = document.getElementById("productDescription");
  const priceEl = document.getElementById("productPrice");
  const stockEl = document.getElementById("productStock");
  const badgeEl = document.getElementById("productBadge") as HTMLElement | null;
  const saleBadgeEl = document.getElementById("productSaleBadge") as HTMLElement | null;
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
        } available in the selected color and size.`
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
    const purchaseBar = document.getElementById("mobilePurchaseBar");
    if (purchaseBar) purchaseBar.hidden = true;
    return;
  }

  try {
    const product = await getProductById(id);

    if (!product) {
      throw new Error("Product not found");
    }

    const confirmedProduct: Product = product;

    if (product.active === false) {
  throw new Error("This product is no longer available.");
}

document.title = `${product.title} | Skanare`;



const description =
  product.shortDescription ||
  product.description ||
  "QR clothing and accessories by Skanare.";


const productIdentifier = product.slug || product.id;
const productUrl = new URL(
  productPath(productIdentifier),
  window.location.origin
).href;

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

    setText(titleEl, product.title);
    setText(
      metaEl,
      product.category === "tshirt"
        ? "T-Shirt • Custom editable QR"
        : "Accessory • Custom editable QR"
    );
    setText(descEl, product.description || product.shortDescription || "");

    const eco = document.getElementById("pdpEcoHighlights");
    if (eco) eco.hidden = product.category !== "tshirt";
    const facts = document.getElementById("pdpProductFacts");
    if (facts) {
      const isClothing = product.category === "tshirt";
      facts.hidden = !isClothing;
      if (isClothing) {
        const messages = locale === "el"
          ? ["100% οργανικό βαμβάκι", "Ανθεκτική και ποιοτική εκτύπωση QR", "Άνετη unisex εφαρμογή"]
          : ["100% organic cotton", "High-quality, durable QR print", "Comfortable unisex fit"];
        facts.replaceChildren(...messages.map((message) => {
          const li = document.createElement("li");
          li.textContent = message;
          return li;
        }));
      }
    }
    setText(document.getElementById("pdpProductInfoTitle"),
      locale === "el" ? "Πληροφορίες προϊόντος" : "Product Information");

    // The product's existing category determines the breadcrumb; no hardcoded product data.
    const breadcrumbShop = document.getElementById("pdpBreadcrumbShop") as HTMLAnchorElement | null;
    const breadcrumbCategory = document.getElementById("pdpBreadcrumbCategory") as HTMLAnchorElement | null;
    if (breadcrumbShop) {
      breadcrumbShop.href = locale === "el" ? "/el/products" : "/products";
      breadcrumbShop.textContent = locale === "el" ? "Κατάστημα" : "Shop";
    }
    if (breadcrumbCategory) {
      const group = product.category === "tshirt" ? "tshirt" : "accessory";
      breadcrumbCategory.href = `${locale === "el" ? "/el/products" : "/products"}?category=${group}`;
      breadcrumbCategory.textContent = group === "tshirt"
        ? (locale === "el" ? "Ρούχα QR" : "QR Clothing")
        : (locale === "el" ? "Αξεσουάρ QR" : "QR Accessories");
    }
    setText(document.getElementById("pdpBreadcrumbProduct"), product.title);

    const originalPrice = Number(product.originalPrice ?? product.price);
    const onSale = Boolean(product.onSale) && originalPrice > product.price;

    if (priceEl) {
      priceEl.innerHTML = onSale
        ? `<span class="product-price__old">${formatProductPrice(originalPrice)}</span><span class="product-price__current">${formatProductPrice(product.price)}</span>`
        : `<span class="product-price__current">${formatProductPrice(product.price)}</span>`;
    }

    setText(stockEl, isInStock(product) ? "In stock" : "Out of stock");

    if (saleBadgeEl && onSale) {
      saleBadgeEl.hidden = false;
      saleBadgeEl.textContent = `${t("sale.save", "Save")} ${formatProductPrice(Math.round((originalPrice - product.price) * 100) / 100)}`;
    } else if (saleBadgeEl) {
      saleBadgeEl.hidden = true;
      saleBadgeEl.textContent = "";
    }

    // On mobile the crossed-out original price sits opposite the reviews.
    const reviewOldPrice = document.getElementById("mobileReviewOldPrice");
    if (reviewOldPrice) {
      reviewOldPrice.hidden = !onSale;
      reviewOldPrice.textContent = onSale ? formatProductPrice(originalPrice) : "";
    }
    priceEl?.classList.toggle("is-discounted", onSale);

    if (badgeEl && product.badge) {
      badgeEl.hidden = false;
      badgeEl.textContent = product.badge;
    } else if (badgeEl) {
      badgeEl.hidden = true;
      badgeEl.textContent = "";
    }

    // Reuse existing badge data, presenting both merchandising tag and savings
    // only inside the mobile gallery. Desktop badges are untouched.
    const galleryBadge = document.getElementById("mobileGalleryBadge");
    if (galleryBadge) {
      galleryBadge.hidden = !badgeEl || badgeEl.hidden;
      galleryBadge.textContent = badgeEl?.textContent || "";
    }
    const gallerySave = document.getElementById("mobileGallerySave");
    if (gallerySave) {
      gallerySave.hidden = !onSale;
      gallerySave.textContent = onSale
        ? `${t("sale.save", "Save")} ${formatProductPrice(Math.round((originalPrice - product.price) * 100) / 100)}`
        : "";
    }

    /* =========================================================
   PRODUCT IMAGE GALLERY
   ========================================================= */

let productImages = unique([
  ...(product.images || []),
  product.image,
]);

const firstImage = productImages[0] || "";

const imageStage = document.getElementById(
  "productImageStage"
) as HTMLElement | null;

const imageViewport =
  document.getElementById(
    "productImageViewport"
  ) as HTMLElement | null;

const prevImageBtn = document.getElementById(
  "productImagePrev"
) as HTMLButtonElement | null;

const nextImageBtn = document.getElementById(
  "productImageNext"
) as HTMLButtonElement | null;

let currentImageIndex = 0;


/* -------------------------
   SET MAIN IMAGE
------------------------- */

const setMainImage = (src: string): void => {
  if (!imageEl || !src) return;

  const index = productImages.indexOf(src);

  if (index >= 0) {
    currentImageIndex = index;
  }

  imageEl.src = src;
  imageEl.alt = product.title;
  const mobileCount = document.getElementById("mobileGalleryCount");
  if (mobileCount) mobileCount.textContent = `${currentImageIndex + 1} / ${productImages.length}`;
  imageEl.hidden = false;

  /* Reset zoom when changing image */
  imageEl.style.transform = "scale(1)";
  imageEl.style.transformOrigin = "center center";

  imageStage?.classList.remove("is-zooming");

  if (imageFallback) {
    imageFallback.hidden = true;
  }

  thumbnailsEl
    ?.querySelectorAll<HTMLButtonElement>(
      ".product-thumbnail"
    )
    .forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.src === src
      );
    });
};


/* -------------------------
   CHANGE IMAGE BY INDEX
------------------------- */

const showImageAtIndex = (index: number): void => {
  if (productImages.length === 0) return;

  currentImageIndex =
    (index + productImages.length) %
    productImages.length;

  setMainImage(
    productImages[currentImageIndex]
  );
};


const showPreviousImage = (): void => {
  showImageAtIndex(currentImageIndex - 1);
};


const showNextImage = (): void => {
  showImageAtIndex(currentImageIndex + 1);
};


/* -------------------------
   FIRST IMAGE
------------------------- */

if (firstImage) {
  setMainImage(firstImage);
} else if (imageFallback) {
  imageFallback.hidden = false;

  if (imageEl) {
    imageEl.hidden = true;
  }
}


/* -------------------------
   SHOW / HIDE ARROWS
------------------------- */

const hasMultipleImages =
  productImages.length > 1;

if (prevImageBtn) {
  prevImageBtn.hidden = !hasMultipleImages;
}

if (nextImageBtn) {
  nextImageBtn.hidden = !hasMultipleImages;
}


/* -------------------------
   ARROW BUTTONS
------------------------- */

prevImageBtn?.addEventListener(
  "click",
  (event) => {
    event.preventDefault();
    event.stopPropagation();

    showPreviousImage();
  }
);


nextImageBtn?.addEventListener(
  "click",
  (event) => {
    event.preventDefault();
    event.stopPropagation();

    showNextImage();
  }
);


/* Color-specific galleries rebuild thumbnails and keep existing zoom/arrows. */
function renderProductThumbnails(): void {
  const multiple = productImages.length > 1;
  if (prevImageBtn) prevImageBtn.hidden = !multiple;
  if (nextImageBtn) nextImageBtn.hidden = !multiple;
  if (!thumbnailsEl) return;
  thumbnailsEl.hidden = !multiple;
  thumbnailsEl.innerHTML = multiple ? productImages.map((src, index) => `
    <button type="button" class="product-thumbnail ${index === currentImageIndex ? "active" : ""}"
      data-image-index="${index}" data-src="${safeProductText(src)}" aria-label="Show product photo ${index + 1}">
<img src="${safeProductText(src)}" alt="${safeProductText(confirmedProduct.title)} photo ${index + 1}" />
    </button>`).join("") : "";
}
function switchGalleryForColor(color: string): void {
productImages = unique(
  getColorImages(confirmedProduct, color)
);
  currentImageIndex = 0;
  renderProductThumbnails();
  if (productImages.length) setMainImage(productImages[0]);
  else {
    if (imageEl) imageEl.hidden = true;
    if (imageFallback) imageFallback.hidden = false;
  }
  if (productImages[0]) {
    setMetaProperty("og:image", new URL(productImages[0], window.location.origin).href);
    setMetaName("twitter:image", new URL(productImages[0], window.location.origin).href);
  }
}
renderProductThumbnails();

// Horizontal gestures browse photos on touch devices; vertical swipes still scroll.
if (imageStage) {
  let touchX = 0;
  let touchY = 0;
  imageStage.addEventListener("touchstart", (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    touchX = event.touches[0].clientX;
    touchY = event.touches[0].clientY;
  }, { passive: true });
  imageStage.addEventListener("touchend", (event: TouchEvent) => {
    if (productImages.length <= 1 || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touchX;
    const dy = event.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    if (dx < 0) showNextImage();
    else showPreviousImage();
  }, { passive: true });
}
thumbnailsEl?.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-image-index]");
  if (!button) return;
  showImageAtIndex(Number(button.dataset.imageIndex || 0));
});

/* =========================================================
   DESKTOP ZOOM
   ONLY OVER THE REAL VISIBLE IMAGE
   ========================================================= */

function resetProductZoom(): void {
  if (!imageEl || !imageViewport) return;

  imageEl.style.transform =
    "scale(1)";

  imageEl.style.transformOrigin =
    "center center";

  imageViewport.classList.remove(
    "is-zooming"
  );

  imageViewport.style.cursor =
    "default";
}


function getVisibleImageRect() {
  if (
    !imageEl ||
    !imageViewport ||
    !imageEl.naturalWidth ||
    !imageEl.naturalHeight
  ) {
    return null;
  }

  const container =
    imageViewport.getBoundingClientRect();

  const naturalWidth =
    imageEl.naturalWidth;

  const naturalHeight =
    imageEl.naturalHeight;

  /*
   * Same calculation as object-fit: contain
   */
  const scale = Math.min(
    container.width / naturalWidth,
    container.height / naturalHeight
  );

  const width =
    naturalWidth * scale;

  const height =
    naturalHeight * scale;

  const left =
    container.left +
    (container.width - width) / 2;

  const top =
    container.top +
    (container.height - height) / 2;

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}


if (
  imageViewport &&
  imageEl
) {

  imageViewport.addEventListener(
    "mousemove",
    (event) => {

      if (
        !window.matchMedia(
          "(hover: hover) and (pointer: fine)"
        ).matches
      ) {
        return;
      }

      if (imageEl.hidden) {
        return;
      }

      const imageRect =
        getVisibleImageRect();

      if (!imageRect) {
        resetProductZoom();
        return;
      }

      /*
       * Is the mouse REALLY over
       * the visible photo?
       */
      const insideImage =
        event.clientX >= imageRect.left &&
        event.clientX <= imageRect.right &&
        event.clientY >= imageRect.top &&
        event.clientY <= imageRect.bottom;

      /*
       * Mouse is inside the container,
       * but NOT over the real photo.
       */
      if (!insideImage) {
        resetProductZoom();
        return;
      }


      /*
       * Now we're actually over
       * visible image pixels.
       */

      imageViewport.classList.add(
        "is-zooming"
      );

      imageViewport.style.cursor =
        "zoom-in";


      const x =
        ((event.clientX -
          imageRect.left) /
          imageRect.width) *
        100;

      const y =
        ((event.clientY -
          imageRect.top) /
          imageRect.height) *
        100;


      imageEl.style.transformOrigin =
        `${x}% ${y}%`;

      imageEl.style.transform =
        "scale(2)";
    }
  );


  imageViewport.addEventListener(
    "mouseleave",
    () => {
      resetProductZoom();
    }
  );
}


/* =========================================================
   KEYBOARD LEFT / RIGHT
   ========================================================= */

if (imageStage) {

  imageStage.setAttribute(
    "tabindex",
    "0"
  );

  imageStage.addEventListener(
    "keydown",
    (event) => {

      if (productImages.length <= 1) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousImage();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextImage();
      }
    }
  );
}

    // Purchase controls are initialized before any secondary network requests.
    trackEcommerceEvent("view_item", [{
      item_id: String(product.id), item_name: String(product.title || ""),
      price: Number(product.priceEUR ?? product.price ?? 0), quantity: 1
    }]);
    setupSizeGuideModal(product);
    const getSelectedVariant = setupVariantControls(product, switchGalleryForColor);
    setupMobileProductPurchase(addBtn);
    const accessoryMode = product.category === "accessory";
    const accessoryQuantity = document.getElementById("mobileAccessoryQuantity");
    const mobileSize = document.getElementById("mobileSizeWrap");
    if (accessoryQuantity && mobileSize) {
      accessoryQuantity.hidden = !accessoryMode;
      if (accessoryMode) mobileSize.hidden = true;
    }
    updateQuantity();

    if (addBtn) {
      // setupVariantControls already calculated availability for the selected color.
      // Do not overwrite it with product-wide stock on products with variants.
      if (!(product.variants || []).length) addBtn.disabled = !isInStock(product);

      addBtn.addEventListener("click", async () => {
        const selectedVariant =
          getSelectedVariant();

        const requiresSizeSelection =
          product.category === "tshirt" &&
          (product.variants || []).some(
            variant =>
              String(
                variant.size || ""
              ).trim().length > 0
          );

        if (
          requiresSizeSelection &&
          !selectedVariant
        ) {
          const originalText =
            addBtn.textContent ||
            "Add to cart";

          addBtn.textContent =
            t("product.chooseSize", "Choose a size");

          document
            .getElementById(
              "sizeOptions"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });

          window.setTimeout(() => {
            addBtn.textContent =
              originalText;
          }, 1200);

          return;
        }

        const rawQrDestination =
          qrDestinationInput?.value.trim() ||
          "";

        const qrDestination =
          rawQrDestination ||
          "https://skanare.com";

        if (
          rawQrDestination &&
          /^https?:\/\//i.test(
            rawQrDestination
          )
        ) {
          try {
            new URL(
              rawQrDestination
            );
          } catch {
            showToast(
              "Please enter a valid URL, for example https://example.com"
            );

            qrDestinationInput?.focus();
            return;
          }
        }

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
            } available in the selected color and size.`
          );
          return;
        }

        try {
          addBtn.disabled = true;
          addBtn.textContent = t("product.adding", "Adding...");

          await addCartItem({
            productId: product.id,
            quantity,
            variant: selectedVariant || null,
            qrDestination,
          });

          await updateCartBadge();

          if (!rawQrDestination) {
            showToast(
              "Add your link or upload a photo from My QR Codes after purchase.",
              {
                placement:
                  "cart-reminder",
              }
            );
          }

          addBtn.textContent =
            t("product.added", "Added to cart!");

          setTimeout(() => {
            addBtn.disabled =
              !isInStock(
                product,
                getSelectedVariant()
              );

            addBtn.textContent =
              t("product.addToCart", "Add to cart");
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

    // Non-critical requests run AFTER cart handlers are attached. Neither
    // reviews nor recommendations should delay the size picker / CTA.
    void (async () => {
      try {
        const reviews = await getProductReviews(product.id);
        renderReviews(reviews.length ? reviews : getFallbackReviews(product));
        await setupReviewForm(product.id);
      } catch (reviewError) {
        console.error("Failed to load reviews:", reviewError);
        renderReviews(getFallbackReviews(product));
      }
    })();
    void renderRelatedProducts(product);
  } catch (error: any) {
    console.error("Failed to load product:", error);
    const purchaseBar = document.getElementById("mobilePurchaseBar");
    if (purchaseBar) purchaseBar.hidden = true;

    setText(titleEl, "Error loading product");
    setText(metaEl, "");
    setText(descEl, error?.message || "Failed to load product details.");
    setText(priceEl, "");
    setText(stockEl, "");

    if (addBtn) addBtn.style.display = "none";
  }
}

void initProductDetailsPage();



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


