import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="logo-text">Skanare</div>
          <p>Modern QR clothing for creators, brands and events.</p>
        </div>

        <div>
          <h4>Shop</h4>
          <ul>
            <li>
              <Link href="/products?category=tshirt">T-Shirts</Link>
            </li>
            <li>
              <Link href="/products?category=accessory">Accessories</Link>
            </li>
          </ul>
        </div>

        <div>
          <h4>Support</h4>
          <p>Email: hello@skanare.com</p>
          <p>Free QR link updates.</p>
        </div>
      </div>

      <div className="container footer-bottom">
        <small>&copy; 2026 skanare.</small>
      </div>
    </footer>
  );
}