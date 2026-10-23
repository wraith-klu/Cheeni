import { createHash } from "node:crypto";
import TaskPlan from "../model/taskPlan.model.js";
import { executeDesktopTool, validateDesktopTool } from "./desktopAgent.service.js";

const APPROVAL_TTL_MS = 10 * 60 * 1000;
const TASK_TTL_MS = 24 * 60 * 60 * 1000;
const RUNNING_STALE_MS = 30 * 1000;

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};

const describeToolStep = (tool, args) => {
  switch (tool) {
    case "launch_app": return `Open application: ${args.app_name}`;
    case "open_folder": return `Open folder: ${args.folder}`;
    case "open_url": return `Open website: ${args.url}`;
    case "get_system_telemetry": return `Read system status: ${args.metric}`;
    default: return null;
  }
};

const planPayload = (steps) => steps.map(({ order, tool, arguments: args, description }) => ({
  order,
  tool,
  arguments: args,
  description,
}));

export const getPlanDigest = (steps) => createHash("sha256").update(JSON.stringify(canonicalize(planPayload(steps)))).digest("hex");

const toPublicTask = (task) => ({
  id: task._id.toString(),
  executionEnabled: process.env.TASK_EXECUTION_ENABLED === "true",
  status: task.status,
  planDigest: task.planDigest,
  currentStep: task.currentStep,
  approvalExpiresAt: task.approvalExpiresAt,
  expiresAt: task.expiresAt,
  steps: task.steps.map((step) => ({
    order: step.order,
    tool: step.tool,
    arguments: step.arguments,
    description: step.description,
    status: step.status,
    resultSummary: step.resultSummary,
  })),
});

export async function createTaskPlanRecord(userId, plan) {
  if (!userId || !Array.isArray(plan?.steps) || plan.steps.length < 2 || plan.steps.length > 5) {
    throw new Error("Invalid task plan");
  }
  const normalizedSteps = plan.steps.map((step) => ({
    order: step.order,
    tool: step.tool,
    arguments: step.arguments,
    description: describeToolStep(step.tool, step.arguments),
  }));
  if (normalizedSteps.some((step) => !validateDesktopTool(step.tool, step.arguments) || !step.description)) {
    throw new Error("Task plan contains an unsupported step");
  }
  const now = Date.now();
  const task = await TaskPlan.create({
    userId,
    activeKey: String(userId),
    status: "awaiting_review",
    planDigest: getPlanDigest(normalizedSteps),
    steps: normalizedSteps,
    approvalExpiresAt: new Date(now + APPROVAL_TTL_MS),
    expiresAt: new Date(now + TASK_TTL_MS),
  });
  return toPublicTask(task);
}

const findOwnedTask = async (taskId, userId) => {
  if (!/^[a-f\d]{24}$/i.test(String(taskId || ""))) return null;
  return TaskPlan.findOne({ _id: taskId, userId });
};

const isValidTaskId = (taskId) => /^[a-f\d]{24}$/i.test(String(taskId || ""));

export async function getTaskPlan(taskId, userId) {
  const task = await findOwnedTask(taskId, userId);
  if (!task) return null;
  if (task.status === "running") {
    const step = task.steps[task.currentStep];
    if (step?.startedAt && Date.now() - step.startedAt.getTime() > RUNNING_STALE_MS) {
      const updated = await TaskPlan.findOneAndUpdate(
        { _id: task._id, userId, status: "running", currentStep: task.currentStep, [`steps.${task.currentStep}.status`]: "running" },
        { $set: {
          status: "outcome_unknown",
          activeKey: null,
          [`steps.${task.currentStep}.status`]: "outcome_unknown",
          [`steps.${task.currentStep}.resultSummary`]: "Execution was interrupted; verify its effect before creating another task.",
          "steps.$[pending].status": "not_run",
        } },
        { new: true, arrayFilters: [{ "pending.status": "pending" }] }
      );
      const current = updated || await findOwnedTask(taskId, userId);
      return current ? toPublicTask(current) : null;
    }
  }
  if (["awaiting_review", "approved", "paused"].includes(task.status) && task.approvalExpiresAt.getTime() <= Date.now()) {
    const updated = await TaskPlan.findOneAndUpdate(
      { _id: task._id, userId, status: task.status, approvalExpiresAt: { $lte: new Date() } },
        { $set: { status: "expired", activeKey: null } },
      { new: true }
    );
    const current = updated || await findOwnedTask(taskId, userId);
    return current ? toPublicTask(current) : null;
  }
  return toPublicTask(task);
}

export async function listActiveTaskPlans(userId) {
  const now = new Date();
  await TaskPlan.updateMany(
    { userId, status: { $in: ["awaiting_review", "approved", "paused"] }, approvalExpiresAt: { $lte: now } },
    { $set: { status: "expired", activeKey: null } }
  );
  const tasks = await TaskPlan.find({
    userId,
    status: { $in: ["awaiting_review", "approved", "paused", "running"] },
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 }).limit(10);
  return (await Promise.all(tasks.map((task) => getTaskPlan(task._id, userId)))).filter(Boolean);
}

export async function approveTaskPlan(taskId, userId, planDigest) {
  if (!isValidTaskId(taskId) || typeof planDigest !== "string" || !/^[a-f\d]{64}$/i.test(planDigest)) return null;
  const now = new Date();
  const task = await TaskPlan.findOneAndUpdate(
    { _id: taskId, userId, status: "awaiting_review", planDigest, approvalExpiresAt: { $gt: now }, expiresAt: { $gt: now } },
    { $set: { status: "approved" } },
    { new: true }
  );
  return task ? toPublicTask(task) : null;
}

export async function rejectTaskPlan(taskId, userId) {
  if (!isValidTaskId(taskId)) return null;
  const task = await TaskPlan.findOneAndUpdate(
    { _id: taskId, userId, status: "awaiting_review" },
    { $set: { status: "rejected", activeKey: null } },
    { new: true }
  );
  return task ? toPublicTask(task) : null;
}

export async function pauseTaskPlan(taskId, userId) {
  if (!isValidTaskId(taskId)) return null;
  const task = await TaskPlan.findOneAndUpdate(
    { _id: taskId, userId, status: "approved" },
    { $set: { status: "paused" } },
    { new: true }
  ) || await TaskPlan.findOneAndUpdate(
    { _id: taskId, userId, status: "running" },
    { $set: { controlRequest: "pause" } },
    { new: true }
  );
  return task ? toPublicTask(task) : null;
}

export async function resumeTaskPlan(taskId, userId) {
  if (!isValidTaskId(taskId)) return null;
  const now = new Date();
  const task = await TaskPlan.findOneAndUpdate(
    { _id: taskId, userId, status: "paused", approvalExpiresAt: { $gt: now }, expiresAt: { $gt: now } },
    { $set: { status: "approved", controlRequest: null } },
    { new: true }
  );
  return task ? toPublicTask(task) : null;
}

export async function cancelTaskPlan(taskId, userId) {
  if (!isValidTaskId(taskId)) return null;
  const task = await TaskPlan.findOneAndUpdate(
    { _id: taskId, userId, status: { $in: ["awaiting_review", "approved", "paused"] } },
    { $set: { status: "cancelled", activeKey: null } },
    { new: true }
  ) || await TaskPlan.findOneAndUpdate(
    { _id: taskId, userId, status: "running" },
    { $set: { controlRequest: "cancel" } },
    { new: true }
  );
  if (!task) return null;
  if (task.status === "cancelled") {
    await TaskPlan.updateOne(
      { _id: task._id, userId, status: "cancelled" },
      { $set: { "steps.$[pending].status": "not_run" } },
      { arrayFilters: [{ "pending.status": "pending" }] }
    );
    task.steps.forEach((step) => { if (step.status === "pending") step.status = "not_run"; });
  }
  return toPublicTask(task);
}

export async function executeNextTaskStep(taskId, userId) {
  const task = await findOwnedTask(taskId, userId);
  if (!task) return null;
  if (task.status === "running") return getTaskPlan(taskId, userId);
  if (task.status !== "approved") return toPublicTask(task);
  if (task.approvalExpiresAt.getTime() <= Date.now()) {
    return getTaskPlan(taskId, userId);
  }

  const digest = getPlanDigest(task.steps);
  if (digest !== task.planDigest) {
    await TaskPlan.findOneAndUpdate(
      { _id: task._id, userId, status: "approved", planDigest: task.planDigest },
      { $set: { status: "failed", activeKey: null, "steps.$[pending].status": "not_run" } },
      { new: true, arrayFilters: [{ "pending.status": "pending" }] }
    );
    return getTaskPlan(taskId, userId);
  }
  const index = task.currentStep;
  const step = task.steps[index];
  if (!step || step.status !== "pending" || !validateDesktopTool(step.tool, step.arguments)) return toPublicTask(task);

  const claimed = await TaskPlan.findOneAndUpdate(
    { _id: task._id, userId, status: "approved", currentStep: index, planDigest: digest, [`steps.${index}.status`]: "pending" },
    { $set: { status: "running", [`steps.${index}.status`]: "running", [`steps.${index}.startedAt`]: new Date() } },
    { new: true }
  );
  if (!claimed) return getTaskPlan(taskId, userId);

  const beforeDispatch = await TaskPlan.findOne({ _id: task._id, userId, status: "running", currentStep: index });
  if (!beforeDispatch) return getTaskPlan(taskId, userId);
  if (beforeDispatch.controlRequest) {
    const pausedOrCancelled = beforeDispatch.controlRequest === "cancel" ? "cancelled" : "paused";
    const update = {
      status: pausedOrCancelled,
      controlRequest: null,
      [`steps.${index}.status`]: pausedOrCancelled === "cancelled" ? "not_run" : "pending",
      [`steps.${index}.startedAt`]: null,
    };
    if (pausedOrCancelled === "cancelled") update.activeKey = null;
    const result = await TaskPlan.findOneAndUpdate(
      { _id: task._id, userId, status: "running", currentStep: index, controlRequest: beforeDispatch.controlRequest },
      { $set: update },
      { new: true }
    );
    return result ? toPublicTask(result) : getTaskPlan(taskId, userId);
  }

  try {
    const result = await executeDesktopTool(step.tool, step.arguments);
    if (result?.success !== true) throw new Error("Desktop agent did not verify successful completion");

    const nextIndex = index + 1;
    let updated = null;
    for (let attempt = 0; attempt < 3 && !updated; attempt += 1) {
      const latest = await TaskPlan.findOne({ _id: task._id, userId, status: "running", currentStep: index });
      if (!latest) return getTaskPlan(taskId, userId);
      const finalStatus = latest.controlRequest === "cancel"
        ? "cancelled"
        : latest.controlRequest === "pause"
          ? "paused"
          : nextIndex >= latest.steps.length
            ? "completed"
            : "approved";
      const update = {
        status: finalStatus,
        currentStep: nextIndex,
        controlRequest: null,
        [`steps.${index}.status`]: "verified",
        [`steps.${index}.completedAt`]: new Date(),
        [`steps.${index}.resultSummary`]: "Desktop agent reported success.",
      };
      if (["cancelled", "completed"].includes(finalStatus)) update.activeKey = null;
      if (finalStatus === "cancelled") {
        latest.steps.slice(nextIndex).forEach((pending, offset) => {
          if (pending.status === "pending") update[`steps.${nextIndex + offset}.status`] = "not_run";
        });
      }
      updated = await TaskPlan.findOneAndUpdate(
        { _id: task._id, userId, status: "running", currentStep: index, controlRequest: latest.controlRequest, [`steps.${index}.status`]: "running" },
        { $set: update },
        { new: true }
      );
    }
    if (!updated) return getTaskPlan(taskId, userId);
    return toPublicTask(updated);
  } catch {
    const latest = await TaskPlan.findOne({ _id: task._id, userId, status: "running", currentStep: index });
    if (!latest) return getTaskPlan(taskId, userId);
    const update = {
      status: "outcome_unknown",
      activeKey: null,
      controlRequest: null,
      [`steps.${index}.status`]: "outcome_unknown",
      [`steps.${index}.resultSummary`]: "The step did not return a verified result. Check its effect before retrying.",
    };
    latest.steps.slice(index + 1).forEach((pending, offset) => {
      if (pending.status === "pending") update[`steps.${index + 1 + offset}.status`] = "not_run";
    });
    const updated = await TaskPlan.findOneAndUpdate(
      { _id: task._id, userId, status: "running", currentStep: index, [`steps.${index}.status`]: "running" },
      { $set: update },
      { new: true }
    );
    return updated ? toPublicTask(updated) : getTaskPlan(taskId, userId);
  }
}
