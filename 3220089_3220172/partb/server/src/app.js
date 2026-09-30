import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { connectDB, closeDB } from "./config/db.js";
import { corsOptions } from "./config/security.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { attachGuestSession } from "./middleware/guestSession.js";
import { optionalAuth } from "./middleware/auth.js";
import { requestContext } from "./middleware/requestContext.js";
import {
  apiLimiter,
  authLimiter,
  sensitiveAuthLimiter,
  checkoutLimiter,
  adminLimiter,
  webhookLimiter,
} from "./middleware/rateLimits.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import productsRoutes from "./routes/products.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import qrRoutes from "./routes/qr.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import vivaRoutes from "./routes/viva.routes.js";
import sitemapRoutes from "./routes/sitemap.routes.js";
import seoProductRoutes from "./routes/seo-product.routes.js";
import boxNowTestRoutes from "./routes/boxnow-test.routes.js";
import boxNowRoutes from "./routes/boxnow.routes.js";

dotenv.config();

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(requestContext);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://client.crisp.chat",
          "https://apis.google.com",
          "https://www.gstatic.com",
        ],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

app.use(cors(corsOptions()));

app.use(
  express.json({
    limit: "100kb",
    verify: (req, _res, buf) => {
      if (req.originalUrl?.startsWith("/api/boxnow/webhook")) {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
);

app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(attachGuestSession);
app.use(optionalAuth);

/*
 * Health endpoints are deliberately outside the general API limiter so
 * external monitors cannot be blocked by normal customer traffic.
 */
app.use("/api/health", healthRoutes);

/*
 * Provider webhooks are public endpoints with their own limiter.
 */
app.use("/api/viva", webhookLimiter, vivaRoutes);
app.use("/api/boxnow", webhookLimiter, boxNowRoutes);

app.use("/", seoProductRoutes);
app.use("/", sitemapRoutes);

/*
 * Route-specific protection is applied before the general API limiter.
 */
app.use("/api/auth/send-verification", sensitiveAuthLimiter);
app.use("/api/auth/verify-email", sensitiveAuthLimiter);
app.use("/api/auth/forgot-password", sensitiveAuthLimiter);
app.use("/api/auth/reset-password", sensitiveAuthLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/checkout", checkoutLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/qr-codes", qrRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
if (process.env.NODE_ENV !== "production") {
  app.use("/api/test-boxnow", boxNowTestRoutes);
}

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "127.0.0.1";

await connectDB();

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`);

  server.close(async () => {
    await closeDB();
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
