import { Router } from "express";
import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";

const router = Router();

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cleanBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || "https://skanare.com").replace(
    /\/+$/,
    ""
  );
}

function productPath(product, docId) {
  const identifier = product.slug || product.id || docId;
  return `/product/${encodeURIComponent(identifier)}`;
}

function urlEntry({ loc, priority = "0.6", changefreq = "monthly", lastmod }) {
  return `
  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const db = getDB();
    const baseUrl = cleanBaseUrl();

    const staticPages = [
      {
        path: "/",
        priority: "1.0",
        changefreq: "weekly",
      },
      {
        path: "/src/pages/products/products.html",
        priority: "0.9",
        changefreq: "weekly",
      },
      {
        path: "/src/pages/products/products.html?category=tshirt",
        priority: "0.8",
        changefreq: "weekly",
      },
      {
        path: "/src/pages/products/products.html?category=accessory",
        priority: "0.8",
        changefreq: "weekly",
      },
      {
        path: "/src/pages/contact/contact.html",
        priority: "0.7",
        changefreq: "monthly",
      },
    ];

    const staticUrls = staticPages
      .map((page) =>
        urlEntry({
          loc: `${baseUrl}${page.path}`,
          priority: page.priority,
          changefreq: page.changefreq,
        })
      )
      .join("");

    const productsSnap = await db.collection(COLLECTIONS.PRODUCTS).get();

    const productUrls = productsSnap.docs
      .map((doc) => {
        const product = doc.data() || {};

        if (product.active === false) return null;

        const lastmod =
          product.updatedAt ||
          product.createdAt ||
          new Date().toISOString();

       return urlEntry({
    loc: `${baseUrl}/product/${encodeURIComponent(identifier)}`,
    priority: product.featured ? "0.9" : "0.8",
    changefreq: "weekly",
    lastmod,
});
      })
      .filter(Boolean)
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${productUrls}
</urlset>`;

    res.status(200);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (error) {
    console.error("Sitemap error:", error);
    res.status(500).type("text/plain").send("Sitemap error");
  }
});

export default router;