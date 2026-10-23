import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { executeDesktopTool } = vi.hoisted(() => ({ executeDesktopTool: vi.fn() }));

vi.mock("../services/desktopAgent.service.js", () => ({
  executeDesktopTool,
  validateDesktopTool: () => true,
}));

import TaskPlan from "../model/taskPlan.model.js";
import {
  approveTaskPlan,
  createTaskPlanRecord,
  executeNextTaskStep,
  getPlanDigest,
  getTaskPlan,
} from "../services/taskExecution.service.js";

const enabled = process.env.RUN_MONGO_INTEGRATION === "true";
const mongoUrl = "mongodb://127.0.0.1:27017/CheeniPhase15IntegrationTest";
const firstUser = new mongoose.Types.ObjectId();
const otherUser = new mongoose.Types.ObjectId();
const samplePlan = {
  steps: [
    { order: 1, tool: "launch_app", arguments: { app_name: "notepad" } },
    { order: 2, tool: "open_folder", arguments: { folder: "documents" } },
  ],
};

describe.skipIf(!enabled)("task execution Mongo integration", () => {
  beforeAll(async () => {
    await mongoose.connect(mongoUrl);
    await mongoose.connection.dropDatabase();
    await TaskPlan.init();
    process.env.TASK_EXECUTION_ENABLED = "true";
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await TaskPlan.init();
    executeDesktopTool.mockReset();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
    delete process.env.TASK_EXECUTION_ENABLED;
  });

  it("enforces one active task per user and scopes task reads by owner", async () => {
    const task = await createTaskPlanRecord(firstUser, samplePlan);

    await expect(createTaskPlanRecord(firstUser, samplePlan)).rejects.toMatchObject({ code: 11000 });
    expect(await getTaskPlan(task.id, otherUser)).toBeNull();
    expect(await getTaskPlan(task.id, firstUser)).toMatchObject({ status: "awaiting_review" });
  });

  it("claims concurrent step requests once and persists state across reconnect", async () => {
    const task = await createTaskPlanRecord(firstUser, samplePlan);
    const digest = getPlanDigest(task.steps);
    await approveTaskPlan(task.id, firstUser, digest);

    let releaseExecution;
    executeDesktopTool.mockReturnValue(new Promise((resolve) => {
      releaseExecution = resolve;
    }));

    const firstRequest = executeNextTaskStep(task.id, firstUser);
    await vi.waitFor(() => expect(executeDesktopTool).toHaveBeenCalledTimes(1));
    const concurrentRequest = await executeNextTaskStep(task.id, firstUser);
    expect(concurrentRequest.status).toBe("running");
    expect(executeDesktopTool).toHaveBeenCalledTimes(1);

    releaseExecution({ success: true });
    const result = await firstRequest;
    expect(result).toMatchObject({ status: "approved", currentStep: 1 });
    expect(executeDesktopTool).toHaveBeenCalledTimes(1);

    await mongoose.disconnect();
    await mongoose.connect(mongoUrl);
    const persisted = await TaskPlan.findById(task.id).lean();
    expect(persisted).toMatchObject({ status: "approved", currentStep: 1 });
    expect(persisted.steps[0].status).toBe("verified");
    expect(persisted.steps[1].status).toBe("pending");
  });
});
