/* 3220089_3220172  2025 */

import { getAuthService } from "../config/db.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: true, message: "Missing Bearer token" });
  }

  try {
    const decoded = await getAuthService().verifyIdToken(token);
    req.user = {
      ...decoded,
      sub: decoded.uid,
    };
    next();
  } catch {
    return res.status(401).json({ error: true, message: "Invalid or expired token" });
  }
}
