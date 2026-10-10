export function renderFooter(): void {
  const target = document.getElementById("siteFooter");

  if (!target) return;

  target.innerHTML = `
    <footer class="site-footer">

      <div class="container footer-main">

        <!-- BRAND -->

        <div class="footer-brand">

          <a
            href="/index.html"
            class="footer-logo"
          >
            Skanare
          </a>

          <p class="footer-description">
            QR clothing and accessories that connect
            what you wear with your digital world.
          </p>

          <p class="footer-tagline">
            Dynamic QR. Your link or photo. Your story.
          </p>

          

          <div
            class="footer-socials"
            aria-label="Skanare social media"
          >
            <a
              class="footer-social"
              href="https://www.instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              title="Instagram"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5"></rect>
                <circle cx="12" cy="12" r="4"></circle>
                <circle cx="17.5" cy="6.5" r="1"></circle>
              </svg>
            </a>

            <a
              class="footer-social"
              href="https://www.facebook.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              title="Facebook"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 8h3V4h-3c-3.3 0-5 1.9-5 5v2H6v4h3v7h4v-7h3.2l.8-4H13V9c0-.7.3-1 1-1z"></path>
              </svg>
            </a>

            <a
              class="footer-social"
              href="https://www.youtube.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              title="YouTube"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 7.2a3 3 0 0 0-2.1-2.1C17 4.5 12 4.5 12 4.5s-5 0-6.9.6A3 3 0 0 0 3 7.2 31 31 0 0 0 2.5 12 31 31 0 0 0 3 16.8a3 3 0 0 0 2.1 2.1c1.9.6 6.9.6 6.9.6s5 0 6.9-.6a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8z"></path>
                <path d="m10 9 5 3-5 3z" class="footer-social__play"></path>
              </svg>
            </a>

            <a
              class="footer-social"
              href="https://www.linkedin.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              title="LinkedIn"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="9" width="4" height="12"></rect>
                <circle cx="5" cy="5" r="2"></circle>
                <path d="M10 9h4v1.8c.9-1.4 2.2-2.2 4.1-2.2 3 0 3.9 2 3.9 5V21h-4v-6.5c0-1.6-.3-2.7-1.9-2.7-1.7 0-2.1 1.3-2.1 3V21h-4z"></path>
              </svg>
            </a>
          </div>

        </div>


        <!-- ===============================
             DESKTOP FOOTER
        ================================ -->

        <div class="footer-desktop-nav">

          <!-- MY ACCOUNT -->

          <div class="footer-column">

            <h4>
              My Account
            </h4>

            <ul>

              <li>
                <a href="/my-qr">
                  <span>My QR Codes</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/returns">
                  <span>Returns Center</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/login">
                  <span>Sign In</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/register">
                  <span>Create Account</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

            </ul>

          </div>


          <!-- SHOP -->

          <div class="footer-column">

            <h4>
              Shop
            </h4>

            <ul>

              <li>
                <a href="/products?category=tshirt">
                  <span>QR Clothing</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/products?category=accessory">
                  <span>QR Accessories</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/index.html#how">
                  <span>How it works</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

            </ul>

          </div>


          <!-- COMPANY -->

          <div class="footer-column">

            <h4>
              Company
            </h4>

            <ul>

              <li>
                <a href="/about">
                  <span>About Us</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/contact">
                  <span>Contact</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/index.html#faq">
                  <span>FAQ</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/payment-security">
                  <span>Payment &amp; Security</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

            </ul>

          </div>


          <!-- POLICIES -->

          <div class="footer-column">

            <h4>
              Policies
            </h4>

            <ul>

              <li>
                <a href="/shipping-policy">
                  <span>Shipping Policy</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/refund-policy">
                  <span>Refund &amp; Returns</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/privacy-policy">
                  <span>Privacy Policy</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/terms">
                  <span>Terms of Service</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/cookie-policy">
                  <span>Cookie Policy</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

            </ul>

          </div>

        </div>


        <!-- ===============================
             MOBILE FOOTER ACCORDION
        ================================ -->

        <div class="footer-mobile-nav">

          <!-- MY ACCOUNT -->

          <details class="footer-mobile-section">

            <summary>
              <span>My Account</span>
              <span class="footer-chevron"></span>
            </summary>

            <div class="footer-mobile-content">

              <a href="/my-qr">
                My QR Codes
              </a>

              <a href="/returns">
                Returns Center
              </a>

              <a href="/login">
                Sign In
              </a>

              <a href="/register">
                Create Account
              </a>

            </div>

          </details>


          <!-- SHOP -->

          <details class="footer-mobile-section">

            <summary>
              <span>Shop</span>
              <span class="footer-chevron"></span>
            </summary>

            <div class="footer-mobile-content">

              <a href="/products?category=tshirt">
                QR Clothing
              </a>

              <a href="/products?category=accessory">
                QR Accessories
              </a>

              <a href="/index.html#how">
                How it works
              </a>

            </div>

          </details>


          <!-- COMPANY -->

          <details class="footer-mobile-section">

            <summary>
              <span>Company</span>
              <span class="footer-chevron"></span>
            </summary>

            <div class="footer-mobile-content">

              <a href="/about">
                About Us
              </a>

              <a href="/contact">
                Contact
              </a>

              <a href="/index.html#faq">
                FAQ
              </a>

              <a href="/payment-security">
                Payment &amp; Security
              </a>

            </div>

          </details>


          <!-- POLICIES -->

          <details class="footer-mobile-section">

            <summary>
              <span>Policies</span>
              <span class="footer-chevron"></span>
            </summary>

            <div class="footer-mobile-content">

              <a href="/shipping-policy">
                Shipping Policy
              </a>

              <a href="/refund-policy">
                Refund &amp; Returns
              </a>

              <a href="/privacy-policy">
                Privacy Policy
              </a>

              <a href="/terms">
                Terms of Service
              </a>

              <a href="/cookie-policy">
                Cookie Policy
              </a>

            </div>

          </details>

        </div>

      </div>


      <!-- ===============================
           FOOTER BOTTOM
      ================================ -->

      <div class="container footer-bottom">

        <small>
          © 2026 Skanare. All rights reserved.
        </small>

        <div class="footer-bottom-links">

          <a href="/privacy-policy">
            Privacy
          </a>

          <a href="/terms">
            Terms
          </a>

          <a href="/cookie-policy">
            Cookies
          </a>

        </div>

      </div>

    </footer>
  `;
}