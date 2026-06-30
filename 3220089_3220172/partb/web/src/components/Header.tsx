import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <div className="container header-content">
        <button
          id="menuToggle"
          className="menu-toggle"
          type="button"
          aria-label="Toggle menu"
          aria-expanded="false"
          aria-controls="mainNav"
        >
          ☰
        </button>

        <nav id="mainNav" className="main-nav" aria-label="Main navigation">
          <div className="nav-left">
            <Link href="/#tshirts">QR Clothing</Link>
            <Link href="/#accessories">QR Accessories</Link>
          </div>

          <div className="nav-right">
            <Link href="/contact">Contact</Link>
            <Link href="/#how">How it works</Link>
          </div>
        </nav>

        <Link href="/" className="logo" aria-label="Skanare home">
          <img
            className="logo-img"
            src="/assets/img/logo_Image.png"
            alt="Skanare logo"
          />
          <span className="logo-text">Skanare</span>
        </Link>

        <div className="header-actions">
          <div className="account-menu">
            <Link
              href="/login"
              className="header-icon-link account-btn"
              aria-label="Account"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path>
              </svg>
            </Link>

            <div className="account-dropdown hidden"></div>
          </div>

          <Link href="/cart" className="header-icon-link cart-link" aria-label="Cart">
            <svg
              viewBox="0 0 22 22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M14.666 7.333a3.666 3.666 0 1 1-7.333 0M3.33 6.785l-.642 7.7c-.137 1.654-.206 2.48.073 3.119a2.75 2.75 0 0 0 1.21 1.314c.612.332 1.442.332 3.102.332h7.853c1.66 0 2.49 0 3.103-.332a2.75 2.75 0 0 0 1.21-1.314c.279-.638.21-1.465.072-3.12l-.642-7.7c-.118-1.423-.178-2.134-.493-2.673A2.75 2.75 0 0 0 16.99 3.02c-.563-.269-1.277-.269-2.705-.269h-6.57c-1.428 0-2.142 0-2.705.27A2.75 2.75 0 0 0 3.823 4.11c-.315.539-.374 1.25-.493 2.674Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}