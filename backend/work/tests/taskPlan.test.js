import { describe, expect, it } from "vitest";
import { createTaskPlan, formatTaskPlan } from "../services/taskPlan.service.js";

const toolCall = (name, args) => ({
  function: { name, arguments: JSON.stringify(args) },
});

describe("task plan preview", () => {
  it("builds a validated preview without marking any step executed", () => {
    const result = createTaskPlan([
      toolCall("launch_app", { app_name: "notepad" }),
      toolCall("open_folder", { folder: "documents" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.plan).toMatchObject({ status: "awaiting_review", executionStarted: false });
    expect(result.plan.steps.map((step) => step.status)).toEqual(["pending", "pending"]);
    expect(formatTaskPlan(result.plan)).toContain("Proposed plan (not executed)");
  });

  it("rejects unsupported or malformed steps", () => {
    const result = createTaskPlan([
      toolCall("launch_app", { app_name: "notepad" }),
      toolCall("run_shell", { command: "whoami" }),
    ]);

    expect(result.success).toBe(false);
    expect(result.reason).toContain("nothing was executed");
  });

  it("rejects plans exceeding the five-step limit", () => {
    const result = createTaskPlan(Array.from({ length: 6 }, () => toolCall("open_folder", { folder: "documents" })));

    expect(result.success).toBe(false);
    expect(result.reason).toContain("between 2 and 5");
  });
});
