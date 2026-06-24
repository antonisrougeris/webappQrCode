import { ApiError } from "./apiError.js";

export function assertString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, `${fieldName} is required`);
  }
  return value.trim();
}

export function assertPositiveInteger(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer`);
  }
  return n;
}

export function optionalUrl(value, fieldName = "url") {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value !== "string") {
    throw new ApiError(400, `${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ApiError(400, `${fieldName} must be a valid URL`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ApiError(400, `${fieldName} must start with http or https`);
  }

  return trimmed;
}

export function normalizeVariantInput(variant) {
  if (!variant) return null;
  if (typeof variant !== "object") {
    throw new ApiError(400, "variant must be an object");
  }

  return {
    sku: typeof variant.sku === "string" ? variant.sku.trim() : "",
    size: typeof variant.size === "string" ? variant.size.trim() : "",
    color: typeof variant.color === "string" ? variant.color.trim() : "",
  };
}
