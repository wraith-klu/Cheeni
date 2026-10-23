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
    // Phase 7: Connected Services and Integrations (encrypted tokens)
    integrationTokens: {
      type: Map,
      of: new mongoose.Schema(
        {
          iv: { type: String, required: true },
          ciphertext: { type: String, required: true },
          tag: { type: String, required: true },
          refreshIv: { type: String },
          refreshCiphertext: { type: String },
          refreshTag: { type: String },
          expiresAt: { type: Date },
          scope: { type: String },
          connectedAt: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshTokenHash;
        delete ret.verificationOtp;
        delete ret.integrationTokens;
        return ret;
      },
    },
  }
);

const User = mongoose.model("User", userSchema);

export default User;