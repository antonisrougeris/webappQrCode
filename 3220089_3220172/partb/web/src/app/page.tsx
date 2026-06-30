import Link from "next/link";
import { getProducts } from "../lib/products";
import { ProductCard } from "../components/ProductCard";

export default async function HomePage() {
  const [tshirts, accessories] = await Promise.all([
    getProducts({
      category: "tshirt",
      featured: true,
      active: true,
      limit: 4,
    }).catch(() => []),
    getProducts({
      category: "accessory",
      featured: true,
      active: true,
      limit: 4,
    }).catch(() => []),
  ]);

  return (
    <main>
      <section id="defaultHero" className="hero">
        <div className="container hero-content">
          <div>
            <span className="eyebrow">Change your QR destination anytime</span>
            <h1>Wear your link</h1>
            <p>
              Premium clothes and accessories with your personal QR code. Scan
              it, open your link, and update the destination whenever you want
              from your account for FREE.
            </p>

            <div className="hero-actions">
              <Link className="btn-primary" href="#tshirts">
                Shop T-Shirts
              </Link>
              <Link className="btn-outline" href="#how">
                See how it works
              </Link>
            </div>
          </div>

          <div className="hero-visual">
            <div className="tshirt-mockup">
              <svg className="tshirt-svg" viewBox="0 0 200 200">
                <path
                  d="M50 40 L70 20 L130 20 L150 40 L170 60 L150 80 L150 170 L50 170 L50 80 L30 60 Z"
                  fill="#111"
                />
                <image
                  href="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://skanare.com"
                  x="60"
                  y="70"
                  width="80"
                  height="80"
                />
              </svg>
            </div>

            <div className="phone-card">
              <div className="phone-screen">
                <strong>Your QR profile</strong>

                <img
                  className="qr-real small"
                  src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=https://skanare.com/antonios"
                  alt="Example QR code for a Skanare profile"
                  width="90"
                  height="90"
                />

                <div className="link-chip">skanare.com/antonios</div>

                <a className="btn-primary" href="#">
                  Update link
                </a>
              </div>
            </div>

            <div className="float-badge">One QR. Unlimited links.</div>
          </div>
        </div>
      </section>

      <section id="tshirts" className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">T-Shirts</h2>
            <Link className="btn-outline" href="/products?category=tshirt">
              View all
            </Link>
          </div>

          {tshirts.length ? (
            <div className="grid grid-4">
              {tshirts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p className="meta">No t-shirts available yet.</p>
          )}
        </div>
      </section>

      <section id="accessories" className="section section-muted">
        <div className="container">
          <div className="section-head">
            <h2 className="section-title">Accessories</h2>
            <Link className="btn-outline" href="/products?category=accessory">
              View all
            </Link>
          </div>

          {accessories.length ? (
            <div className="grid grid-4">
              {accessories.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p className="meta">No accessories available yet.</p>
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