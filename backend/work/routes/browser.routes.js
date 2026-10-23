import express from "express";
import isAuth from "../middlewares/isAuth.js";
import {
  BROWSER_WORKFLOW_REGISTRY,
  previewBrowserWorkflow,
  startBrowserWorkflow,
  getBrowserRunStatus,
  stopBrowserRun,
  getBrowserRunResult,
} from "../services/browserWorkflow.service.js";

const browserRouter = express.Router();

/**
 * GET /api/browser/workflows
 * Returns catalog of all registered, enabled workflows
 */
browserRouter.get("/workflows", isAuth, (req, res) => {
  const workflows = Object.values(BROWSER_WORKFLOW_REGISTRY).map((w) => ({
    id: w.id,
    title: w.title,
    description: w.description,
    category: w.category,
    allowedDomains: w.allowedDomains,
    limits: {
      maxDurationSeconds: w.maxDurationSeconds,
      maxPages: w.maxPages,
      maxTextChars: w.maxTextChars,
    },
    disclosure: w.disclosure,
  }));
  return res.status(200).json({ success: true, workflows });
});

/**
 * POST /api/browser/workflows/preview
 * Validate workflow ID/parameters and return domains, actions, disclosure, limits, and a human-readable plan. No browser launch.
 */
browserRouter.post("/workflows/preview", isAuth, async (req, res) => {
  const { workflowId, url } = req.body || {};
  if (!workflowId || typeof workflowId !== "string") {
    return res.status(400).json({ success: false, message: "workflowId is required" });
  }
  if (!url || typeof url !== "string") {
    return res.status(400).json({ success: false, message: "Valid URL is required" });
  }

  try {
    const preview = await previewBrowserWorkflow(req.userId, { workflowId, url });
    return res.status(200).json({ success: true, preview });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/browser/workflows/start
 * Start a registered, owner-authorized preview after explicit user initiation.
 */
browserRouter.post("/workflows/start", isAuth, async (req, res) => {
  const { workflowId, url, previewId } = req.body || {};
  if (!workflowId || !url) {
    return res.status(400).json({ success: false, message: "workflowId and url are required" });
  }

  try {
    const run = await startBrowserWorkflow(req.userId, { workflowId, url, previewId });
    return res.status(202).json({ success: true, run });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/browser/runs/:runId
 * Return owner-scoped bounded status, current approved domain, state, elapsed time, and safe progress.
 */
browserRouter.get("/runs/:runId", isAuth, (req, res) => {
  const status = getBrowserRunStatus(req.userId, req.params.runId);
  if (!status) {
    return res.status(404).json({ success: false, message: "Run not found or unauthorized" });
  }
  return res.status(200).json({ success: true, run: status });
});

/**
 * POST /api/browser/runs/:runId/stop
 * Mark cancellation, terminate runner/context, and return final cancellation state.
 */
browserRouter.post("/runs/:runId/stop", isAuth, (req, res) => {
  const stopped = stopBrowserRun(req.userId, req.params.runId);
  if (!stopped) {
    return res.status(404).json({ success: false, message: "Run not found or unauthorized" });
  }
  return res.status(200).json({ success: true, run: stopped });
});

/**
 * GET /api/browser/runs/:runId/result
 * Return sanitized extracted output, visited source URLs, state, limitations, and action audit.
 */
browserRouter.get("/runs/:runId/result", isAuth, (req, res) => {
  const result = getBrowserRunResult(req.userId, req.params.runId);
  if (!result) {
    return res.status(404).json({ success: false, message: "Run not found or unauthorized" });
  }
  return res.status(200).json({ success: true, data: result });
});

export default browserRouter;
