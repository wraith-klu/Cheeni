import { verifyAccessToken } from "../config/token.js";
import jwt from "jsonwebtoken";

/**
 * Authentication Middleware: Verifies the short-lived ACCESS TOKEN.
 * Looks for token in Authorization header (Bearer <token>) first,
 * then falls back to `token` / `accessToken` cookie.
 *
 * If expired, returns HTTP 401 with `{ error: "token_expired" }`
 * to signal the client to attempt a silent refresh via /api/auth/refresh.
 */
const isAuth = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized, access token not found",
        error: "token_not_found",
      });
    }

    try {
      const decoded = verifyAccessToken(token);
      req.userId = decoded.userId;
      req.tokenVersion = decoded.tokenVersion;
      return next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          message: "Access token expired. Please refresh token.",
          error: "token_expired",
        });
      }
      return res.status(401).json({
        message: "Unauthorized, invalid token",
        error: "invalid_token",
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error during authentication",
      error: error.message,
    });
  }
};

export default isAuth;