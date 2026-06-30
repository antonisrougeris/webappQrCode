import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { connectDB, closeDB } from "./config/db.js";
import { corsOptions } from "./config/security.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { attachGuestSession } from "./middleware/guestSession.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import productsRoutes from "./routes/products.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import qrRoutes from "./routes/qr.routes.js";
import adminRoutes from "./routes/admin.routes.js";

import cookieParser from "cookie-parser";

import vivaRoutes from "./routes/viva.routes.js";


import sitemapRoutes from "./routes/sitemap.routes.js";

import { optionalAuth } from "./middleware/auth.js";

import seoProductRoutes from "./routes/seo-product.routes.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors(corsOptions()));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(attachGuestSession);
app.use(optionalAuth);


app.use("/api/viva", vivaRoutes);

app.use("/", seoProductRoutes);
app.use("/", sitemapRoutes);
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(
  ["/api/auth", "/api/checkout"],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/qr-codes", qrRoutes);
app.use("/api/admin", adminRoutes);
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
await connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  server.close();
  await closeDB();
  process.exit(0);
});


