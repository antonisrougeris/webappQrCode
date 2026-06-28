export function getAllowedOrigins() {
  return String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function corsOptions() {
  const allowedOrigins = getAllowedOrigins();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error("CORS_ORIGIN is required in production");
  }

  return {
    origin(origin, callback) {
  if (!origin) return callback(null, true);

  const allowed = getAllowedOrigins();

  if (allowed.includes(origin)) {
    return callback(null, true);
  }

  console.warn("Blocked CORS origin:", origin);

  return callback(null, false); // NO crash
},
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}
