// components/product/ProductCard.tsx

import Link from "next/link";
import { Product } from "@/lib/api/products";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.slug}`} className="card">
      <div>
        {product.image && (
          <img
            src={product.image}
            alt={product.title}
            width={250}
            height={250}
          />
        )}

        <h3>{product.title}</h3>
        <p>{product.shortDescription}</p>
        <strong>{product.price} €</strong>
      </div>
    </Link>
  );
}