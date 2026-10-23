import express from "express";
import isAuth from "../middlewares/isAuth.js";
import { getIntegrationCatalogForUser } from "../services/integrationRegistry.service.js";
import {
  buildGoogleAuthUrl,
  disconnectGoogleCalendar,
  handleGoogleCallback,
} from "../services/googleCalendar.service.js";

const integrationRouter = express.Router();

/**
 * GET /api/integrations
 * Returns user-specific catalog with dynamic connection status.
 * Never leaks token credentials or ciphertexts.
 */
integrationRouter.get("/", isAuth, async (req, res) => {
  try {
    const catalog = await getIntegrationCatalogForUser(req.userId);
    return res.status(200).json({
      success: true,
      integrations: catalog,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load integration catalog",
    });
  }
});

/**
 * GET /api/integrations/:id/connect
 * Initiates PKCE OAuth connect flow for connectable integration.
 */
integrationRouter.get("/:id/connect", isAuth, async (req, res) => {
  const { id } = req.params;

  if (id !== "google_calendar") {
    return res.status(404).json({
      success: false,
      message: `Integration '${id}' is not connectable or not supported in this phase.`,
    });
  }

  try {
    const authUrl = buildGoogleAuthUrl(req.userId);
    return res.redirect(302, authUrl);
  } catch (err) {
    const status = err.message?.includes("not configured") || err.message?.includes("is required") ? 503 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to initiate OAuth connect flow",
    });
  }
});

/**
 * GET /api/integrations/callback
 * OAuth callback endpoint from provider.
 * Validates state HMAC/nonce, exchanges code for tokens, and redirects back to frontend.
 */
integrationRouter.get("/callback", async (req, res) => {
  const { code, state, error: providerError } = req.query;

  const clientOrigin = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",")[0].trim();

  if (providerError) {
    const sanitizedReason = encodeURIComponent(String(providerError).slice(0, 50));
    return res.redirect(302, `${clientOrigin}/home?integration=google_calendar&status=error&reason=${sanitizedReason}`);
  }

  if (!code || !state) {
    return res.redirect(302, `${clientOrigin}/home?integration=google_calendar&status=error&reason=missing_code_or_state`);
  }

  try {
    await handleGoogleCallback(code, state);
    return res.redirect(302, `${clientOrigin}/home?integration=google_calendar&status=connected`);
  } catch (err) {
    const reason = encodeURIComponent((err.message || "exchange_failed").slice(0, 50));
    return res.redirect(302, `${clientOrigin}/home?integration=google_calendar&status=error&reason=${reason}`);
  }
});

/**
 * DELETE /api/integrations/:id/disconnect
 * Revokes external token and removes token from user document.
 */
integrationRouter.delete("/:id/disconnect", isAuth, async (req, res) => {
  const { id } = req.params;

  if (id !== "google_calendar") {
    return res.status(404).json({
      success: false,
      message: `Unknown or unsupported integration '${id}'`,
    });
  }

  try {
    const result = await disconnectGoogleCalendar(req.userId);
    return res.status(200).json({
      success: true,
      id,
      ...result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to disconnect integration",
    });
  }
});

export default integrationRouter;
