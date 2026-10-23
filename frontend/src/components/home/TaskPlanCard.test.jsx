import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TaskPlanCard from "./TaskPlanCard";

const baseTask = {
  id: "task-one",
  executionEnabled: true,
  planDigest: "a".repeat(64),
  currentStep: 0,
  status: "awaiting_review",
  steps: [
    { order: 1, description: "Open Notepad", status: "pending", resultSummary: "" },
    { order: 2, description: "Open Documents", status: "pending", resultSummary: "" },
  ],
};

describe("TaskPlanCard", () => {
  it("requires an explicit action to approve or reject a preview", () => {
    const onAction = vi.fn();
    render(<TaskPlanCard task={baseTask} onAction={onAction} />);

    expect(screen.getByText("Task plan · awaiting review")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve exact plan" }));

    expect(onAction).toHaveBeenCalledWith("approve");
  });

  it("exposes only the next step after approval", () => {
    const onAction = vi.fn();
    render(<TaskPlanCard task={{ ...baseTask, status: "approved" }} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Run step 1" }));

    expect(onAction).toHaveBeenCalledWith("step");
    expect(screen.queryByRole("button", { name: "Run step 2" })).toBeNull();
  });

  it("does not offer retry for an unknown outcome", () => {
    render(<TaskPlanCard task={{ ...baseTask, status: "outcome_unknown" }} onAction={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toContain("will not retry");
    expect(screen.queryByRole("button", { name: /run step/i })).toBeNull();
  });

  it("keeps execution unavailable while the server feature flag is off", () => {
    render(<TaskPlanCard task={{ ...baseTask, executionEnabled: false }} onAction={vi.fn()} />);

    expect(screen.getByText("Multi-step execution is disabled by server configuration.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve exact plan" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
  });
});
