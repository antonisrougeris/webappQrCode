export const SUPPORTED_LOCALES = Object.freeze(["en", "el"]);

export function normalizeLocale(value) {
  const locale = String(value || "en")
    .trim()
    .toLowerCase()
    .split("-")[0];

  return SUPPORTED_LOCALES.includes(locale)
    ? locale
    : "en";
}

export function localizeProduct(product, locale = "en") {
  const normalized = normalizeLocale(locale);

  if (normalized === "en") {
    return {
      ...product,
      locale: "en",
    };
  }

  const translation =
    product?.translations?.[normalized] || {};

  return {
    ...product,
    title:
      String(translation.title || "").trim() ||
      product.title ||
      "",
    shortDescription:
      String(translation.shortDescription || "").trim() ||
      product.shortDescription ||
      "",
    description:
      String(translation.description || "").trim() ||
      product.description ||
      "",
    locale: normalized,
  };
}
