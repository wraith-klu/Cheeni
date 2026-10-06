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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const agentRouter = express.Router();
const AGENT_BASE = "http://127.0.0.1:2026";

/**
 * Helper: proxies a fetch request to the Python Desktop Agent.
 * Returns { ok, data } or throws on network failure.
 */
const proxyToAgent = async (path, options = {}) => {
  const url = `${AGENT_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(8000), // 8s timeout
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
};

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

// POST /api/agent/launch  { app: "notepad" }
agentRouter.post("/launch", isAuth, async (req, res) => {
  try {
    const { app } = req.body;
    if (!app || typeof app !== "string") {
      return res.status(400).json({ success: false, message: "app name is required" });
    }
    const { ok, data } = await proxyToAgent("/api/launch", {
      method: "POST",
      body: JSON.stringify({ app }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/open  { url: "https://..." }
agentRouter.post("/open", isAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, message: "url is required" });
    }
    const { ok, data } = await proxyToAgent("/api/open", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/play  { query: "song name" }
agentRouter.post("/play", isAuth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ success: false, message: "query is required" });
    }
    const { ok, data } = await proxyToAgent("/api/play", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// ── Phase 3: Command Security & Routing Endpoints ─────────────────────────────

// POST /api/agent/command  { text: "open notepad", use_native_speaker: false }
// Feature #15: userId is forwarded as X-User-Id so the Python agent can scope execution per user session.
agentRouter.post("/command", isAuth, async (req, res) => {
  try {
    const { text, use_native_speaker } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ success: false, message: "text command is required" });
    }
    const { ok, data } = await proxyToAgent("/api/command", {
      method: "POST",
      headers: {
        // Pass the authenticated userId to the agent for per-user session isolation
        "X-User-Id": String(req.userId),
      },
      body: JSON.stringify({ text, use_native_speaker: !!use_native_speaker, user_id: String(req.userId) }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/command/classify  { text: "delete system32" }
agentRouter.post("/command/classify", isAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ success: false, message: "text is required" });
    }
    const { ok, data } = await proxyToAgent("/api/command/classify", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/command/confirm  { answer: "yes" }
agentRouter.post("/command/confirm", isAuth, async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer || typeof answer !== "string") {
      return res.status(400).json({ success: false, message: "answer is required" });
    }
    const { ok, data } = await proxyToAgent("/api/command/confirm", {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// GET /api/agent/command/pending
agentRouter.get("/command/pending", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/command/pending");
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

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
agentRouter.post("/apps/close", isAuth, async (req, res) => {
  try {
    const { app, force } = req.body;
    if (!app) {
      return res.status(400).json({ success: false, message: "app name is required" });
    }
    const { ok, data } = await proxyToAgent("/api/apps/close", {
      method: "POST",
      body: JSON.stringify({ app, force: !!force }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

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
agentRouter.post("/system/lock", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/system/lock", { method: "POST" });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/system/sleep
agentRouter.post("/system/sleep", isAuth, async (req, res) => {
  try {
    const { ok, data } = await proxyToAgent("/api/system/sleep", { method: "POST" });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/system/restart
agentRouter.post("/system/restart", isAuth, async (req, res) => {
  try {
    const { delay_sec } = req.body;
    const { ok, data } = await proxyToAgent("/api/system/restart", {
      method: "POST",
      body: JSON.stringify({ delay_sec: Number(delay_sec || 5) }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// POST /api/agent/system/shutdown
agentRouter.post("/system/shutdown", isAuth, async (req, res) => {
  try {
    const { delay_sec } = req.body;
    const { ok, data } = await proxyToAgent("/api/system/shutdown", {
      method: "POST",
      body: JSON.stringify({ delay_sec: Number(delay_sec || 5) }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

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

agentRouter.post("/windows/close", isAuth, async (req, res) => {
  try {
    const { target } = req.body;
    const { ok, data } = await proxyToAgent("/api/windows/close", {
      method: "POST",
      body: JSON.stringify({ target }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

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
    const { query, directory } = req.body;
    const { ok, data } = await proxyToAgent("/api/files/search", {
      method: "POST",
      body: JSON.stringify({ query, directory: directory || "~" }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/files/read", isAuth, async (req, res) => {
  try {
    const { path } = req.body;
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
  try {
    const { path } = req.body;
    const { ok, data } = await proxyToAgent("/api/files/create_folder", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/files/rename", isAuth, async (req, res) => {
  try {
    const { old_path, new_name } = req.body;
    const { ok, data } = await proxyToAgent("/api/files/rename", {
      method: "POST",
      body: JSON.stringify({ old_path, new_name }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/files/move", isAuth, async (req, res) => {
  try {
    const { src_path, dest_dir } = req.body;
    const { ok, data } = await proxyToAgent("/api/files/move", {
      method: "POST",
      body: JSON.stringify({ src_path, dest_dir }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

// ── Phase 7: Web Intelligence & Scraping Proxy Routes ────────────────────────

agentRouter.post("/web/search", isAuth, async (req, res) => {
  try {
    const { query } = req.body;
    const { ok, data } = await proxyToAgent("/api/web/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/web/news", isAuth, async (req, res) => {
  try {
    const { topic } = req.body;
    const { ok, data } = await proxyToAgent("/api/web/news", {
      method: "POST",
      body: JSON.stringify({ topic }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

agentRouter.post("/web/scrape", isAuth, async (req, res) => {
  try {
    const { url } = req.body;
    const { ok, data } = await proxyToAgent("/api/web/scrape", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    return res.status(ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: "Desktop Agent is offline", error: err.message });
  }
});

export default agentRouter;
