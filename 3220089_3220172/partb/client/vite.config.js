import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
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
      },
    },
  },
});