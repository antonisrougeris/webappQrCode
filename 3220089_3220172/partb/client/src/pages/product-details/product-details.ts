/* 3220089_3220172  2025 */

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";

initNav();
initMobileMenu();

let selectedVariantStock = 0;
let quantity = 1;

interface ProductVariant {
  size?: string;
  color?: string;
  stock?: number;
}

interface Review {
  name: string;
  rating: number;
  comment: string;
}

interface Product {
  _id?: string;
  id: string;
  title: string;
  shortDescription?: string;
  description?: string;
  category: string;
  priceEUR: number;
  image?: string;
  images?: string[];
  badge?: string;
  variants?: ProductVariant[];
  stock?: number;
  active?: boolean;
  reviews?: Review[];
}

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "http://localhost:4000/api";

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

async function getProductById(id: string): Promise<Product> {
  const response = await fetch(`${API_BASE}/products/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(response.status === 404 ? "Product not found" : `Product request failed (${response.status})`);
  }

  return response.json();
}

async function getAllProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE}/products`);

  if (!response.ok) {
    throw new Error(`Products request failed (${response.status})`);
  }

  return response.json();
}

const CART_KEY = "skanare_cart";

function getLocalCart(): any[] {
  const raw = localStorage.getItem(CART_KEY);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCart(items: any[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function showToast(message: string): void {
  let stack = document.getElementById("toastStack");

  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (stack && stack.children.length === 0) stack.remove();
  }, 3600);
}

function openExistingCartDrawer(): void {
  const cartLink = document.querySelector<HTMLElement>("[data-cart-link], .cart-link");
  cartLink?.click();
}

function addProductToLocalCart(payload: {
  product: Product;
  quantity: number;
  selectedVariant?: ProductVariant;
  qrDestination?: string;
}): void {
  const cart = getLocalCart();

  const productId = payload.product._id || payload.product.id;
  const image = getProductImage(payload.product);

  const existingIndex = cart.findIndex((item) => {
    return (
      item.productId === productId &&
      item.selectedVariant?.size === payload.selectedVariant?.size &&
      item.qrDestination === payload.qrDestination
    );
  });

  if (existingIndex >= 0) {
    cart[existingIndex].quantity += payload.quantity;
  } else {
    cart.push({
      productId,
      title: payload.product.title,
      priceEUR: payload.product.priceEUR,
      image,
      quantity: payload.quantity,
      selectedVariant: payload.selectedVariant,
      qrDestination: payload.qrDestination,
    });
  }

  saveLocalCart(cart);
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

function setupVariantControls(product: Product): () => ProductVariant | undefined {
  const wrapper = document.getElementById("variantControls") as HTMLElement | null;
  const sizeOptions = document.getElementById("sizeOptions");
  const selectedSizeText = document.getElementById("selectedSizeText");
  const stockEl = document.getElementById("productStock");

  const variants = product.variants || [];

  if (!wrapper || variants.length === 0) {
    if (wrapper) wrapper.hidden = true;
    return () => undefined;
  }


const sizes = unique(variants.map(v => v.size));

const firstAvailable = variants.find(
  v => (v.stock ?? 0) > 0
);

let selectedSize =
  firstAvailable?.size ||
  sizes[0];
  function getStock(size: string) {
    const v = variants.find(x => x.size === size);
    return v?.stock ?? 0;
  }

  function isSizeOut(size: string) {
    return getStock(size) <= 0;
  }

  function getSelectedVariant(): ProductVariant | undefined {
    return variants.find(v => v.size === selectedSize);
  }
  function updateStock() {
  const variant = getSelectedVariant();
  selectedVariantStock = variant?.stock ?? product.stock ?? 0;
}

  function updateUI() {

    updateStock();
    if (selectedSizeText) selectedSizeText.textContent = selectedSize;

    document.querySelectorAll<HTMLButtonElement>("[data-size]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.size === selectedSize);
    });

    const variant = getSelectedVariant();

if ((variant?.stock ?? 0) <= 0) {
  quantity = 1;
}
    if (!stockEl) return;

    const allOut = variants.every(v => v.stock === 0);

    if (allOut) {
      stockEl.textContent = "Out of stock";
      stockEl.style.color = "red";
    } else {
      stockEl.textContent = isInStock(product, variant) ? "In stock" : "Out of stock";
      stockEl.style.color = "#129447";
    }



  }


  if (sizeOptions) {
    sizeOptions.innerHTML = sizes.map(size => {
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
    }).join("");
  }

  document.querySelectorAll<HTMLButtonElement>("[data-size]").forEach(btn => {
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

function getFallbackReviews(product: Product): Review[] {
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

function renderReviews(reviews: Review[]): void {
  const reviewsList = document.getElementById("reviewsList");
  const reviewLinkText = document.getElementById("reviewLinkText");
  const productStars = document.getElementById("productStars");

  if (reviewLinkText) {
    reviewLinkText.textContent = `${reviews.length} reviews`;
  }

  if (productStars) {
    const average =
      reviews.length > 0
        ? Math.round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length)
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

async function renderRelatedProducts(currentProduct: Product): Promise<void> {
  const relatedProductsEl = document.getElementById("relatedProducts");
  if (!relatedProductsEl) return;

  try {
    const products = await getAllProducts();

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
        const productId = product._id || product.id;

        return `
          <a href="/src/pages/product-details/product-details.html?id=${encodeURIComponent(product.id)}"
   class="related-product-card">

  <div class="related-product-image">
    ${
      image
        ? `<img src="${image}" alt="${product.title}" />`
        : `<div class="related-product-fallback mini-shirt"></div>`
    }
  </div>

  <div class="related-product-body">
    <h3>${product.title}</h3>
    <p>${formatPrice(product.priceEUR)}</p>

    <button
      type="button"
      class="quick-add-btn"
      data-product-id="${productId}"
      aria-label="Quick add ${product.title} to cart"
    >
      +
    </button>
  </div>

</a>
        `;
      })
      .join("");

    relatedProductsEl.querySelectorAll<HTMLButtonElement>(".quick-add-btn").forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const productId = btn.dataset.productId;
        const product = related.find((item) => (item._id || item.id) === productId);

        if (!product || !isInStock(product)) {
          showToast("This product is out of stock.");
          return;
        }

        const selectedVariant = product.variants?.find((variant) => Number(variant.stock || 0) > 0);

        addProductToLocalCart({
          product,
          quantity: 1,
          selectedVariant,
          qrDestination: "https://skanare.com",
        });

        await updateCartBadge();

        btn.classList.add("added");
        btn.textContent = "✓";

        openExistingCartDrawer();
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

  let maxStock = 0;
  const titleEl = document.getElementById("productTitle");
  const metaEl = document.getElementById("productMeta");
  const descEl = document.getElementById("productDescription");
  const priceEl = document.getElementById("productPrice");
  const stockEl = document.getElementById("productStock");
  const badgeEl = document.getElementById("productBadge") as HTMLElement | null;
  const imageEl = document.getElementById("productImage") as HTMLImageElement | null;
  const imageFallback = document.getElementById("productImageFallback") as HTMLElement | null;
  const thumbnailsEl = document.getElementById("productThumbnails") as HTMLElement | null;
  const qrDestinationInput = document.getElementById("qrDestination") as HTMLInputElement | null;
  const addBtn = document.getElementById("productAddToCartBtn") as HTMLButtonElement | null;

  const quantityValue = document.getElementById("quantityValue");
  const decreaseQty = document.getElementById("decreaseQty") as HTMLButtonElement | null;
  const increaseQty = document.getElementById("increaseQty") as HTMLButtonElement | null;

  function updateQuantity(): void {
    if (selectedVariantStock > 0) quantity = Math.min(quantity, selectedVariantStock);
    quantity = Math.max(1, quantity);
    if (quantityValue) quantityValue.textContent = String(quantity);
  }

  decreaseQty?.addEventListener("click", () => {
    quantity = Math.max(1, quantity - 1);
    updateQuantity();
  });

  increaseQty?.addEventListener("click", () => {
    if (selectedVariantStock > 0 && quantity >= selectedVariantStock) {
      quantity = selectedVariantStock;
      updateQuantity();
      showToast(`Only ${selectedVariantStock} item${selectedVariantStock === 1 ? "" : "s"} available in this size.`);
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

    if (product.active === false) {
      throw new Error("This product is no longer available.");
    }

    setText(titleEl, product.title);
    setText(
      metaEl,
      product.category === "tshirt"
        ? "T-Shirt • Custom editable QR"
        : "Accessory • Custom editable QR"
    );
    setText(descEl, product.description || product.shortDescription || "");
    setText(priceEl, formatPrice(product.priceEUR));
    setText(stockEl, isInStock(product) ? "In stock" : "Out of stock");

    if (badgeEl && product.badge) {
      badgeEl.hidden = false;
      badgeEl.textContent = product.badge;
    } else if (badgeEl) {
      badgeEl.hidden = true;
      badgeEl.textContent = "";
    }

    const productImages = unique([...(product.images || []), product.image]);
    const image = productImages[0] || "";

    const setMainImage = (src: string): void => {
      if (!imageEl || !src) return;
      imageEl.src = src;
      imageEl.alt = product.title;
      imageEl.hidden = false;
      if (imageFallback) imageFallback.hidden = true;

      thumbnailsEl?.querySelectorAll<HTMLButtonElement>(".product-thumbnail").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.src === src);
      });
    };

    if (image) setMainImage(image);

    if (thumbnailsEl && productImages.length > 1) {
      thumbnailsEl.hidden = false;
      thumbnailsEl.innerHTML = productImages.map((src, index) => `
        <button type="button" class="product-thumbnail ${index === 0 ? "active" : ""}" data-src="${src}">
          <img src="${src}" alt="${product.title} photo ${index + 1}" />
        </button>
      `).join("");

      thumbnailsEl.querySelectorAll<HTMLButtonElement>(".product-thumbnail").forEach((btn) => {
        btn.addEventListener("click", () => setMainImage(btn.dataset.src || ""));
      });
    }

    const reviews = getFallbackReviews(product);
    renderReviews(reviews);

    const getSelectedVariant = setupVariantControls(product);
    selectedVariantStock = getSelectedVariant()?.stock ?? product.stock ?? 0;

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
            showToast("Please enter a valid URL, for example https://example.com");
            qrDestinationInput?.focus();
            return;
          }
        }

        const selectedVariant = getSelectedVariant();

        if (!isInStock(product, selectedVariant)) {
          showToast("This variant is out of stock.");
          return;
        }

        const availableStock = selectedVariant?.stock ?? product.stock ?? selectedVariantStock;
        if (availableStock > 0 && quantity > availableStock) {
          quantity = availableStock;
          updateQuantity();
          showToast(`Only ${availableStock} item${availableStock === 1 ? "" : "s"} available in this size.`);
          return;
        }

        try {
          addBtn.disabled = true;
          addBtn.textContent = "Adding...";

          addProductToLocalCart({
  product,
  quantity,
  selectedVariant,
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
          showToast(error.message || "Failed to add product to cart.");
          addBtn.disabled = false;
          addBtn.textContent = "Add to cart";
        }
      });
    }

    await updateCartBadge();
  } catch (error: any) {
    console.error("Failed to load product:", error);
    setText(titleEl, "Error loading product");
    setText(metaEl, "");
    setText(descEl, error.message || "Failed to load product details.");
    setText(priceEl, "");
    setText(stockEl, "");

    if (addBtn) addBtn.style.display = "none";
  }
}

initProductDetailsPage();