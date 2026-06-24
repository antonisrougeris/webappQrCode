import { z } from "zod";
import { ApiError } from "./apiError.js";

export const quantitySchema = z.coerce.number().int().min(1).max(99);
export const idSchema = z.string().trim().min(1).max(160);
export const noteSchema = z.string().trim().max(1000).optional().default("");

export const checkoutSchema = z.object({
  customer: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(40).optional().default(""),
  }),
  shippingAddress: z.object({
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    email: z.string().trim().email().max(254).optional(),
    phone: z.string().trim().max(40).optional(),
    country: z.string().trim().max(80).optional().default("Greece"),
    city: z.string().trim().min(1).max(120),
    postalCode: z.string().trim().max(20).optional().default(""),
    addressLine1: z.string().trim().min(1).max(180),
    addressLine2: z.string().trim().max(180).optional().default(""),
  }),
  delivery: z.enum(["home", "boxnow"]).optional().default("home"),
  locker: z.any().optional().nullable(),
  notes: z.string().trim().max(1000).optional().default(""),
});

export function parseOrThrow(schema, value, message = "Invalid request body") {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, message, result.error.flatten());
  }
  return result.data;
}

export function normalizeUrlOrThrow(value, field = "url") {
  const raw = String(value || "").trim();
  if (!raw) throw new ApiError(400, `${field} is required`);

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError(400, `${field} must be a valid URL`);
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new ApiError(400, `${field} must use http or https`);
  }

  return url.toString();
}

export function assertString(value, field = "value") {
  const result = String(value || "").trim();

  if (!result) {
    throw new ApiError(400, `${field} is required`);
  }

  return result;
}

export function assertPositiveInteger(value, field = "value") {
  const num = Number(value);

  if (!Number.isInteger(num) || num < 1) {
    throw new ApiError(400, `${field} must be a positive integer`);
  }

  return num;
}

export function optionalUrl(value, field = "url") {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return normalizeUrlOrThrow(value, field);
}

export function normalizeVariantInput(value) {
  if (!value) {
    return null;
  }

  if (typeof value !== "object") {
    throw new ApiError(400, "variant must be an object");
  }

  return {
    sku: String(value.sku || "").trim(),
    size: String(value.size || "").trim(),
    color: String(value.color || "").trim(),
  };
}
