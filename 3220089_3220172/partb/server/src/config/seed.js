import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function seedDatabase() {
  const db = getDB();

  try {
    const productsSnapshot = await db
      .collection("products")
      .limit(1)
      .get();

    if (!productsSnapshot.empty) {
      console.log("Products already seeded");
      return;
    }

    const productsPath = join(__dirname, "../../products.json");
    const productsData = JSON.parse(
      await readFile(productsPath, "utf-8")
    );

    const batch = db.batch();

    for (const product of productsData) {
      const docId = String(product.id || product.slug || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (!docId) continue;

      batch.set(db.collection("products").doc(docId), {
  ...product,
  id: docId,
  images: Array.isArray(product.images)
    ? product.images
    : product.image
      ? [product.image]
      : [],
  active: product.active ?? true,
  featured: product.featured ?? false,
  stock: product.stock ?? 0,
  createdAt: product.createdAt || new Date().toISOString(),
  updatedAt: product.updatedAt || new Date().toISOString(),
});
    }

    await batch.commit();

    console.log(`Seeded ${productsData.length} products`);
    console.log("Database seeding completed");
  } catch (error) {
    console.error("Error seeding products:", error);
    throw error;
  }
}