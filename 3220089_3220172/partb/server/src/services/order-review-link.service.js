/**
 * The order snapshot stores item.slug and item.productId at checkout.
 * Link to the FIRST purchased product's review section. Never trust a
 * product title, arbitrary URL or customer-supplied path in an email href.
 */
export function getDeliveredOrderReviewUrl(order) {
  const first = Array.isArray(order?.items) ? order.items[0] : null;

  for (const value of [first?.slug, first?.productId]) {
    const identifier = String(value ?? "").trim();
    // Product identifiers are URL path segments, not URLs or paths.
    if (/^[a-z0-9][a-z0-9_-]*$/i.test(identifier)) {
      return `https://skanare.com/product/${encodeURIComponent(identifier)}#productReviews`;
    }
  }

  // Older orders without an identifiable first product remain actionable.
  return "https://skanare.com/products";
}
