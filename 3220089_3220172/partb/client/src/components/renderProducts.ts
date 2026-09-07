import type { Product } from "../services/products";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getProductImages(product: Product): string[] {
  const images = Array.isArray(product.images)
    ? product.images.filter(
        (image): image is string =>
          typeof image === "string" &&
          image.trim().length > 0
      )
    : [];

  if (
    images.length === 0 &&
    typeof product.image === "string" &&
    product.image.trim()
  ) {
    images.push(product.image);
  }

  return images;
}

export function renderProducts(
  container: HTMLElement,
  products: Product[]
): void {
  container.innerHTML = "";

  products.forEach((product) => {
    const productId = product.id || product._id;

    if (!productId) return;

    const identifier =
      product.slug ||
      product.id ||
      product._id;

    if (!identifier) return;

    const href =
      `/product/${encodeURIComponent(identifier)}`;

    const images = getProductImages(product);

    const badgeText =
      product.badge ||
      (product.featured ? "Featured" : "");

    const inStock =
      typeof product.stock === "number"
        ? product.stock > 0
        : true;

    const article =
      document.createElement("article");

    article.className = "product-card";

    const imagesHtml = images
      .map(
        (image, index) => `
          <img
            class="product-image ${
              index === 0 ? "is-active" : ""
            }"
            src="${escapeHtml(image)}"
            alt="${
              index === 0
                ? escapeHtml(product.title)
                : ""
            }"
            loading="lazy"
            decoding="async"
            data-image-index="${index}"
            ${index !== 0 ? 'aria-hidden="true"' : ""}
          />
        `
      )
      .join("");

    article.innerHTML = `
      <a
        href="${escapeHtml(href)}"
        class="product-card-anchor"
        aria-label="View ${escapeHtml(product.title)}"
      >

        <div
          class="
            product-media
            ${product.category === "accessory" ? "grey" : ""}
          "
        >

          ${
            badgeText
              ? `
                <span class="badge">
                  ${escapeHtml(badgeText)}
                </span>
              `
              : ""
          }

          ${
            images.length > 0
              ? imagesHtml
              : `
                <div
                  class="mini-shirt product-image-fallback"
                  aria-hidden="true"
                ></div>
              `
          }

        </div>

        <div class="product-body">

          <div class="product-row">

            <h3 class="product-title">
              ${escapeHtml(product.title)}
            </h3>

            <p class="price">
              ${formatPrice(product.price)}
            </p>

          </div>

          <p
            class="
              product-stock
              ${inStock ? "is-in-stock" : "is-out-of-stock"}
            "
          >
            ${inStock ? "In stock" : "Out of stock"}
          </p>

        </div>

      </a>
    `;

    /*
     * Desktop hover image cycling:
     *
     * 1st hover  -> image 2
     * 2nd hover  -> image 3
     * 3rd hover  -> image 1
     */
    if (images.length > 1) {
      const media =
        article.querySelector<HTMLElement>(
          ".product-media"
        );

      const productImages =
        Array.from(
          article.querySelectorAll<HTMLElement>(
            ".product-image"
          )
        );

      let currentImageIndex = 0;

      media?.addEventListener(
        "mouseenter",
        () => {
          /*
           * Only execute on actual hover devices.
           */
          if (
            !window.matchMedia(
              "(hover: hover) and (pointer: fine)"
            ).matches
          ) {
            return;
          }

          currentImageIndex =
            (currentImageIndex + 1) %
            productImages.length;

          productImages.forEach(
            (image, index) => {
              image.classList.toggle(
                "is-active",
                index === currentImageIndex
              );
            }
          );
        }
      );
    }

    container.appendChild(article);
  });
}