import { getProductBySlug } from "@/lib/products";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProductBySlug(params.slug);

  if (!product) return {};

  return {
    title: `${product.title} | Skanare`,
    description:
      product.shortDescription ||
      product.description ||
      "QR clothing and accessories by Skanare.",
    openGraph: {
      title: `${product.title} | Skanare`,
      description:
        product.shortDescription ||
        product.description ||
        "QR clothing and accessories by Skanare.",
      images: product.image ? [product.image] : [],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProductBySlug(params.slug);

  if (!product) return notFound();

  return (
    <main className="container page-content">
      <section className="product-details">
        <div className="product-details-media">
          {product.image ? (
            <img src={product.image} alt={product.title} />
          ) : (
            <div className="mini-shirt" />
          )}
        </div>

        <div className="product-details-info">
          <p className="eyebrow">
            {product.category === "tshirt" ? "QR Clothing" : "QR Accessory"}
          </p>

          <h1>{product.title}</h1>

          <p className="meta">
            {product.description ||
              product.shortDescription ||
              "Custom QR product by Skanare."}
          </p>

          <p className="price">
            {new Intl.NumberFormat("el-GR", {
              style: "currency",
              currency: "EUR",
            }).format(product.price)}
          </p>

          <p className="meta">
            {product.stock && product.stock > 0 ? "In stock" : "Out of stock"}
          </p>

          <button className="btn-primary" type="button">
            Add to cart
          </button>
        </div>
      </section>
    </main>
  );
}