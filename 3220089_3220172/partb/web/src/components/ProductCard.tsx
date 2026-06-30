import Link from "next/link";
import type { Product } from "@/lib/products";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function getProductImage(product: Product): string {
  return product.images?.[0] || product.image || "";
}

export function ProductCard({ product }: { product: Product }) {
  const image = getProductImage(product);
  const identifier = product.slug || product.id;
  const badgeText = product.badge || (product.featured ? "Featured" : "");

  return (
    <article className="card product-card">
      <Link href={`/product/${encodeURIComponent(identifier)}`}>
        <div
          className={`product-media ${
            product.category === "accessory" ? "grey" : ""
          }`}
        >
          {badgeText ? <span className="badge">{badgeText}</span> : null}

          {image ? (
            <img src={image} alt={product.title} loading="lazy" />
          ) : (
            <div className="mini-shirt" />
          )}
        </div>

        <div className="product-body">
          <div className="product-row">
            <h3>{product.title}</h3>
            <p className="price">{formatPrice(product.price)}</p>
          </div>

          <p className="meta">
            {product.shortDescription || "Custom QR product"}
          </p>

          <p className="meta">
            {product.stock && product.stock > 0 ? "In stock" : "Out of stock"}
          </p>
        </div>
      </Link>
    </article>
  );
}