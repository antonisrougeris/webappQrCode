/* 3220089_3220172  2025 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB, closeDB } from "./config/db.js";
import { seedDatabase } from "./config/seed.js";
import { errorHandler } from "./middleware/errorHandler.js";

import usersRoutes from "./routes/users.routes.js";
import enrollmentsRoutes from "./routes/enrollments.routes.js";
import authRoutes from "./routes/auth.routes.js";
import courseReviewsRoutes from "./routes/reviews.routes.js";
import reviewsManageRoutes from "./routes/reviews.manage.routes.js";
import booksRoutes from "./routes/books.routes.js";
import purchasesRoutes from "./routes/purchases.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";

import productsRoutes from "./routes/products.routes.js";



dotenv.config();

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "devdromos-api" });
});

app.use("/api/products", productsRoutes);

app.use("/api/users", usersRoutes);
app.use("/api/enrollments", enrollmentsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/reviews", reviewsManageRoutes);
app.use("/api/courses/:id/reviews", courseReviewsRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/purchases", purchasesRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;

await connectDB();

// Seed database with initial data
await seedDatabase();

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  server.close();
  await closeDB();
  process.exit(0);
});
