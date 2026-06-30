// app/product/[slug]/page.tsx

import { getProduct } from "@/lib/api/products";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);

  if (!product) return {};

  return {
    title: `${product.title} | Skanare`,
    description: product.shortDescription,
    openGraph: {
      title: product.title,
      description: product.shortDescription,
      images: product.image ? [product.image] : [],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);

  if (!product) return notFound();

  return (
    <main className="container">
      <h1>{product.title}</h1>

      <p>{product.shortDescription}</p>

      {product.image && (
        <img src={product.image} alt={product.title} width={400} />
      )}

      <p>{product.price} €</p>
    </main>
  );
}