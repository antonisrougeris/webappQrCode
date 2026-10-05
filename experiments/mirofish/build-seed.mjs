import fs from "node:fs/promises";
import path from "node:path";

const root = new URL("./", import.meta.url);
const outputDir = path.join(new URL("generated/", root).pathname);
const outputFile = path.join(outputDir, "skanare-live-seed.md");

const API_URL =
  process.env.SKANARE_PRODUCTS_URL ||
  "https://skanare.com/api/products";

function money(value, currency = "EUR") {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `${amount.toFixed(2)} ${currency}`
    : `0.00 ${currency}`;
}

function stockSummary(product) {
  if (Array.isArray(product.variants) && product.variants.length) {
    const total = product.variants.reduce(
      (sum, variant) => sum + Math.max(0, Number(variant?.stock || 0)),
      0
    );

    const variants = product.variants
      .map((variant) => {
        const labels = [
          variant?.size ? `size=${variant.size}` : "",
          variant?.color ? `color=${variant.color}` : "",
          variant?.sku ? `sku=${variant.sku}` : "",
          `stock=${Math.max(0, Number(variant?.stock || 0))}`,
        ].filter(Boolean);

        return `  - ${labels.join(", ")}`;
      })
      .join("\n");

    return `Total available stock: ${total}\nVariants:\n${variants}`;
  }

  return `Available stock: ${Math.max(0, Number(product?.stock || 0))}`;
}

async function fetchProducts() {
  const response = await fetch(API_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Skanare-MiroFish-Seed-Builder/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch live Skanare products: HTTP ${response.status}`
    );
  }

  const payload = await response.json();

  const products = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.products)
      ? payload.products
      : [];

  return products.filter((product) => product?.active !== false);
}

const products = await fetchProducts();

const productSections = products
  .map((product, index) => {
    const images = Array.isArray(product.images)
      ? product.images.filter(Boolean)
      : product.image
        ? [product.image]
        : [];

    return `
## Product ${index + 1}: ${product.title || product.slug || product.id}

- ID: ${product.id || ""}
- Slug: ${product.slug || ""}
- Category: ${product.category || ""}
- Price: ${money(product.price ?? product.priceEUR, product.currency || "EUR")}
- Featured: ${Boolean(product.featured)}
- Custom/editable QR: ${product.customQr !== false}
- Short description: ${product.shortDescription || ""}
- Description: ${product.description || ""}
- Product page: https://skanare.com/product/${encodeURIComponent(product.slug || product.id || "")}
- Images: ${images.join(", ") || "not supplied"}

${stockSummary(product)}
`;
  })
  .join("\n");

const document = `# Skanare — synthetic customer research seed

Generated from the live public product API: ${new Date().toISOString()}

## Important research constraint

This document is seed material for a synthetic multi-agent simulation. The simulated people are not real customers and their reactions are not survey results, conversion data, or statistically representative evidence. Use the output to generate hypotheses and prioritise real-user tests.

## Business and product concept

Skanare is an e-commerce brand for physical products containing a dynamic QR code. A buyer can choose a product, associate the QR with a destination such as a website, social profile, portfolio, event page, business page, or other supported URL, and later update that destination without replacing the printed physical QR code.

The product experience combines fashion/accessories with a persistent digital link. Public positioning includes QR clothing and accessories for creators, brands, events, networking and personal use.

Storefront: https://skanare.com/
Products: https://skanare.com/products

## Core customer journey to pressure-test

1. Visitor lands on the Skanare home page.
2. Visitor needs to understand what a dynamic QR product is and why it is useful.
3. Visitor browses products.
4. Visitor opens a product page.
5. Visitor selects size/color where applicable.
6. Visitor supplies or confirms a QR destination.
7. Visitor adds the item to cart and proceeds to checkout.
8. Visitor signs in/registers when required.
9. Visitor pays.
10. The order is prepared and shipped.
11. Customer receives the physical item.
12. Customer can sign in later and update the QR destination from their account.
13. Returns are subject to the applicable return policy and eligibility window.

## Research themes

Pressure-test:
- immediate understanding of the value proposition
- willingness to scan a QR worn or carried by another person
- perceived usefulness versus novelty/gimmick risk
- privacy and security concerns
- trust that the QR destination can be changed later
- concern that Skanare must remain online for redirects to continue working
- product quality and print durability
- pricing and willingness to pay
- sizing/variants
- confidence before checkout
- account creation friction
- shipping expectations
- returns/refunds expectations
- usefulness of account-based QR management
- use cases for creators, networking, nightlife, events, brands and small businesses

## Live active catalogue

${productSections}

## Expected output

Use the accompanying study prompt to produce:
- customer-segment reactions
- objections
- trust concerns
- confusion points
- purchase-friction hypotheses
- ranked recommendations
- hypotheses that require validation with real human users
`;

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputFile, document, "utf8");

console.log(`Created ${outputFile}`);
console.log(`Included ${products.length} active live products.`);
