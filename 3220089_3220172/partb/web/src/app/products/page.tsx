import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const metadata = {
  title: "Products | Skanare",
  description:
    "Shop QR clothing and accessories with editable QR destinations.",
};

type ProductsSearchParams = Promise<{
  category?: string;
  q?: string;
}>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: ProductsSearchParams;
}) {
  const params = await searchParams;

  const category = params?.category || "All";
  const q = params?.q || "";

  const products = await getProducts({
    category: category === "All" ? undefined : category,
    active: true,
  }).catch(() => []);

  const query = q.trim().toLowerCase();

  const filteredProducts = products.filter((product) => {
    if (!query) return true;

    return (
      product.title.toLowerCase().includes(query) ||
      product.shortDescription?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query)
    );
  });

  return (
    <main>
      <section className="hero">
        <div className="container hero-content">
          <div>
            <span className="eyebrow">QR clothing & accessories</span>
            <h1>Shop editable QR products.</h1>
            <p>
              Choose a t-shirt or accessory, add your personal QR destination,
              and update the link anytime from your account.
            </p>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">All Products</h2>
          </div>

          <form className="filters" action="/products">
            <input
              name="q"
              type="search"
              placeholder="Search products..."
              aria-label="Search products"
              defaultValue={q}
            />

            <select
              name="category"
              aria-label="Filter by category"
              defaultValue={category}
            >
              <option value="All">All categories</option>
              <option value="tshirt">T-Shirts</option>
              <option value="accessory">Accessories</option>
            </select>

            <button className="btn-primary" type="submit">
              Filter
            </button>
          </form>

          {filteredProducts.length ? (
            <div className="grid grid-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p className="meta">No products match your search criteria.</p>
          )}
        </div>
      </section>

      <section id="how" className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">How it works</h2>
          </div>

          <div className="grid grid-3 how-it-works">
            <article className="card step">
              <h3>Choose product</h3>
              <p className="meta">Pick a t-shirt, hoodie or accessory.</p>
            </article>

            <article className="card step">
              <h3>Add your QR link</h3>
              <p className="meta">
                Enter the URL, social profile or text you want to open.
              </p>
            </article>

            <article className="card step">
              <h3>Change it anytime</h3>
              <p className="meta">
                After purchase, edit the QR destination without replacing the
                shirt.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}