import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";

/**
 * Key generator: extracts authenticated userId from request object or JWT cookie,
 * falling back to IPv6-normalized IP address for unauthenticated clients.
 * This prevents clients on shared NAT / corporate networks from sharing rate limit buckets.
 *
 * NOTE: Currently uses default in-memory store. For multi-instance horizontal scaling
 * across cluster nodes, configure rate-limit-redis.
 */
export const getUserOrIpKey = (req) => {
  if (req.userId) {
    return `user:${req.userId}`;
  }

  // If auth middleware hasn't run yet, check Authorization header or cookie
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith("Bearer ")) 
    ? authHeader.split(" ")[1] 
    : (req.cookies?.accessToken || req.cookies?.token);

  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (token && secret) {
    try {
      const decoded = jwt.verify(token, secret);
      if (decoded?.userId) {
        req.userId = decoded.userId;
        return `user:${decoded.userId}`;
      }
    } catch {
      // Invalid/expired token falls back to IP
    }
  }

  return `ip:${ipKeyGenerator(req)}`;
};

/**
 * Standard 429 response handler format
 */
const rateLimitHandler = (message) => (req, res, _next, options) => {
  const retryAfterSec = Math.ceil(
    (options.windowMs - (Date.now() - (req.rateLimit?.resetTime?.getTime() || Date.now()))) / 1000
  ) || 60;

  return res.status(options.statusCode).json({
    error: message,
    retryAfter: retryAfterSec,
  });
};

/**
 * a) aiAssistantLimiter: Strict limit for /api/assistant/ask (Gemini / OpenRouter LLM)
 * 15 requests per 1 minute per authenticated user (or per IP if unauthenticated)
 */
export const aiAssistantLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: getUserOrIpKey,
  handler: rateLimitHandler("Too many requests. Please wait before trying again."),
});

/**
 * b) authLimiter: Strict limit for auth endpoints (/signup, /signin)
 * 5 requests per 10 minutes per IP to prevent brute-force attacks and account spam
 */
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => `ip:${ipKeyGenerator(req)}`,
  handler: rateLimitHandler("Too many authentication attempts. Please try again after 10 minutes."),
});

/**
 * c) generalApiLimiter: Default loose limit for all other /api/* routes
 * 100 requests per 1 minute per user / IP
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: getUserOrIpKey,
  handler: rateLimitHandler("Too many requests to the API. Please wait a moment."),
});
