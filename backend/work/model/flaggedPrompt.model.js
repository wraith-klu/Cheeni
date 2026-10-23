import mongoose from "mongoose";

/**
 * FlaggedPrompt � moderation log for detected prompt-injection attempts.
 *
 * Records are written asynchronously (fire-and-forget) so they never slow
 * down the actual assistant response. They give visibility into attack patterns
 * over time without blocking any legitimate user.
 */
const flaggedPromptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rawPrompt: {
      type: String,
      required: true,
      // Store only the first 1000 chars � enough for pattern review, avoids
      // storing excessively large attacker-controlled strings.
      maxlength: 1000,
    },
    matchedPatterns: {
      type: [String],
      default: [],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // No need for Mongoose timestamps (createdAt/updatedAt) � timestamp above is enough
    timestamps: false,
    collection: "flaggedprompts",
  }
);

// Compound index: look up all flagged attempts by a specific user chronologically
flaggedPromptSchema.index({ userId: 1, timestamp: -1 });

// TTL index: automatically purge records older than 90 days to keep collection lean
flaggedPromptSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const FlaggedPrompt = mongoose.model("FlaggedPrompt", flaggedPromptSchema);

export default FlaggedPrompt;
