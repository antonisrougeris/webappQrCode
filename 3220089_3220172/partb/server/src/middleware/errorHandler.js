/* 3220089_3220172  2025 */

export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  res.status(status).json({
    error: true,
    message: err.message || "Server error",
  });
}
