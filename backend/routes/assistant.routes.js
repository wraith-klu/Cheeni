import express from "express";
import isAuth from "../middlewares/isAuth.js";
import { aiAssistantLimiter } from "../middlewares/rateLimiter.js";
import {
  askAssistant,
  askAssistantStream,
  getHistory,
  clearHistory,
  searchHistory,
  toggleBookmark,
  getTagSummary,
} from "../controllers/assistant.controllers.js";

const assistantRouter = express.Router();

// Core conversation endpoints
assistantRouter.post("/ask/stream", isAuth, aiAssistantLimiter, askAssistantStream);
assistantRouter.post("/ask", isAuth, aiAssistantLimiter, askAssistant);

// History — supports ?tag=coding&bookmarked=true&limit=100
assistantRouter.get("/history", isAuth, getHistory);
assistantRouter.delete("/history", isAuth, clearHistory);

// Full-text search — GET /api/assistant/history/search?q=binary+search&tag=coding  (#16)
assistantRouter.get("/history/search", isAuth, searchHistory);

// Tag summary counts — GET /api/assistant/history/tags  (#16)
assistantRouter.get("/history/tags", isAuth, getTagSummary);

// Bookmark toggle — PATCH /api/assistant/history/:id/bookmark  (#16)
assistantRouter.patch("/history/:id/bookmark", isAuth, toggleBookmark);

export default assistantRouter;
