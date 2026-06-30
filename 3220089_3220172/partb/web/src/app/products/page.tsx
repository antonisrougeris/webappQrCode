// app/products/page.tsx

import { getProducts } from "@/lib/api/products";
import ProductCard from "@/components/product/ProductCard";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const products = await getProducts({
    category: searchParams?.category,
  });

  return (
    <main className="container">
      <h1>Products</h1>

      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </main>
  );
}