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
            Dynamic QR. Your link. Your story.
          </p>

          <a
            href="mailto:hello@skanare.com"
            class="footer-email"
          >
            hello@skanare.com
          </a>

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
                <a href="/src/pages/my-qr/my-qr.html">
                  <span>My QR Codes</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/src/pages/login/login.html">
                  <span>Sign In</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/src/pages/register/register.html">
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
                <a href="/src/pages/products/products.html?category=tshirt">
                  <span>QR Clothing</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/src/pages/products/products.html?category=accessory">
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
                <a href="/src/pages/about/about.html">
                  <span>About Us</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/src/pages/contact/contact.html">
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
                <a href="/src/pages/payment-security/payment-security.html">
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
                <a href="/src/pages/shipping-policy/shipping-policy.html">
                  <span>Shipping Policy</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/src/pages/refund-policy/refund-policy.html">
                  <span>Refund &amp; Returns</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/src/pages/privacy-policy/privacy-policy.html">
                  <span>Privacy Policy</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/src/pages/terms/terms.html">
                  <span>Terms of Service</span>
                  <span class="footer-arrow">↗</span>
                </a>
              </li>

              <li>
                <a href="/src/pages/cookie-policy/cookie-policy.html">
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

              <a href="/src/pages/my-qr/my-qr.html">
                My QR Codes
              </a>

              <a href="/src/pages/login/login.html">
                Sign In
              </a>

              <a href="/src/pages/register/register.html">
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

              <a href="/src/pages/products/products.html?category=tshirt">
                QR Clothing
              </a>

              <a href="/src/pages/products/products.html?category=accessory">
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

              <a href="/src/pages/about/about.html">
                About Us
              </a>

              <a href="/src/pages/contact/contact.html">
                Contact
              </a>

              <a href="/index.html#faq">
                FAQ
              </a>

              <a href="/src/pages/payment-security/payment-security.html">
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

              <a href="/src/pages/shipping-policy/shipping-policy.html">
                Shipping Policy
              </a>

              <a href="/src/pages/refund-policy/refund-policy.html">
                Refund &amp; Returns
              </a>

              <a href="/src/pages/privacy-policy/privacy-policy.html">
                Privacy Policy
              </a>

              <a href="/src/pages/terms/terms.html">
                Terms of Service
              </a>

              <a href="/src/pages/cookie-policy/cookie-policy.html">
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

          <a href="/src/pages/privacy-policy/privacy-policy.html">
            Privacy
          </a>

          <a href="/src/pages/terms/terms.html">
            Terms
          </a>

          <a href="/src/pages/cookie-policy/cookie-policy.html">
            Cookies
          </a>

        </div>

      </div>

    </footer>
  `;
}