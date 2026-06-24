import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB, closeDB } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js"; // ✅ ADD
import productsRoutes from "./routes/products.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import qrRoutes from "./routes/qr.routes.js";
import adminRoutes from "./routes/admin.routes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);

// ⚠️ εδώ είχες και ένα typo: /api/health", healthRoutes);a
app.use("/api/auth", authRoutes);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes); // ✅ ADD
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
