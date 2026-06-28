import type { Product } from "../services/products";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function getProductImage(product: Product): string {
  return product.images?.[0] || product.image || "";
}

export function renderProducts(container: HTMLElement, products: Product[]): void {
  container.innerHTML = "";

  products.forEach((product) => {
    const article = document.createElement("article");
    article.className = "card product-card";

    const image = getProductImage(product);
    const productId = product.id || product._id;
    const href = `/src/pages/product-details/product-details.html?id=${encodeURIComponent(productId)}`;

    const badgeText = product.badge || (product.featured ? "Featured" : "");

    article.innerHTML = `
      <a href="${href}">
        <div class="product-media ${product.category === "accessory" ? "grey" : ""}">
          ${badgeText ? `<span class="badge">${badgeText}</span>` : ""}
          ${
            image
              ? `<img src="${image}" alt="${product.title}" loading="lazy" />`
              : `<div class="mini-shirt"></div>`
          }
        </div>

        <div class="product-body">
          <div class="product-row">
            <h3>${product.title}</h3>
            <p class="price">${formatPrice(product.priceEUR)}</p>
          </div>

          <p class="meta">${product.shortDescription || "Custom QR product"}</p>
          <p class="meta">${product.stock && product.stock > 0 ? "In stock" : "Out of stock"}</p>
        </div>
      </a>
    `;

    container.appendChild(article);
  });
}