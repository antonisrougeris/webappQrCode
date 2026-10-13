import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export default defineConfig({
  plugins: [{
    name: "skanare-fingerprint-public-css",
    apply: "build",
    transformIndexHtml(html) {
      // Every production page receives fresh asset URLs whenever CSS content
      // changes, including returning Android users with cached stylesheets.
      return html.replace(/(href="\/assets\/css\/([a-zA-Z0-9_-]+\.css))(?:\?[^"]*)?(")/g,
        (match, prefix, fileName, ending) => {
          try {
            const bytes = readFileSync(resolve(process.cwd(), "public/assets/css", fileName));
            const version = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
            return prefix + "?v=" + version + ending;
          } catch {
            return match;
          }
        });
    },
  }],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),


        contact: resolve(__dirname, "src/pages/contact/contact.html"),

        products: resolve(__dirname, "src/pages/products/products.html"),

        productDetails: resolve(
          __dirname,
          "src/pages/product-details/product-details.html"
        ),

        cart: resolve(__dirname, "src/pages/cart/cart.html"),

        checkout: resolve(__dirname, "src/pages/checkout/checkout.html"),

        login: resolve(__dirname, "src/pages/login/login.html"),

        forgotPassword: resolve(
    __dirname,
    "src/pages/forgot-password/forgot-password.html"
  ),


        verify_email: resolve(__dirname, "src/pages/verify-email/verify-email.html"),

        register: resolve(__dirname, "src/pages/register/register.html"),

        paymentSuccess: resolve(
          __dirname,
          "src/pages/payment/payment_success.html"
        ),

        paymentFailure: resolve(
          __dirname,
          "src/pages/payment/payment_failure.html"
        ),

        about: resolve(
          __dirname,
          "src/pages/about/about.html"
        ),

        paymentSecurity: resolve(
          __dirname,
          "src/pages/payment-security/payment-security.html"
        ),

        shippingPolicy: resolve(
          __dirname,
          "src/pages/shipping-policy/shipping-policy.html"
        ),

        refundPolicy: resolve(
          __dirname,
          "src/pages/refund-policy/refund-policy.html"
        ),

        returns: resolve(
          __dirname,
          "src/pages/returns/returns.html"
        ),

        privacyPolicy: resolve(
          __dirname,
          "src/pages/privacy-policy/privacy-policy.html"
        ),

        terms: resolve(
          __dirname,
          "src/pages/terms/terms.html"
        ),

        cookiePolicy: resolve(
          __dirname,
          "src/pages/cookie-policy/cookie-policy.html"
        ),
        admin: resolve(
          __dirname,
          "src/pages/admin/admin.html"
        ),

        myQr: resolve(
  __dirname,
  "src/pages/my-qr/my-qr.html"
),
      },
    },
  },
});