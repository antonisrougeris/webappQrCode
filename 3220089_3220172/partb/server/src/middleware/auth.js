import { getAuthService } from "../config/db.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
      });
    }

    const decoded = await getAuthService().verifyIdToken(token);

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      admin: !!decoded.admin,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type === "Bearer" && token) {
      const decoded = await getAuthService().verifyIdToken(token);

      req.user = {
        uid: decoded.uid,
        email: decoded.email || null,
        name: decoded.name || null,
        admin: !!decoded.admin,
      };
    }
  } catch {
    // ignore invalid token
  }

  const guestId = req.headers["x-guest-id"];
  if (!req.user && guestId) {
    req.guestId = guestId;
  }

  next();
}
