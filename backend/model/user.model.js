import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
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
    },
    action: {
      type: Object,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    assistantName: {
      type: String,
      default: "Cheeni",
    },
    assistantImage: {
      type: String,
    },
    // User Persona & AI Memory Preferences (Task 29)
    userPreferences: {
      responseStyle: {
        type: String,
        enum: ["concise", "detailed", "balanced", "conversational"],
        default: "balanced",
      },
      targetGoal: {
        type: String,
        default: "", // e.g. "Preparing for Google SDE II interviews (DSA & System Design)"
      },
      customInstructions: {
        type: String,
        default: "", // e.g. "I prefer concise answers, bullet points, and practical code snippets."
      },
      programmingLanguages: {
        type: [String],
        default: ["JavaScript", "Python"],
      },
    },
    // Refresh Token Rotation (Option A: DB-stored tokenVersion and hash for server-side revocation)
    tokenVersion: {
      type: Number,
      default: 0,
    },
    refreshTokenHash: {
      type: String,
      default: null,
    },
    // Email Verification via OTP / Magic Link
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationOtp: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    // [MIGRATED]: Conversation history has been decoupled to the standalone indexed `Conversation` collection
    // (backend/model/conversation.model.js) to avoid the 16MB document limit and improve query performance.
    // Retained commented out here for reference and rollback safety if needed.
    // history: [messageSchema],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;