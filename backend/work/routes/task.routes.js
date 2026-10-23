import express from "express";
import isAuth from "../middlewares/isAuth.js";
import {
  approveTaskPlan,
  cancelTaskPlan,
  executeNextTaskStep,
  getTaskPlan,
  listActiveTaskPlans,
  pauseTaskPlan,
  rejectTaskPlan,
  resumeTaskPlan,
} from "../services/taskExecution.service.js";

const taskRouter = express.Router();
const requireTaskExecutionEnabled = (req, res, next) => {
  if (process.env.TASK_EXECUTION_ENABLED !== "true") {
    return res.status(503).json({ success: false, message: "Multi-step execution is disabled by server configuration." });
  }
  return next();
};

taskRouter.get("/", isAuth, async (req, res) => {
  try {
    const tasks = await listActiveTaskPlans(req.userId);
    return res.status(200).json({ success: true, tasks });
  } catch {
    return res.status(500).json({ success: false, message: "Could not load active tasks" });
  }
});

taskRouter.get("/:taskId", isAuth, async (req, res) => {
  try {
    const task = await getTaskPlan(req.params.taskId, req.userId);
    return task ? res.status(200).json({ success: true, task }) : res.status(404).json({ success: false, message: "Task not found or unavailable" });
  } catch {
    return res.status(500).json({ success: false, message: "Could not load task status" });
  }
});

taskRouter.post("/:taskId/approve", isAuth, requireTaskExecutionEnabled, async (req, res) => {
  try {
    const task = await approveTaskPlan(req.params.taskId, req.userId, req.body?.planDigest);
    return task ? res.status(200).json({ success: true, task }) : res.status(409).json({ success: false, message: "Task approval is stale, expired, or unavailable" });
  } catch {
    return res.status(500).json({ success: false, message: "Could not approve task" });
  }
});

taskRouter.post("/:taskId/reject", isAuth, async (req, res) => {
  try {
    const task = await rejectTaskPlan(req.params.taskId, req.userId);
    return task ? res.status(200).json({ success: true, task }) : res.status(409).json({ success: false, message: "Task can no longer be rejected" });
  } catch {
    return res.status(500).json({ success: false, message: "Could not reject task" });
  }
});

taskRouter.post("/:taskId/step", isAuth, requireTaskExecutionEnabled, async (req, res) => {
  try {
    const task = await executeNextTaskStep(req.params.taskId, req.userId);
    if (!task) return res.status(404).json({ success: false, message: "Task not found or unavailable" });
    if (["outcome_unknown", "failed"].includes(task.status)) return res.status(409).json({ success: false, task, message: "Task stopped because the step outcome needs review" });
    return res.status(200).json({ success: true, task });
  } catch {
    return res.status(500).json({ success: false, message: "Task step could not be executed" });
  }
});

taskRouter.post("/:taskId/pause", isAuth, async (req, res) => {
  try {
    const task = await pauseTaskPlan(req.params.taskId, req.userId);
    return task ? res.status(200).json({ success: true, task }) : res.status(409).json({ success: false, message: "Task cannot be paused in its current state" });
  } catch {
    return res.status(500).json({ success: false, message: "Could not pause task" });
  }
});

taskRouter.post("/:taskId/resume", isAuth, requireTaskExecutionEnabled, async (req, res) => {
  try {
    const task = await resumeTaskPlan(req.params.taskId, req.userId);
    return task ? res.status(200).json({ success: true, task }) : res.status(409).json({ success: false, message: "Task approval expired or task cannot resume" });
  } catch {
    return res.status(500).json({ success: false, message: "Could not resume task" });
  }
});

taskRouter.post("/:taskId/cancel", isAuth, async (req, res) => {
  try {
    const task = await cancelTaskPlan(req.params.taskId, req.userId);
    return task ? res.status(200).json({ success: true, task }) : res.status(409).json({ success: false, message: "Task cannot be cancelled in its current state" });
  } catch {
    return res.status(500).json({ success: false, message: "Could not cancel task" });
  }
});

export default taskRouter;
