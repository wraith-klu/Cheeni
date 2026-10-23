import crypto from "crypto";
import User from "../model/user.model.js";
import { decryptToken, encryptToken, getEncryptionKey } from "../utils/tokenEncryption.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

// In-memory PKCE & State Cache (5 min TTL) bound to random nonces
// Map<stateString, { userId: string, codeVerifier: string, expiresAt: number }>
const oauthStateCache = new Map();

function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, entry] of oauthStateCache.entries()) {
    if (entry.expiresAt <= now) {
      oauthStateCache.delete(state);
    }
  }
}

/**
 * Generate PKCE code_verifier and code_challenge (S256)
 */
export function generatePkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

/**
 * Generate a cryptographically bound state token with 5-minute TTL
 */
export function generateOAuthState(userId) {
  cleanupExpiredStates();
  const nonce = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const state = `state_${nonce}`;
  return { state, expiresAt };
}

/**
 * Builds the Google authorization redirect URL.
 * Checks required environment variables.
 */
export function buildGoogleAuthUrl(userId) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:2025/api/integrations/callback";

  if (!clientId || !clientId.trim()) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  // Ensure encryption key is configured before initiating connect flow
  getEncryptionKey();

  const { verifier, challenge } = generatePkcePair();
  const { state, expiresAt } = generateOAuthState(userId);

  oauthStateCache.set(state, {
    userId: String(userId),
    codeVerifier: verifier,
    expiresAt,
  });

  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri.trim(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Verifies OAuth state and retrieves matching context.
 * Consumes state to prevent replay attacks.
 */
export function consumeOAuthState(state) {
  cleanupExpiredStates();
  if (!state || typeof state !== "string" || !oauthStateCache.has(state)) {
    return null;
  }
  const entry = oauthStateCache.get(state);
  oauthStateCache.delete(state);

  if (Date.now() > entry.expiresAt) {
    return null;
  }
  return entry;
}

/**
 * Exchanges authorization code and code_verifier for tokens, encrypts them, and persists to User doc.
 */
export async function handleGoogleCallback(code, state) {
  const stateContext = consumeOAuthState(state);
  if (!stateContext) {
    const err = new Error("Invalid, expired, or replayed OAuth state parameter");
    err.status = 400;
    throw err;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:2025/api/integrations/callback";

  if (!clientId || !clientSecret) {
    const err = new Error("Google OAuth credentials missing on server");
    err.status = 503;
    throw err;
  }

  const bodyParams = new URLSearchParams({
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    code,
    code_verifier: stateContext.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri.trim(),
  });

  let tokenData;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const err = new Error(`Google token exchange failed: HTTP ${res.status}`);
      err.status = 502;
      throw err;
    }

    tokenData = await res.json();
  } catch (fetchErr) {
    if (fetchErr.status) throw fetchErr;
    const err = new Error("Network error contacting Google OAuth token endpoint");
    err.status = 502;
    throw err;
  }

  if (!tokenData.access_token) {
    const err = new Error("No access_token returned by Google");
    err.status = 502;
    throw err;
  }

  // Encrypt access token
  const encAccess = encryptToken(tokenData.access_token);
  let encRefresh = null;
  if (tokenData.refresh_token) {
    encRefresh = encryptToken(tokenData.refresh_token);
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : new Date(Date.now() + 3600 * 1000);

  const tokenRecord = {
    iv: encAccess.iv,
    ciphertext: encAccess.ciphertext,
    tag: encAccess.tag,
    refreshIv: encRefresh ? encRefresh.iv : undefined,
    refreshCiphertext: encRefresh ? encRefresh.ciphertext : undefined,
    refreshTag: encRefresh ? encRefresh.tag : undefined,
    expiresAt,
    scope: tokenData.scope || GOOGLE_CALENDAR_SCOPES.join(" "),
    connectedAt: new Date(),
  };

  await User.findByIdAndUpdate(stateContext.userId, {
    $set: { "integrationTokens.google_calendar": tokenRecord },
  });

  return { userId: stateContext.userId, integration: "google_calendar" };
}

/**
 * Disconnects Google Calendar integration:
 * 1. Revokes token at Google if possible (best effort).
 * 2. Deletes integrationTokens.google_calendar from User record in MongoDB.
 */
export async function disconnectGoogleCalendar(userId) {
  if (!userId) {
    throw new Error("userId is required to disconnect integration");
  }

  const user = await User.findById(userId).select("integrationTokens");
  if (!user) {
    return { success: true, alreadyDisconnected: true };
  }

  let tokenEntry = null;
  if (user.integrationTokens instanceof Map) {
    tokenEntry = user.integrationTokens.get("google_calendar");
  } else if (user.integrationTokens) {
    tokenEntry = user.integrationTokens["google_calendar"];
  }

  // Best-effort provider token revocation
  if (tokenEntry?.ciphertext) {
    try {
      const accessToken = decryptToken({
        iv: tokenEntry.iv,
        ciphertext: tokenEntry.ciphertext,
        tag: tokenEntry.tag,
      });

      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(accessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    } catch {
      // Continue even if decryption or network fails
    }
  }

  await User.findByIdAndUpdate(userId, {
    $unset: { "integrationTokens.google_calendar": 1 },
  });

  return { success: true, id: "google_calendar" };
}

/**
 * Internal token refresh helper
 */
async function refreshGoogleAccessToken(userId, tokenEntry) {
  if (!tokenEntry?.refreshCiphertext) {
    throw new Error("No refresh token available; user must reconnect Google Calendar.");
  }

  const refreshToken = decryptToken({
    iv: tokenEntry.refreshIv,
    ciphertext: tokenEntry.refreshCiphertext,
    tag: tokenEntry.refreshTag,
  });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh Google Calendar token. Please reconnect.");
  }

  const data = await res.json();
  const encAccess = encryptToken(data.access_token);
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

  const updatedRecord = {
    ...tokenEntry,
    iv: encAccess.iv,
    ciphertext: encAccess.ciphertext,
    tag: encAccess.tag,
    expiresAt,
  };

  await User.findByIdAndUpdate(userId, {
    $set: { "integrationTokens.google_calendar": updatedRecord },
  });

  return data.access_token;
}

/**
 * Sanitizes event fields according to Phase 7 untrusted input policy:
 * - Plain text only (strip HTML tags)
 * - Excludes attendee email addresses
 * - Caps descriptions at 500 characters
 */
export function sanitizeCalendarEvent(rawEvent) {
  if (!rawEvent || typeof rawEvent !== "object") return null;

  const stripHtml = (str) => {
    if (typeof str !== "string") return "";
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]*>/g, "")
      .trim();
  };

  const summary = stripHtml(rawEvent.summary || "Untitled Event").slice(0, 200);
  const location = stripHtml(rawEvent.location || "").slice(0, 200);
  const rawDesc = stripHtml(rawEvent.description || "").slice(0, 500);

  const start = rawEvent.start?.dateTime || rawEvent.start?.date || null;
  const end = rawEvent.end?.dateTime || rawEvent.end?.date || null;
  const organizer = rawEvent.organizer?.displayName || (rawEvent.organizer?.email ? "Organizer" : undefined);
  const attendeeCount = Array.isArray(rawEvent.attendees) ? rawEvent.attendees.length : 0;

  return {
    title: summary,
    start,
    end,
    location: location || undefined,
    description: rawDesc || undefined,
    organizer: organizer || undefined,
    attendee_count: attendeeCount,
  };
}

/**
 * Validate date range:
 * - Valid ISO8601 strings
 * - Maximum 31 days span
 * - Must not be further than 90 days in the past
 */
export function validateDateRange(startIso, endIso) {
  if (!startIso || !endIso) {
    return { valid: false, error: "Both start and end dates are required in ISO8601 format." };
  }

  const start = new Date(startIso);
  const end = new Date(endIso);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: "Invalid date format; must be standard ISO8601." };
  }

  if (end <= start) {
    return { valid: false, error: "End date must be after start date." };
  }

  const diffMs = end.getTime() - start.getTime();
  const maxSpanMs = 31 * 24 * 60 * 60 * 1000;
  if (diffMs > maxSpanMs) {
    return { valid: false, error: "Date range cannot exceed 31 days." };
  }

  const pastLimitMs = 90 * 24 * 60 * 60 * 1000;
  const oldestAllowed = Date.now() - pastLimitMs;
  if (start.getTime() < oldestAllowed) {
    return { valid: false, error: "Queries cannot look back further than 90 days in the past." };
  }

  return { valid: true, start, end };
}

/**
 * Tool implementation: getEvents
 * - Loads and decrypts Google Calendar token for user
 * - Fetches events from Google Calendar API
 * - Sanitizes, bounds payload to max 50 KB, treats as untrusted
 */
export async function getCalendarEvents(userId, { date_range, max_results = 10 }) {
  if (!userId) {
    return { success: false, error: "User is not authenticated." };
  }

  let user = null;
  try {
    user = await User.findById(userId).select("integrationTokens");
  } catch {
    // If invalid ObjectId or DB error, treat as not connected
    user = null;
  }
  let tokenEntry = null;
  if (user?.integrationTokens instanceof Map) {
    tokenEntry = user.integrationTokens.get("google_calendar");
  } else if (user?.integrationTokens) {
    tokenEntry = user.integrationTokens["google_calendar"];
  }

  if (!tokenEntry?.ciphertext) {
    return {
      success: false,
      error: "Google Calendar is not connected. Please connect it in the Integrations panel.",
    };
  }

  // Validate dates
  const validation = validateDateRange(date_range?.start, date_range?.end);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Retrieve or refresh access token
  let accessToken;
  try {
    const isExpired = tokenEntry.expiresAt && new Date(tokenEntry.expiresAt) <= new Date(Date.now() + 60000);
    if (isExpired && tokenEntry.refreshCiphertext) {
      accessToken = await refreshGoogleAccessToken(userId, tokenEntry);
    } else {
      accessToken = decryptToken({
        iv: tokenEntry.iv,
        ciphertext: tokenEntry.ciphertext,
        tag: tokenEntry.tag,
      });
    }
  } catch (tokenErr) {
    return {
      success: false,
      error: `Calendar authorization failed: ${tokenErr.message}`,
    };
  }

  const boundedMaxResults = Math.min(Math.max(1, parseInt(max_results, 10) || 10), 25);

  const queryParams = new URLSearchParams({
    timeMin: validation.start.toISOString(),
    timeMax: validation.end.toISOString(),
    maxResults: String(boundedMaxResults),
    singleEvents: "true",
    orderBy: "startTime",
  });

  try {
    const response = await fetch(`${CALENDAR_EVENTS_URL}?${queryParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 401 && tokenEntry.refreshCiphertext) {
      // Attempt single refresh on 401
      accessToken = await refreshGoogleAccessToken(userId, tokenEntry);
      const retryRes = await fetch(`${CALENDAR_EVENTS_URL}?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!retryRes.ok) {
        return { success: false, error: `Google Calendar API returned HTTP ${retryRes.status}` };
      }
      const data = await retryRes.json();
      const sanitized = (data.items || []).map(sanitizeCalendarEvent).filter(Boolean);
      return {
        success: true,
        events: sanitized,
        count: sanitized.length,
        source: "google_calendar",
        trusted: false,
      };
    }

    if (!response.ok) {
      return { success: false, error: `Google Calendar API returned HTTP ${response.status}` };
    }

    const data = await response.json();
    const sanitized = (data.items || []).map(sanitizeCalendarEvent).filter(Boolean);

    // Enforce 50 KB payload cap
    let payloadStr = JSON.stringify(sanitized);
    if (Buffer.byteLength(payloadStr, "utf8") > 50 * 1024) {
      sanitized.length = Math.max(1, Math.floor(sanitized.length / 2));
    }

    return {
      success: true,
      events: sanitized,
      count: sanitized.length,
      source: "google_calendar",
      trusted: false,
    };
  } catch (apiErr) {
    return {
      success: false,
      error: `Calendar request error: ${apiErr.message}`,
    };
  }
}
