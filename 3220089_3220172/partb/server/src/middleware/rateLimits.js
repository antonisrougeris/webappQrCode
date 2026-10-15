import rateLimit from "express-rate-limit";

/**
 * Normal storefront browsing generates several reads per page. Keep those
 * reads separate from the API mutation budget without exempting them from
 * rate limiting. Only read-only methods to the public product/cart/review
 * paths qualify; authentication, checkout and all writes remain protected.
 */
export function isStorefrontReadRequest(req) {
  const method = String(req?.method || "").toUpperCase();
  const pathname = String(req?.originalUrl || req?.url || "").split("?")[0];
  return (method === "GET" || method === "HEAD") &&
    /^\/api\/(?:products|cart|reviews)(?:\/|$)/.test(pathname);
}

function buildLimiter({ windowMs, limit, message, skip }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    ...(skip ? { skip } : {}),
    message: {
      success: false,
      message,
    },
  });
}

export const storefrontReadLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 1800,
  message: "Too many storefront requests, please try again later",
  skip: (req) => !isStorefrontReadRequest(req),
});

export const apiLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: "Too many requests, please try again later",
  skip: isStorefrontReadRequest,
});

// Additional budget for the intentionally enumerable checkout lookup.
export const accountStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    console.warn("checkout_account_status_rate_limited", { requestId: req.requestId || null });
    res.status(429).json({ success: false, message: "Too many account lookups, please try again later" });
  },
});

export const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: "Too many authentication requests, please try again later",
});

export const sensitiveAuthLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  message: "Too many verification or password reset requests",
});

export const checkoutLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many checkout attempts, please try again later",
});

export const contactLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many contact messages, please try again later",
});

export const adminLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 180,
  message: "Too many admin requests, please try again later",
});

export const webhookLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: 180,
  message: "Too many webhook requests",
});
