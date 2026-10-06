import mongoose from "mongoose";

// Auto-tagging keyword map: topic → trigger words
const TAG_KEYWORDS = {
  interview: ["interview", "behavioral", "star method", "hr round", "leetcode", "technical round", "mock interview"],
  coding: ["code", "algorithm", "function", "debug", "error", "syntax", "programming", "binary search", "sort", "loop", "array", "javascript", "python", "typescript"],
  "system-design": ["system design", "architecture", "scale", "distributed", "microservice", "database", "api design", "load balancer"],
  "general": [],
};

/**
 * Derive up to 3 tags from conversation content using keyword matching.
 * Falls back to ["general"] if nothing matches.
 */
export function autoTagContent(content) {
  if (!content || typeof content !== "string") return ["general"];
  const lower = content.toLowerCase();
  const matched = [];
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (tag === "general") continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(tag);
    }
  }
  return matched.length > 0 ? matched.slice(0, 3) : ["general"];
}

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    speechText: {
      type: String,
      default: null,
    },
    action: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Auto-generated topic tags: ["interview", "coding", "system-design", "general"]
    tags: {
      type: [String],
      default: ["general"],
      index: true,
    },
    // Manual bookmark flag — user can star important exchanges
    bookmarked: {
      type: Boolean,
      default: false,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for chronological querying of a user's recent messages
conversationSchema.index({ userId: 1, timestamp: -1 });

// Compound index for tag filtering per user
conversationSchema.index({ userId: 1, tags: 1, timestamp: -1 });

// Compound index for bookmarks per user
conversationSchema.index({ userId: 1, bookmarked: 1, timestamp: -1 });

// Full-text search index on content for conversation search (#16)
conversationSchema.index({ content: "text" });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
