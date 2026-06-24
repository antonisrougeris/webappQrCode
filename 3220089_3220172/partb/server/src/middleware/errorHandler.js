import { ApiError } from "../utils/apiError.js";

export function errorHandler(err, req, res, next) {
  console.error(err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || null,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
