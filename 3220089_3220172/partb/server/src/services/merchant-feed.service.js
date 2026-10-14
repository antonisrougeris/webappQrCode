/** Google Merchant Center scheduled-fetch RSS 2.0 catalog, from live Firestore products. */
import { listProductsService } from "./product.service.js";
import { getEffectiveUnitPrice } from "./product-pricing.service.js";

export function escapeXml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const baseUrl = () => String(process.env.PUBLIC_BASE_URL || "https://skanare.com").replace(/\/+$/, "");
function absoluteImage(value) {
  const src = String(value || "").trim();
  if (/^https:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return baseUrl() + src;
  return "";
}
const cash = value => Number(value).toFixed(2) + " EUR";
function imagesFor(product, variant) {
  const c = (product.colorOptions || []).find(x =>
    String(x.name || "").toLowerCase() === String(variant?.color || "").toLowerCase()
  );
  // Color-specific galleries must not mix black and white imagery.
  // Admin product galleries often contain repeated entries from multiple
  // color sets; never emit duplicate additional_image_link URLs.
  const gallery = Array.isArray(c?.images) && c.images.length
    ? c.images
    : [...(product.images || []), product.image];
  return [...new Set(gallery.map(absoluteImage).filter(Boolean))];
}

export function productToMerchantEntries(product) {
  if (!product || product.active === false || !product.id || !product.title) return [];
  const group = String(product.id);
  const slug = String(product.slug || product.id);
  const url = baseUrl() + "/product/" + encodeURIComponent(slug);
  const variants = Array.isArray(product.variants) && product.variants.length ? product.variants : [null];
  const apparel = String(product.category || "").toLowerCase() === "tshirt";
  const description = String(product.description || product.shortDescription || product.title).trim();
  return variants.flatMap(variant => {
    const stock = Number(variant ? variant.stock : product.stock);
    const regular = Number(variant?.price ?? product.originalPrice ?? product.price);
    const effective = Number(getEffectiveUnitPrice(
      { ...product, price: variant?.price ?? product.originalPrice ?? product.price },
      variant
    ));
    const images = imagesFor(product, variant);
    if (!images.length || !Number.isFinite(regular) || regular <= 0 ||
        !Number.isFinite(effective) || effective <= 0) return [];
    const sku = String(variant?.sku || "").trim();
    if (variant && !sku) return []; // Google needs stable variant IDs.
    const id = variant ? group + "::" + sku : group;
    // Google's item_group_id groups true sibling variants, not the one
    // standalone NFC keychain. Each SKU keeps its existing stable ID.
    const grouped = Boolean(variant && variants.length > 1);
    // Deep-link the exact SKU so a Merchant Center visitor sees the same
    // color/size as the Google listing instead of the default selection.
    const landingUrl = sku ? url + "?variant=" + encodeURIComponent(sku) : url;
    const title = [product.title, variant?.color, variant?.size].filter(Boolean).join(" - ");
    const color = String(variant?.color || "").trim();
    const size = String(variant?.size || "").trim();
    return [{
      id, group, title, description, url: landingUrl, grouped,
      image: images[0], additionalImages: images.slice(1, 11),
      availability: Number.isFinite(stock) && stock > 0 ? "in_stock" : "out_of_stock",
      price: Math.round(regular * 100) / 100,
      salePrice: Math.round(effective * 100) / 100,
      variant: Boolean(variant), apparel, color, size
    }];
  });
}

export function renderMerchantXml(products) {
  const entries = products.flatMap(productToMerchantEntries);
  const items = entries.map(entry => {
    const nodes = [
      ["g:id", entry.id], ["title", entry.title], ["description", entry.description],
      ["link", entry.url], ["g:image_link", entry.image],
      ["g:availability", entry.availability], ["g:condition", "new"],
      ["g:price", cash(entry.price)], ["g:brand", "Skanare"],
      ["g:identifier_exists", "no"], ["g:google_product_category", entry.apparel ? "Apparel & Accessories > Clothing > Shirts & Tops" : "Apparel & Accessories"],
      ...(entry.salePrice < entry.price ? [["g:sale_price", cash(entry.salePrice)]] : []),
      ...(entry.grouped ? [["g:item_group_id", entry.group]] : []),
      ...(entry.apparel ? [["g:gender", "unisex"], ["g:age_group", "adult"]] : []),
      ...(entry.color ? [["g:color", entry.color]] : []),
      ...(entry.size ? [["g:size", entry.size]] : []),
      ...entry.additionalImages.map(img => ["g:additional_image_link", img])
    ];
    return "<item>\n" + nodes.map(([tag, val]) =>
      `<${tag}>${escapeXml(val)}</${tag}>`).join("\n") + "\n</item>";
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>\n<title>Skanare Products</title>\n<link>${escapeXml(baseUrl())}</link>\n<description>Live products and availability from skanare.com</description>\n${items}\n</channel></rss>`;
}

export async function getMerchantFeed() {
  const products = await listProductsService({ locale: "en" });
  return renderMerchantXml(products);
}
