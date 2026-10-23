import mongoose from "mongoose";

const taskStepSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  tool: { type: String, required: true },
  arguments: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String, required: true, maxlength: 500 },
  status: {
    type: String,
    enum: ["pending", "running", "verified", "failed", "outcome_unknown", "not_run"],
    default: "pending",
  },
  resultSummary: { type: String, maxlength: 300, default: "" },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { _id: false });

const taskPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  activeKey: { type: String },
  status: {
    type: String,
    enum: ["awaiting_review", "approved", "running", "paused", "completed", "rejected", "cancelled", "failed", "partially_completed", "outcome_unknown", "expired"],
    default: "awaiting_review",
    index: true,
  },
  planDigest: { type: String, required: true },
  currentStep: { type: Number, default: 0 },
  steps: { type: [taskStepSchema], required: true },
  approvalExpiresAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  controlRequest: { type: String, enum: [null, "pause", "cancel"], default: null },
}, { timestamps: true });

taskPlanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
taskPlanSchema.index({ userId: 1, createdAt: -1 });
taskPlanSchema.index({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $type: "string" } } });

const TaskPlan = mongoose.models.TaskPlan || mongoose.model("TaskPlan", taskPlanSchema);

export default TaskPlan;
