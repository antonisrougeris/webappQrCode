import { Router } from "express";
import { getProductByIdOrSlug } from "../services/product.service.js";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productDetailsHtmlPath = path.resolve(
  __dirname,
  "../../../client/dist/src/pages/product-details/product-details.html"
);

const router = Router();

/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanBaseUrl() {
  return String(
    process.env.PUBLIC_BASE_URL || "https://skanare.com"
  ).replace(/\/+$/, "");
}

function productUrl(product) {
  const slug = product.slug || product.id;

  return `${cleanBaseUrl()}/product/${encodeURIComponent(slug)}`;
}

function productImage(product) {
  const image =
    (Array.isArray(product.images) && product.images[0]) ||
    product.image ||
    "/assets/img/logo_Image.png";

  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  return `${cleanBaseUrl()}${
    image.startsWith("/") ? image : `/${image}`
  }`;
}

function productDescription(product) {
  return (
    product.shortDescription ||
    product.description ||
    "QR clothing and accessories by Skanare."
  );
}

function isInStock(product) {
  if (
    Array.isArray(product.variants) &&
    product.variants.length > 0
  ) {
    return product.variants.some(
      (variant) => Number(variant.stock || 0) > 0
    );
  }

  if (typeof product.stock === "number") {
    return product.stock > 0;
  }

  return true;
}

/* =========================================================
   PRODUCT STRUCTURED DATA
========================================================= */

function productJsonLd(product) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",

    name: product.title,

    description: productDescription(product),

    image: productImage(product),

    brand: {
      "@type": "Brand",
      name: "Skanare",
    },

    offers: {
      "@type": "Offer",

      url: productUrl(product),

      price: String(
        product.price ?? product.priceEUR ?? 0
      ),

      priceCurrency: "EUR",

      availability: isInStock(product)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",

      seller: {
        "@type": "Organization",
        name: "Skanare",
      },
    },
  }).replace(/</g, "\\u003c");
}

/* =========================================================
   GENERATE DYNAMIC SEO HTML
========================================================= */

async function renderFullProductPage(product) {
  // Load the real frontend HTML.
  let html = await fs.readFile(
    productDetailsHtmlPath,
    "utf8"
  );

  const url = productUrl(product);

  const title = `${product.title} | Skanare`;

  const description = productDescription(product);

  const image = productImage(product);

  /* -------------------------------------------------------
     REMOVE OLD STATIC METADATA
  ------------------------------------------------------- */

  // Remove old canonical.
  html = html.replace(
    /<link\b[^>]*rel=["']canonical["'][^>]*>/gi,
    ""
  );

  // Remove old description.
  html = html.replace(
    /<meta\b[^>]*name=["']description["'][^>]*>/gi,
    ""
  );

  // Remove old Open Graph metadata.
  html = html.replace(
    /<meta\b[^>]*property=["']og:[^"']+["'][^>]*>/gi,
    ""
  );

  // Remove old Twitter metadata.
  html = html.replace(
    /<meta\b[^>]*name=["']twitter:[^"']+["'][^>]*>/gi,
    ""
  );

  // Remove any existing JSON-LD scripts.
  html = html.replace(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    ""
  );

  /* -------------------------------------------------------
     UPDATE PAGE TITLE
  ------------------------------------------------------- */

  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );

  /* -------------------------------------------------------
     GENERATE PRODUCT METADATA
  ------------------------------------------------------- */

  const metadata = `
    <!-- Dynamic SEO Metadata -->

    <meta
      name="description"
      content="${escapeHtml(description)}"
    />

    <link
      rel="canonical"
      href="${escapeHtml(url)}"
    />

    <!-- Open Graph -->

    <meta
      property="og:site_name"
      content="Skanare"
    />

    <meta
      property="og:type"
      content="product"
    />

    <meta
      property="og:title"
      content="${escapeHtml(title)}"
    />

    <meta
      property="og:description"
      content="${escapeHtml(description)}"
    />

    <meta
      property="og:url"
      content="${escapeHtml(url)}"
    />

    <meta
      property="og:image"
      content="${escapeHtml(image)}"
    />

    <!-- Twitter -->

    <meta
      name="twitter:card"
      content="summary_large_image"
    />

    <meta
      name="twitter:title"
      content="${escapeHtml(title)}"
    />

    <meta
      name="twitter:description"
      content="${escapeHtml(description)}"
    />

    <meta
      name="twitter:image"
      content="${escapeHtml(image)}"
    />

    <!-- Product Structured Data -->

    <script type="application/ld+json">${productJsonLd(product)}</script>
  `;

  /* -------------------------------------------------------
     INSERT METADATA INTO HEAD
  ------------------------------------------------------- */

  if (!/<\/head>/i.test(html)) {
    throw new Error(
      "Product HTML template is missing the closing head tag"
    );
  }

  html = html.replace(
    /<\/head>/i,
    `${metadata}\n</head>`
  );

  return html;
}

/* =========================================================
   PRODUCT SEO ROUTE
========================================================= */

router.get("/product/:slug", async (req, res, next) => {
  try {
    const requestedSlug = req.params.slug;

    /* -----------------------------------------------------
       FETCH PRODUCT
    ----------------------------------------------------- */

    const product = await getProductByIdOrSlug(
      requestedSlug
    );

    /* -----------------------------------------------------
       PRODUCT NOT FOUND
    ----------------------------------------------------- */

    if (!product || product.active === false) {
      return res.status(404).send("Product not found");
    }

    /* -----------------------------------------------------
       CANONICAL URL REDIRECT
    ----------------------------------------------------- */

    const canonicalSlug = String(
      product.slug || product.id
    );

    if (requestedSlug !== canonicalSlug) {
      return res.redirect(
        301,
        `/product/${encodeURIComponent(canonicalSlug)}`
      );
    }

    /* -----------------------------------------------------
       GENERATE HTML WITH CORRECT SEO
    ----------------------------------------------------- */

    const html = await renderFullProductPage(product);

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    res.status(200);

    res.setHeader(
      "Content-Type",
      "text/html; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache"
    );

    return res.send(html);

  } catch (error) {
    next(error);
  }
});

export default router;