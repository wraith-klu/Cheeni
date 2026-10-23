/**
 * Cheeni Desktop Agent Proxy Routes (Step 3)
 * Express router that proxies requests to the Python Desktop Agent at http://127.0.0.1:2026
 * The Node backend acts as a secure gateway — the browser never talks to the Python agent directly.
 *
 * Routes:
 *   GET  /api/agent/status        → System snapshot (battery, CPU, RAM, disk)
 *   GET  /api/agent/battery       → Battery status only
 *   GET  /api/agent/volume        → Current volume level
 *   POST /api/agent/volume        → Set volume  { level: 50 }
 *   POST /api/agent/volume/mute   → Mute
 *   POST /api/agent/volume/unmute → Unmute
 *   POST /api/agent/launch        → Launch app { app: "notepad" }
 *   GET  /api/agent/ping          → Check if agent is alive (no auth needed)
 */

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import isAuth from "../middlewares/isAuth.js";
import { executeDesktopTool, validateDesktopTool } from "../services/desktopAgent.service.js";
import { LOCAL_COMMAND_TOOLS } from "../services/toolsSchema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const agentRouter = express.Router();
const AGENT_BASE = (process.env.AGENT_BASE_URL || "http://127.0.0.1:2026").replace(/\/$/, "");

/**
 * Helper: proxies a fetch request to the Python Desktop Agent.
 * Returns { ok, data } or throws on network failure.
 */
const proxyToAgent = async (path, options = {}) => {
  const url = `${AGENT_BASE}${path}`;
  const { timeoutMs = 8000, ...fetchOptions } = options;
  const agentToken = process.env.AGENT_API_TOKEN;
  if (!agentToken || agentToken.length < 32) {
    throw new Error("Set a strong AGENT_API_TOKEN (at least 32 characters) in backend/.env and cheeni-agent/.env");
  }
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
      Authorization: `Bearer ${agentToken}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
};

agentRouter.post("/tool", isAuth, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).length !== 2 || !Object.hasOwn(body, "name") || !Object.hasOwn(body, "arguments")) {
    return res.status(400).json({ success: false, status: "invalid_request", message: "Expected only name and arguments." });
  }
  const { name, arguments: toolArgs } = body;
  if (!LOCAL_COMMAND_TOOLS.some(({ function: tool }) => tool.name === name)) {
    return res.status(400).json({ success: false, status: "unsupported", message: "This desktop tool is not enabled." });
  }
  if (!validateDesktopTool(name, toolArgs)) {
    return res.status(400).json({ success: false, status: "invalid_request", message: "Unknown tool or invalid tool arguments." });
  }

  try {
    const result = await executeDesktopTool(name, toolArgs);
    return res.status(200).json(result);
  } catch (err) {
    const responses = {
      agent_not_configured: { httpStatus: 503, message: "The local desktop agent is not configured." },
      agent_unavailable: { httpStatus: 503, message: "The local desktop agent is unavailable." },
      agent_rejected: { httpStatus: 502, message: "The local desktop agent rejected the request." },
      action_failed: { httpStatus: 502, message: "The desktop action failed." },
      outcome_unknown: { httpStatus: 504, message: "The action outcome could not be verified. Check its effect before retrying." },
    };
    const response = responses[err.code] || { httpStatus: 502, message: "The desktop action failed." };
    return res.status(response.httpStatus).json({
      success: false,
      status: err.code || "failed",
      retryable: false,
      message: response.message,
    });
  }
});

// ── Public: Ping (no auth) — used by frontend to show the "OS Agent: Connected" badge
agentRouter.get("/ping", async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/");
    if (ok) {
      return res.status(200).json({ connected: true, agent: data });
    }
    return res.status(503).json({ connected: false });
  } catch {
    return res.status(503).json({ connected: false, message: "Desktop Agent is not running" });
  }
});

// ── Public: Download Desktop Agent Package (ZIP or BAT installer)
agentRouter.get("/download", (req, res) => {
  const zipPath = path.resolve(__dirname, "../public/downloads/Cheeni-Desktop-Agent-Setup.zip");
  if (fs.existsSync(zipPath)) {
    return res.download(zipPath, "Cheeni-Desktop-Agent-Setup.zip");
  }

  const batPath = path.resolve(__dirname, "../../install_autostart.bat");
  if (fs.existsSync(batPath)) {
    return res.download(batPath, "install_autostart.bat");
  }

  return res.status(404).json({ success: false, message: "Download package not found" });
});

// ── All routes below require authentication ────────────────────────────────────

// GET /api/agent/status — Full system snapshot
agentRouter.get("/status", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/status");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// GET /api/agent/battery
agentRouter.get("/battery", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/battery");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/voice/status", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/voice/status");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent voice status is unavailable", error: err.message });
  }
});

agentRouter.post("/voice/start-listening", isAuth, async (req, res) => {
  return res.status(410).json({
    success: false,
    code: "native_voice_deferred",
    message: "Hands-free native voice is not enabled. Use the browser push-to-talk control.",
  });
});

agentRouter.post("/voice/stop-listening", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/voice/stop-listening", { method: "POST" });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Could not disable wake-word listening", error: err.message });
  }
});

const handleVisionScreenAnalysis = async (req, res) => {
  const { question } = req.body || {};
  if (!req.body || typeof req.body !== "object" || Object.keys(req.body).some((k) => k !== "question")) {
    return res.status(400).json({ success: false, message: "Request body may only contain the 'question' property" });
  }
  if (typeof question !== "string" || !question.trim() || question.length > 500) {
    return res.status(400).json({ success: false, message: "question must contain 1 to 500 characters" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/agent/vision", {
      method: "POST",
      body: JSON.stringify({ question: question.trim() }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Screen analysis is unavailable", error: err.message });
  }
};

agentRouter.post("/vision", isAuth, handleVisionScreenAnalysis);
agentRouter.post("/vision/analyze-screen", isAuth, handleVisionScreenAnalysis);

// GET /api/agent/volume
agentRouter.get("/volume", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/volume");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/volume  { level: 0–100 }
agentRouter.post("/volume", isAuth, async (req, res) => {
  try {
    const { level } = req.body;
    if (level === undefined || isNaN(Number(level))) {
      return res.status(400).json({ success: false, message: "level (0-100) is required" });
    }
    const { ok, data } = await proxyToAgent("/api/volume", {
      method: "POST",
      body: JSON.stringify({ level: Number(level) }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/volume/mute
agentRouter.post("/volume/mute", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/volume/mute", { method: "POST" });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/volume/unmute
agentRouter.post("/volume/unmute", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/volume/unmute", { method: "POST" });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

const legacyToolRouteDisabled = (_req, res) => res.status(410).json({
  success: false,
  message: "This legacy action endpoint is disabled. Use the registered, validated desktop tool interface.",
});
agentRouter.post("/launch", isAuth, legacyToolRouteDisabled);
agentRouter.post("/open", isAuth, legacyToolRouteDisabled);
agentRouter.post("/play", isAuth, legacyToolRouteDisabled);

// Legacy free-form command execution is disabled; only the registered tool endpoint may execute model-driven actions.
const legacyCommandDisabled = (_req, res) => res.status(410).json({
  success: false,
  message: "Free-form command execution is disabled. Use the registered, validated desktop tool interface.",
});
agentRouter.post("/command", isAuth, legacyCommandDisabled);
agentRouter.post("/command/classify", isAuth, legacyCommandDisabled);
agentRouter.post("/command/confirm", isAuth, legacyCommandDisabled);
agentRouter.get("/command/pending", isAuth, legacyCommandDisabled);

// ── Phase 4: Windows Application & System Control Routes ─────────────────────

// POST /api/agent/volume/delta  { delta: 10 }
agentRouter.post("/volume/delta", isAuth, async (req, res) => {
  try {
    const { delta } = req.body;
    const { ok, data } = await proxyToAgent("/api/volume/delta", {
      method: "POST",
      body: JSON.stringify({ delta: Number(delta || 10) }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/volume/toggle
agentRouter.post("/volume/toggle", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/volume/toggle", { method: "POST" });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// GET /api/agent/apps/running
agentRouter.get("/apps/running", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/apps/running");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/apps/close  { app: "notepad", force: false }
agentRouter.post("/apps/close", isAuth, (_req, res) => res.status(410).json({
  success: false,
  message: "Closing applications is disabled until unsaved-work checks and explicit confirmation are implemented.",
}));

// POST /api/agent/apps/focus  { app: "notepad" }
agentRouter.post("/apps/focus", isAuth, async (req, res) => {
  try {
    const { app } = req.body;
    const { ok, data } = await proxyToAgent("/api/apps/focus", {
      method: "POST",
      body: JSON.stringify({ app }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// GET /api/agent/system/specs
agentRouter.get("/system/specs", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/system/specs");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/system/lock
agentRouter.post("/system/lock", isAuth, (_req, res) => res.status(410).json({
  success: false,
  message: "Locking the system is disabled until an action-specific confirmation flow is implemented.",
}));

// POST /api/agent/system/sleep
agentRouter.post("/system/sleep", isAuth, (_req, res) => res.status(410).json({
  success: false,
  message: "Sleep is disabled until an action-specific confirmation flow is implemented.",
}));

// POST /api/agent/system/restart
agentRouter.post("/system/restart", isAuth, (_req, res) => res.status(410).json({
  success: false,
  message: "Restart is disabled until an action-specific confirmation and cancel flow are implemented.",
}));

// POST /api/agent/system/shutdown
agentRouter.post("/system/shutdown", isAuth, (_req, res) => res.status(410).json({
  success: false,
  message: "Shutdown is disabled until an action-specific confirmation and cancel flow are implemented.",
}));

// ── Phase 5: Window Management Proxy Routes ───────────────────────────────────

agentRouter.post("/windows/minimize", isAuth, async (req, res) => {
  try {
    const { target } = req.body;
    const { ok, data } = await proxyToAgent("/api/windows/minimize", {
      method: "POST",
      body: JSON.stringify({ target }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/windows/maximize", isAuth, async (req, res) => {
  try {
    const { target } = req.body;
    const { ok, data } = await proxyToAgent("/api/windows/maximize", {
      method: "POST",
      body: JSON.stringify({ target }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/windows/restore", isAuth, async (req, res) => {
  try {
    const { target } = req.body;
    const { ok, data } = await proxyToAgent("/api/windows/restore", {
      method: "POST",
      body: JSON.stringify({ target }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/windows/close", isAuth, (_req, res) => res.status(410).json({
  success: false,
  message: "Closing windows is disabled until unsaved-work checks and explicit confirmation are implemented.",
}));

agentRouter.get("/windows/active", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/windows/active");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/windows", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/windows");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/windows/snap", isAuth, async (req, res) => {
  try {
    const { position, target } = req.body;
    const { ok, data } = await proxyToAgent("/api/windows/snap", {
      method: "POST",
      body: JSON.stringify({ position: position || "left", target }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/windows/snap-corner", isAuth, async (req, res) => {
  try {
    const { target, width, height, stay_on_top } = req.body;
    const { ok, data } = await proxyToAgent("/api/windows/snap-corner", {
      method: "POST",
      body: JSON.stringify({ target, width, height, stay_on_top }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/windows/desktop", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/windows/desktop", { method: "POST" });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/windows/virtual_desktop", isAuth, async (req, res) => {
  try {
    const { direction } = req.body;
    const { ok, data } = await proxyToAgent("/api/windows/virtual_desktop", {
      method: "POST",
      body: JSON.stringify({ direction: direction || "next" }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// ── Phase 6: Filesystem & Document Intelligence Proxy Routes ──────────────────

agentRouter.post("/files/search", isAuth, async (req, res) => {
  try {
    const { query, root = "Downloads" } = req.body || {};
    if (typeof query !== "string" || !query.trim() || query.length > 120) {
      return res.status(400).json({ success: false, message: "query must contain 1 to 120 characters" });
    }
    if (!["Desktop", "Documents", "Downloads"].includes(root)) {
      return res.status(400).json({ success: false, message: "Choose Desktop, Documents, or Downloads" });
    }
    const { ok, data } = await proxyToAgent("/api/files/search", {
      method: "POST",
      body: JSON.stringify({ query: query.trim(), root }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/files/operations/preview", isAuth, async (req, res) => {
  const body = req.body || {};
  const type = body.type;
  const requiredFields = {
    create_folder: ["type", "parent", "name"],
    rename: ["type", "source", "name"],
    move: ["type", "source", "destination"],
    copy: ["type", "source", "destination"],
  }[type];
  if (!requiredFields || Object.keys(body).length !== requiredFields.length || !requiredFields.every((key) => Object.hasOwn(body, key))) {
    return res.status(400).json({ success: false, message: "Unsupported operation or unexpected fields" });
  }
  try {
    const { ok, status, data } = await proxyToAgent("/api/files/operations/preview", {
      method: "POST",
      timeoutMs: 60000,
      body: JSON.stringify({ ...body, owner_id: req.userId }),
    });
    return res.status(ok ? 200 : status || 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline" });
  }
});

agentRouter.get("/files/operations/:operationId", isAuth, async (req, res) => {
  try {
    const { ok, status, data } = await proxyToAgent(
      `/api/files/operations/${encodeURIComponent(req.params.operationId)}?owner_id=${encodeURIComponent(req.userId)}`
    );
    return res.status(ok ? 200 : status || 502).json(data);
  } catch {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline" });
  }
});

agentRouter.post("/files/operations/:operationId/cancel", isAuth, async (req, res) => {
  try {
    const { ok, status, data } = await proxyToAgent(
      `/api/files/operations/${encodeURIComponent(req.params.operationId)}/cancel`,
      { method: "POST", body: JSON.stringify({ owner_id: req.userId }) }
    );
    return res.status(ok ? 200 : status || 502).json(data);
  } catch {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline" });
  }
});

agentRouter.post("/files/operations/:operationId/undo", isAuth, async (req, res) => {
  try {
    const { ok, status, data } = await proxyToAgent(
      `/api/files/operations/${encodeURIComponent(req.params.operationId)}/undo`,
      { method: "POST", body: JSON.stringify({ owner_id: req.userId }) }
    );
    return res.status(ok ? 200 : status || 502).json(data);
  } catch {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline" });
  }
});

agentRouter.post("/files/operations/:operationId/confirm", isAuth, async (req, res) => {
  try {
    const { ok, status, data } = await proxyToAgent(
      `/api/files/operations/${encodeURIComponent(req.params.operationId)}/confirm`,
      { method: "POST", timeoutMs: 120000, body: JSON.stringify({ owner_id: req.userId }) }
    );
    return res.status(ok ? 200 : status || 502).json(data);
  } catch {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline" });
  }
});

agentRouter.post("/files/read", isAuth, async (req, res) => {
  try {
    const { path } = req.body || {};
    if (typeof path !== "string" || !path.trim() || path.length > 2048) {
      return res.status(400).json({ success: false, message: "path must be a valid path" });
    }
    const { ok, data } = await proxyToAgent("/api/files/read", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/files/create_folder", isAuth, async (req, res) => {
  return res.status(410).json({ success: false, message: "Folder creation is disabled until preview and confirmation are implemented." });
});

agentRouter.post("/files/rename", isAuth, async (req, res) => {
  return res.status(410).json({ success: false, message: "Rename is disabled until preview, confirmation, and recovery are implemented." });
});

agentRouter.post("/files/move", isAuth, async (req, res) => {
  return res.status(410).json({ success: false, message: "Move is disabled until preview, confirmation, and recovery are implemented." });
});

// ── Phase 7: Web Intelligence & Scraping Proxy Routes ────────────────────────

const hasExactWebBody = (body, allowedKeys) => (
  body && typeof body === "object" && !Array.isArray(body) &&
  Object.keys(body).every((key) => allowedKeys.includes(key))
);

agentRouter.post("/web/search", isAuth, async (req, res) => {
  const { query } = req.body || {};
  if (!hasExactWebBody(req.body, ["query"]) || typeof query !== "string" || !query.trim() || query.length > 240) {
    return res.status(400).json({ success: false, message: "query must contain 1 to 240 characters" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/web/search", {
      method: "POST",
      body: JSON.stringify({ query: query.trim() }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/web/news", isAuth, async (req, res) => {
  const { topic } = req.body || {};
  if (!hasExactWebBody(req.body, ["topic"]) || (topic !== undefined && (typeof topic !== "string" || topic.length > 240))) {
    return res.status(400).json({ success: false, message: "topic must be omitted or contain at most 240 characters" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/web/news", {
      method: "POST",
      body: JSON.stringify(topic === undefined ? {} : { topic: topic.trim() || null }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/web/scrape", isAuth, async (req, res) => {
  const { url } = req.body || {};
  if (!hasExactWebBody(req.body, ["url"]) || typeof url !== "string" || !url.trim() || url.length > 2048) {
    return res.status(400).json({ success: false, message: "url must contain 1 to 2048 characters" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/web/scrape", {
      method: "POST",
      body: JSON.stringify({ url: url.trim() }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// ── Phase 12: Screen Vision & GUI Agent Proxy Routes ─────────────────────────

agentRouter.get("/screen/status", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/screen/status");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/screen/click", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/screen/click", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/screen/type", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/screen/type", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/screen/goal", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/screen/goal", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// ── Phase 16: Dashboard, Memory Browser & Remote Control Proxy Routes ────────

agentRouter.post("/remote/command", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/remote/command", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/quick-action", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/quick-action", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/speak", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/speak", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/memory/all", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/memory/all");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/memory/stats", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/memory/stats");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/memory/preference", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/memory/preference", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.delete("/memory/preference", isAuth, async (req, res) => {
  const { category, key } = req.query || {};
  try {
    const { ok, data } = await proxyToAgent(`/api/agent/memory/preference?category=${encodeURIComponent(category)}&key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/memory/shortcut", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/memory/shortcut", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.delete("/memory/shortcut", isAuth, async (req, res) => {
  const { phrase } = req.query || {};
  try {
    const { ok, data } = await proxyToAgent(`/api/agent/memory/shortcut?phrase=${encodeURIComponent(phrase)}`, {
      method: "DELETE",
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/memory/search", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/agent/memory/search", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/ws-config", isAuth, (req, res) => {
  const token = process.env.AGENT_API_TOKEN || "";
  const wsUrl = token ? `ws://127.0.0.1:2026/ws?token=${encodeURIComponent(token)}` : "ws://127.0.0.1:2026/ws";
  return res.json({ success: true, wsUrl });
});

// ── V17: Morning Digest ────────────────────────────────────────────────────────

agentRouter.post("/digest/now", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/digest/now", { method: "POST", timeoutMs: 60000 });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/digest/text", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/digest/text", { method: "POST", timeoutMs: 60000 });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/digest/schedule", isAuth, async (req, res) => {
  const { time } = req.body || {};
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ success: false, message: "time must be in HH:MM format" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/digest/schedule", {
      method: "POST",
      body: JSON.stringify({ time }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.delete("/digest/schedule", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/digest/schedule", { method: "DELETE" });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/digest/status", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/digest/status");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// ── V18: Cloud Connectors ─────────────────────────────────────────────────────

agentRouter.post("/connectors/connect", isAuth, async (req, res) => {
  const { service } = req.body || {};
  const allowed = ["gdrive", "gmail", "gcalendar", "slack", "notion", "outlook"];
  if (!service || !allowed.includes(service)) {
    return res.status(400).json({ success: false, message: `service must be one of: ${allowed.join(", ")}` });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/connectors/connect", {
      method: "POST",
      timeoutMs: 120000,
      body: JSON.stringify({ service }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/connectors/list", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/connectors/list");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/connectors/gmail/unread", isAuth, async (req, res) => {
  const max = Math.min(Number(req.query.max_results) || 10, 50);
  try {
    const { ok, data } = await proxyToAgent(`/api/connectors/gmail/unread?max_results=${max}`, { timeoutMs: 20000 });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/connectors/calendar/today", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/connectors/calendar/today", { timeoutMs: 15000 });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/connectors/slack/messages", isAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const channel = req.query.channel ? `&channel=${encodeURIComponent(req.query.channel)}` : "";
  try {
    const { ok, data } = await proxyToAgent(`/api/connectors/slack/messages?limit=${limit}${channel}`);
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/connectors/notion/search", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/connectors/notion/search", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// ── V19: Kokoro TTS ───────────────────────────────────────────────────────────

agentRouter.get("/voice/kokoro/status", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/voice/kokoro/status");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/voice/kokoro/speak", isAuth, async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim() || text.length > 4000) {
    return res.status(400).json({ success: false, message: "text must be 1–4000 characters" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/voice/kokoro/speak", {
      method: "POST",
      body: JSON.stringify({ text: text.trim(), interrupt: req.body.interrupt !== false }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/voice/kokoro/stop", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/voice/kokoro/stop", { method: "POST" });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/voice/kokoro/voice", isAuth, async (req, res) => {
  const { voice } = req.body || {};
  if (!voice || typeof voice !== "string") {
    return res.status(400).json({ success: false, message: "voice is required" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/voice/kokoro/voice", {
      method: "POST",
      body: JSON.stringify({ voice }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/voice/kokoro/speed", isAuth, async (req, res) => {
  const speed = Number(req.body?.speed);
  if (isNaN(speed) || speed < 0.5 || speed > 2.0) {
    return res.status(400).json({ success: false, message: "speed must be between 0.5 and 2.0" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/voice/kokoro/speed", {
      method: "POST",
      body: JSON.stringify({ speed }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// ── V20: Notes Memory Indexer ─────────────────────────────────────────────────

agentRouter.post("/memory/notes/index", isAuth, async (req, res) => {
  const { path: folderPath, overwrite = true } = req.body || {};
  if (!folderPath || typeof folderPath !== "string" || !folderPath.trim()) {
    return res.status(400).json({ success: false, message: "path is required" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/memory/notes/index", {
      method: "POST",
      timeoutMs: 300000,   // indexing can take a while for large folders
      body: JSON.stringify({ path: folderPath.trim(), overwrite }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/memory/notes/search", isAuth, async (req, res) => {
  const { query, top_k = 5 } = req.body || {};
  if (!query || typeof query !== "string" || !query.trim() || query.length > 500) {
    return res.status(400).json({ success: false, message: "query must be 1–500 characters" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/memory/notes/search", {
      method: "POST",
      body: JSON.stringify({ query: query.trim(), top_k: Math.min(Number(top_k) || 5, 20) }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/memory/notes/sources", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/memory/notes/sources");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.delete("/memory/notes/source", isAuth, async (req, res) => {
  const { path: folderPath } = req.body || {};
  if (!folderPath) {
    return res.status(400).json({ success: false, message: "path is required" });
  }
  try {
    const { ok, data } = await proxyToAgent("/api/memory/notes/source", {
      method: "DELETE",
      body: JSON.stringify({ path: folderPath }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.get("/memory/notes/stats", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/memory/notes/stats");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

export default agentRouter;

