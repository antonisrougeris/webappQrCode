import { Router } from "express";
import { getProductByIdOrSlug } from "../services/product.service.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productDetailsHtmlPath = path.resolve(
  __dirname,
  "../../../client/dist/src/pages/product-details/product-details.html"
);

const router = Router();

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || "https://skanare.com").replace(
    /\/+$/,
    ""
  );
}

function productUrl(product) {
  const baseUrl = cleanBaseUrl();
  const slug = product.slug || product.id;

  return `${baseUrl}/product/${encodeURIComponent(slug)}`;
}

function productImage(product) {
  const image =
    (Array.isArray(product.images) && product.images[0]) ||
    product.image ||
    "/assets/img/logo_Image.png";

  if (/^https?:\/\//i.test(image)) return image;

  return `${cleanBaseUrl()}${image.startsWith("/") ? image : `/${image}`}`;
}

function productDescription(product) {
  return (
    product.shortDescription ||
    product.description ||
    "QR clothing and accessories by Skanare."
  );
}

function isInStock(product) {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.some((variant) => Number(variant.stock || 0) > 0);
  }

  if (typeof product.stock === "number") return product.stock > 0;

  return true;
}

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
      price: String(product.price || product.priceEUR || 0),
      priceCurrency: "EUR",
      availability: isInStock(product)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "Skanare",
      },
    },
  });
}

function renderProductHtml(product) {
  const baseUrl = cleanBaseUrl();
  const title = `${product.title} | Skanare`;
  const description = productDescription(product);
  const url = productUrl(product);
  const image = productImage(product);
  const clientProductUrl = `https://skanare.com/product/${encodeURIComponent(
    product.slug || product.id
  )}`;



  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escapeHtml(url)}" />

  <meta property="og:site_name" content="Skanare" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <script type="application/ld+json">${productJsonLd(product)}</script>

</head>
<body>
  <h1>${escapeHtml(product.title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p>
    <a href="${escapeHtml(clientProductUrl)}">View product</a>
  </p>
</body>
</html>`;
}

function isBot(userAgent = "") {
  return /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot/i.test(
    String(userAgent)
  );
}



router.get("/product/:slug", async (req, res, next) => {
  try {
    const product = await getProductByIdOrSlug(req.params.slug);

    const userAgent = req.headers["user-agent"] || "";

    if (!isBot(userAgent)) {
      return res.sendFile(productDetailsHtmlPath);
    }

    res.status(200);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.send(renderProductHtml(product));
  } catch (error) {
    next(error);
  }
});

export default router;