import { getProductBySlug, getProducts } from "@/lib/products";
import { ProductDetails } from "@/components/product/ProductDetails";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) return {};

  const description =
    product.shortDescription ||
    product.description ||
    "QR clothing and accessories by Skanare.";

  const image =
    product.images?.[0] ||
    product.image ||
    "https://skanare.com/assets/img/logo_Image.png";

  return {
    title: `${product.title} | Skanare`,
    description,
    alternates: {
      canonical: `/product/${product.slug || product.id}`,
    },
    openGraph: {
      type: "website",
      title: `${product.title} | Skanare`,
      description,
      url: `/product/${product.slug || product.id}`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.title} | Skanare`,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);

  if (!product || product.active === false) {
    return notFound();
  }

  const allProducts = await getProducts({ active: true }).catch(() => []);

  const relatedProducts = allProducts
    .filter((item) => item.id !== product.id && item.active !== false)
    .slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description:
      product.description ||
      product.shortDescription ||
      "QR clothing and accessories by Skanare.",
    image:
      product.images?.[0] ||
      product.image ||
      "https://skanare.com/assets/img/logo_Image.png",
    brand: {
      "@type": "Brand",
      name: "Skanare",
    },
    offers: {
      "@type": "Offer",
      url: `https://skanare.com/product/${product.slug || product.id}`,
      price: String(product.price || product.priceEUR || 0),
      priceCurrency: "EUR",
      availability:
        product.stock && product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "Skanare",
      },
    },
  };

  return (
    <>
      <ProductDetails product={product} relatedProducts={relatedProducts} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
    </>
  );
}
