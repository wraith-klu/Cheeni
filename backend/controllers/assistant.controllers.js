import mongoose from "mongoose";
import User from "../model/user.model.js";
import Conversation, { autoTagContent } from "../model/conversation.model.js";
import FlaggedPrompt from "../model/flaggedPrompt.model.js";
import { generateCheeniResponse, streamCheeniReply } from "../services/ai.service.js";
import { sanitizeUserInput, MAX_PROMPT_LENGTH } from "../utils/sanitizePrompt.js";


/**
 * Controller to process queries to Cheeni
 * POST /api/assistant/ask
 */
export const askAssistant = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    // ── Prompt sanitization & injection defense ───────────────────────────
    const { cleanedText, flagged, matchedPatterns, tooLong } = sanitizeUserInput(prompt);

    // Hard reject oversized inputs — prevents context-stuffing / quota-burn attacks
    if (tooLong) {
      return res.status(400).json({
        message: `Prompt exceeds the maximum allowed length of ${MAX_PROMPT_LENGTH} characters.`,
        error: "prompt_too_long",
      });
    }

    // If injection patterns were detected: log asynchronously (fire-and-forget)
    // then continue — blocking here would harm legitimate users with false positives.
    // The real defense is structural isolation in ai.service.js (systemInstruction).
    if (flagged) {
      console.warn(`[Cheeni] Flagged prompt from userId=${req.userId} | patterns: ${matchedPatterns.join(" | ")}`);
      // Async save — do not await; never slow down the response for logging
      FlaggedPrompt.create({
        userId: req.userId,
        rawPrompt: prompt.slice(0, 1000),
        matchedPatterns,
      }).catch((err) => console.error("[Cheeni] Failed to save flagged prompt log:", err.message));
    }

    const user = await User.findById(req.userId).select("assistantName name userPreferences");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const assistantName = user.assistantName || "Cheeni";
    const userName = user.name || "Friend";
    const userPreferences = user.userPreferences || null;

    // Feed recent history to AI service for contextual memory (last N messages from Conversation collection)
    const contextWindowSize = Math.max(1, parseInt(process.env.CONTEXT_WINDOW_SIZE, 10) || 25);
    const recentMessages = await Conversation.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(contextWindowSize)
      .lean();

    // Reverse to chronological order for the LLM context prompt
    const recentContext = recentMessages.reverse().map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Use cleanedText (structural markers stripped) as the prompt sent to the LLM.
    // Raw prompt is preserved only in the moderation log above.
    const aiResult = await generateCheeniResponse({
      prompt: cleanedText,
      assistantName,
      userName,
      userPreferences,
      history: recentContext,
    });

    const assistantContent = (aiResult?.textResponse || aiResult?.speechText || "I am here to assist you.").trim();
    const assistantSpeech = (aiResult?.speechText || assistantContent).trim();

    // Auto-tag based on user prompt content
    const tags = autoTagContent(prompt);

    // Store the original (pre-strip) user message in conversation history,
    // not the cleaned version — so chat history looks natural to the user.
    const [userDoc, assistantDoc] = await Conversation.insertMany([
      {
        userId: req.userId,
        role: "user",
        content: prompt.trim(),
        tags,
        timestamp: new Date(),
      },
      {
        userId: req.userId,
        role: "assistant",
        content: assistantContent || "I am here to assist you.",
        speechText: assistantSpeech || assistantContent,
        action: aiResult?.action || null,
        tags,
        timestamp: new Date(),
      },
    ]);

    return res.status(200).json({
      success: true,
      userMessage: userDoc,
      assistantMessage: assistantDoc,
      speechText: aiResult.speechText,
      textResponse: aiResult.textResponse,
      action: aiResult.action,
      assistantName,
    });
  } catch (error) {
    console.error("Error in askAssistant:", error);
    return res.status(500).json({ 
      message: "Internal Server Error",
      speechText: "I'm sorry, I encountered a temporary issue while thinking. Please try asking again!",
      textResponse: "An unexpected error occurred while processing your request. Please try again."
    });
  }
};

/**
 * Get all conversation history for the authenticated user
 * GET /api/assistant/history
 * Query params: ?tag=coding&bookmarked=true&limit=100
 */
export const getHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("assistantName name");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const filter = { userId: req.userId };

    // Optional tag filter
    if (req.query.tag && req.query.tag !== "all") {
      filter.tags = req.query.tag;
    }

    // Optional bookmarked filter
    if (req.query.bookmarked === "true") {
      filter.bookmarked = true;
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);

    // Query messages for this user in chronological order
    const history = await Conversation.find(filter)
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      history: history || [],
      assistantName: user.assistantName || "Cheeni",
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return res.status(500).json({ message: "Failed to fetch conversation history" });
  }
};

/**
 * Full-text search across conversation history for the authenticated user
 * GET /api/assistant/history/search?q=binary+search&tag=coding
 */
export const searchHistory = async (req, res) => {
  try {
    const { q, tag, limit: rawLimit } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ message: "Search query (q) is required" });
    }

    const limit = Math.min(parseInt(rawLimit, 10) || 50, 200);

    const filter = {
      userId: req.userId,
      $text: { $search: q.trim() },
    };

    if (tag && tag !== "all") {
      filter.tags = tag;
    }

    const results = await Conversation.find(filter, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" }, timestamp: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      query: q.trim(),
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Error searching history:", error);
    return res.status(500).json({ message: "Failed to search conversation history" });
  }
};

/**
 * Toggle bookmark on a single conversation message
 * PATCH /api/assistant/history/:id/bookmark
 */
export const toggleBookmark = async (req, res) => {
  try {
    const { id } = req.params;

    const msg = await Conversation.findOne({ _id: id, userId: req.userId });
    if (!msg) {
      return res.status(404).json({ message: "Message not found" });
    }

    msg.bookmarked = !msg.bookmarked;
    await msg.save();

    return res.status(200).json({
      success: true,
      id: msg._id,
      bookmarked: msg.bookmarked,
    });
  } catch (error) {
    console.error("Error toggling bookmark:", error);
    return res.status(500).json({ message: "Failed to update bookmark" });
  }
};

/**
 * Get tag summary counts for the authenticated user
 * GET /api/assistant/history/tags
 */
export const getTagSummary = async (req, res) => {
  try {
    const userObjId = new mongoose.Types.ObjectId(req.userId);

    const tagCounts = await Conversation.aggregate([
      { $match: { userId: userObjId } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Total message count
    const total = await Conversation.countDocuments({ userId: req.userId });
    const bookmarked = await Conversation.countDocuments({ userId: req.userId, bookmarked: true });

    return res.status(200).json({
      success: true,
      total,
      bookmarked,
      tags: tagCounts.map((t) => ({ tag: t._id, count: t.count })),
    });
  } catch (error) {
    console.error("Error getting tag summary:", error);
    return res.status(500).json({ message: "Failed to get tag summary" });
  }
};

/**
 * Clear all conversation history for the authenticated user
 * DELETE /api/assistant/history
 */
export const clearHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete all conversation records for this user from Conversation collection
    await Conversation.deleteMany({ userId: req.userId });

    return res.status(200).json({
      success: true,
      message: "Conversation history cleared successfully",
      history: [],
    });
  } catch (error) {
    console.error("Error clearing history:", error);
    return res.status(500).json({ message: "Failed to clear conversation history" });
  }
};

/**
 * Streaming controller — POST /api/assistant/ask/stream
 *
 * Two-call approach:
 *   Call 1 (structured, non-streaming): generateCheeniResponse → action + speechText
 *   Call 2 (streaming):                 streamCheeniReply → textResponse chunks via SSE
 *
 * SSE event types sent to client:
 *   { type: 'meta',  action, speechText, assistantName }  — after Call 1 completes
 *   { type: 'chunk', text }                                — per streaming chunk
 *   { type: 'done',  conversationId }                     — after stream ends, DB written
 *   { type: 'error', message }                            — on any failure
 */
export const askAssistantStream = async (req, res) => {
  // ── SSE headers ──────────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if present
  res.flushHeaders();

  const sseWrite = (obj) => {
    try {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    } catch {
      // client disconnected — ignore write errors
    }
  };

  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      sseWrite({ type: "error", message: "Prompt is required" });
      return res.end();
    }

    // ── Prompt sanitization ───────────────────────────────────────────────────
    const { cleanedText, flagged, matchedPatterns, tooLong } = sanitizeUserInput(prompt);

    if (tooLong) {
      sseWrite({
        type: "error",
        message: `Prompt exceeds the maximum allowed length of ${MAX_PROMPT_LENGTH} characters.`,
        error: "prompt_too_long",
      });
      return res.end();
    }

    if (flagged) {
      console.warn(`[Cheeni:stream] Flagged prompt userId=${req.userId} | patterns: ${matchedPatterns.join(" | ")}`);
      FlaggedPrompt.create({
        userId: req.userId,
        rawPrompt: prompt.slice(0, 1000),
        matchedPatterns,
      }).catch((err) => console.error("[Cheeni:stream] Failed to save flagged prompt:", err.message));
    }

    const user = await User.findById(req.userId).select("assistantName name userPreferences");
    if (!user) {
      sseWrite({ type: "error", message: "User not found" });
      return res.end();
    }

    const assistantName = user.assistantName || "Cheeni";
    const userName = user.name || "Friend";
    const userPreferences = user.userPreferences || null;

    // ── Fetch recent conversation context ─────────────────────────────────────
    const contextWindowSize = Math.max(1, parseInt(process.env.CONTEXT_WINDOW_SIZE, 10) || 25);
    const recentMessages = await Conversation.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(contextWindowSize)
      .lean();
    const recentContext = recentMessages.reverse().map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // ────────────────────────────────────────────────────────────────────────────
    // CALL 1 — Structured non-streaming: get action + speechText
    // ────────────────────────────────────────────────────────────────────────────
    let aiResult;
    try {
      aiResult = await generateCheeniResponse({
        prompt: cleanedText,
        assistantName,
        userName,
        userPreferences,
        history: recentContext,
      });
    } catch (structuredErr) {
      console.error("[Cheeni:stream] Call-1 (structured) failed:", structuredErr.message);
      sseWrite({ type: "error", message: "Failed to generate response. Please try again." });
      return res.end();
    }

    const assistantSpeech = (aiResult?.speechText || "").trim();
    const structuredAction = aiResult?.action || null;

    // Send metadata immediately so the frontend can start TTS + action execution
    // while Call-2 streams the text reply in parallel.
    sseWrite({
      type: "meta",
      speechText: assistantSpeech,
      action: structuredAction,
      assistantName,
    });

    // ────────────────────────────────────────────────────────────────────────────
    // CALL 2 — Streaming: pipe textResponse chunks to SSE
    // ────────────────────────────────────────────────────────────────────────────
    let accumulatedText = "";
    let clientDisconnected = false;

    // Track client disconnects so we can skip sending more events
    req.on("close", () => { clientDisconnected = true; });

    const onChunk = (text) => {
      if (clientDisconnected) return;
      sseWrite({ type: "chunk", text });
    };

    let streamErrorOccurred = false;

    // If an action was identified and handled (e.g. YouTube play, open app, battery check),
    // stream the clean authoritative confirmation from Call 1 instead of re-prompting
    // an unconstrained LLM that might contradict the tool and say "I can't play music".
    if (structuredAction) {
      const actionText = (aiResult?.textResponse || `### ${structuredAction.label || structuredAction.type}\n\n${assistantSpeech}`).trim();
      accumulatedText = actionText;
      onChunk(actionText);
    } else {
      try {
        accumulatedText = await streamCheeniReply({
          prompt: cleanedText,
          assistantName,
          userName,
          userPreferences,
          history: recentContext,
          onChunk,
        });
      } catch (streamErr) {
        console.error("[Cheeni:stream] Call-2 (stream) failed:", streamErr.message);
        streamErrorOccurred = true;

        // If chunks were already delivered to the client, notify frontend with an error event
        if (accumulatedText && accumulatedText.trim().length > 0) {
          sseWrite({
            type: "error",
            message: "Stream connection interrupted. Partial response preserved.",
            partialText: accumulatedText,
          });
        } else {
          // No chunks sent yet — fallback to speechText
          accumulatedText = assistantSpeech;
        }
      }
    }

    // Ensure we have some text — fall back to speechText if stream returned nothing
    if (!accumulatedText.trim()) accumulatedText = assistantSpeech || "I'm here to help!";

    // Auto-tag based on user prompt content
    const tags = autoTagContent(prompt);

    // ── Persist to DB after streaming completes ──────────────────────────────
    let assistantDoc = null;
    try {
      const [, savedAssistant] = await Conversation.insertMany([
        {
          userId: req.userId,
          role: "user",
          content: prompt.trim(),
          tags,
          timestamp: new Date(),
        },
        {
          userId: req.userId,
          role: "assistant",
          content: accumulatedText,
          speechText: assistantSpeech || accumulatedText,
          action: structuredAction,
          tags,
          timestamp: new Date(),
        },
      ]);
      assistantDoc = savedAssistant;
    } catch (dbErr) {
      console.error("[Cheeni:stream] DB write failed:", dbErr.message);
    }

    if (!clientDisconnected && !streamErrorOccurred) {
      sseWrite({ type: "done", conversationId: assistantDoc?._id || null });
    }

    res.end();
  } catch (error) {
    console.error("[Cheeni:stream] Unexpected error:", error);
    try {
      sseWrite({ type: "error", message: "Internal Server Error. Please try again." });
      res.end();
    } catch {
      // res already closed
    }
  }
};
