import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  validateDesktopTool: vi.fn(),
  executeDesktopTool: vi.fn(),
}));

vi.mock("../model/taskPlan.model.js", () => ({
  default: {
    create: mocks.create,
    findOneAndUpdate: mocks.findOneAndUpdate,
    findOne: mocks.findOne,
  },
}));

vi.mock("../services/desktopAgent.service.js", () => ({
  validateDesktopTool: mocks.validateDesktopTool,
  executeDesktopTool: mocks.executeDesktopTool,
}));

import { approveTaskPlan, createTaskPlanRecord, executeNextTaskStep, getPlanDigest } from "../services/taskExecution.service.js";

const plan = {
  steps: [
    { order: 1, tool: "launch_app", arguments: { app_name: "notepad" }, description: "Open Notepad" },
    { order: 2, tool: "open_folder", arguments: { folder: "documents" }, description: "Open Documents" },
  ],
};

describe("approved task execution foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateDesktopTool.mockReturnValue(true);
  });

  it("creates a user-owned review-only record with an exact-plan digest", async () => {
    mocks.create.mockImplementation(async (record) => ({
      ...record,
      _id: { toString: () => "507f1f77bcf86cd799439011" },
      steps: record.steps.map((step) => ({ ...step, status: "pending", resultSummary: "" })),
    }));

    const result = await createTaskPlanRecord("507f191e810c19729de860ea", plan);

    expect(result).toMatchObject({
      id: "507f1f77bcf86cd799439011",
      status: "awaiting_review",
      steps: [{ status: "pending" }, { status: "pending" }],
    });
    expect(result.planDigest).toBe(getPlanDigest(result.steps));
    expect(mocks.create.mock.calls[0][0].userId).toBe("507f191e810c19729de860ea");
  });

  it("rejects unsupported steps before persisting a plan", async () => {
    mocks.validateDesktopTool.mockReturnValue(false);

    await expect(createTaskPlanRecord("507f191e810c19729de860ea", plan)).rejects.toThrow("unsupported step");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("binds approval to the owner, digest, pending state, and expiry", async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    const digest = getPlanDigest(plan.steps);

    await approveTaskPlan("507f1f77bcf86cd799439011", "507f191e810c19729de860ea", digest);

    expect(mocks.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      _id: "507f1f77bcf86cd799439011",
      userId: "507f191e810c19729de860ea",
      status: "awaiting_review",
      planDigest: digest,
    });
    expect(mocks.findOneAndUpdate.mock.calls[0][1].$set.status).toBe("approved");
  });

  it("changes the digest when any step argument changes", () => {
    const changed = structuredClone(plan);
    changed.steps[0].arguments.app_name = "calculator";

    expect(getPlanDigest(changed.steps)).not.toBe(getPlanDigest(plan.steps));
  });

  it("executes only the current step and returns the task to approved for the next step", async () => {
    const taskId = "507f1f77bcf86cd799439011";
    const userId = "507f191e810c19729de860ea";
    const digest = getPlanDigest(plan.steps);
    const taskDoc = (status, stepStatus = "pending") => ({
      _id: { toString: () => taskId },
      userId,
      status,
      planDigest: digest,
      currentStep: 0,
      approvalExpiresAt: new Date(Date.now() + 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      controlRequest: null,
      steps: plan.steps.map((step, index) => ({
        ...step,
        status: index === 0 ? stepStatus : "pending",
        resultSummary: "",
        startedAt: new Date(),
      })),
    });
    const initial = taskDoc("approved");
    const running = taskDoc("running", "running");
    const completedStep = taskDoc("running", "verified");
    const next = { ...completedStep, status: "approved", currentStep: 1 };
    mocks.findOne.mockResolvedValueOnce(initial).mockResolvedValueOnce(running).mockResolvedValueOnce(completedStep);
    mocks.findOneAndUpdate.mockResolvedValueOnce(running).mockResolvedValueOnce(next);
    mocks.executeDesktopTool.mockResolvedValue({ success: true });

    const result = await executeNextTaskStep(taskId, userId);

    expect(mocks.executeDesktopTool).toHaveBeenCalledTimes(1);
    expect(mocks.executeDesktopTool).toHaveBeenCalledWith("launch_app", { app_name: "notepad" });
    expect(result).toMatchObject({ status: "approved", currentStep: 1 });
    expect(result.steps[0].status).toBe("verified");
    expect(result.steps[1].status).toBe("pending");
  });

  it("marks a tool transport failure outcome unknown and does not retry it", async () => {
    const taskId = "507f1f77bcf86cd799439011";
    const userId = "507f191e810c19729de860ea";
    const digest = getPlanDigest(plan.steps);
    const taskDoc = (status, stepStatus) => ({
      _id: { toString: () => taskId },
      userId,
      status,
      planDigest: digest,
      currentStep: 0,
      approvalExpiresAt: new Date(Date.now() + 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      controlRequest: null,
      steps: plan.steps.map((step, index) => ({ ...step, status: index === 0 ? stepStatus : "pending", startedAt: new Date() })),
    });
    mocks.findOne.mockResolvedValueOnce(taskDoc("approved", "pending"))
      .mockResolvedValueOnce(taskDoc("running", "running"))
      .mockResolvedValueOnce(taskDoc("running", "running"));
    const outcomeUnknown = taskDoc("outcome_unknown", "outcome_unknown");
    outcomeUnknown.steps[1].status = "not_run";
    mocks.findOneAndUpdate.mockResolvedValueOnce(taskDoc("running", "running"))
      .mockResolvedValueOnce(outcomeUnknown);
    mocks.executeDesktopTool.mockRejectedValue(new Error("agent timeout"));

    const result = await executeNextTaskStep(taskId, userId);

    expect(result.status).toBe("outcome_unknown");
    expect(result.steps[0].status).toBe("outcome_unknown");
    expect(result.steps[1].status).toBe("not_run");
    expect(mocks.executeDesktopTool).toHaveBeenCalledTimes(1);
  });
});
