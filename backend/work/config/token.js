import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_TOKEN_SECRET = () => process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "fallback_access_secret";
const REFRESH_TOKEN_SECRET = () => process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret";
const REFRESH_EXPIRY = () => process.env.REFRESH_TOKEN_EXPIRY || "7d";

/**
 * Generate a short-lived access token (15 minutes).
 * Minimal payload: userId and tokenVersion.
 */
export const genAccessToken = (userId, tokenVersion = 0) => {
  return jwt.sign(
    { userId, tokenVersion },
    ACCESS_TOKEN_SECRET(),
    { expiresIn: "15m" }
  );
};

/**
 * Generate a long-lived refresh token (e.g. 7 days).
 * Contains userId and tokenVersion.
 */
export const genRefreshToken = (userId, tokenVersion = 0) => {
  return jwt.sign(
    { userId, tokenVersion },
    REFRESH_TOKEN_SECRET(),
    { expiresIn: REFRESH_EXPIRY() }
  );
};

/**
 * Verify an access token.
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET());
};

/**
 * Verify a refresh token.
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET());
};

/**
 * SHA-256 hash helper for storing rotated refresh tokens in DB.
 */
export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Helper to set the httpOnly refresh token cookie on Express response.
 */
export const setRefreshTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
};

/**
 * Helper to clear the refresh token cookie.
 */
export const clearRefreshTokenCookie = (res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/auth",
  });
};

/**
 * Backward compatibility alias for legacy call sites.
 */
export const genToken = async (userId) => {
  return genAccessToken(userId);
};
