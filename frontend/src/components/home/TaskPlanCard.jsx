import React from "react";

const statusLabel = (status) => status.replaceAll("_", " ");

export default function TaskPlanCard({ task, busyAction, onAction }) {
  if (!task) return null;

  const actionButton = (action, label, disabled = false) => (
    <button
      key={action}
      type="button"
      disabled={disabled || (Boolean(busyAction) && !["pause", "cancel"].includes(action))}
      onClick={() => onAction(action)}
      style={{
        border: "1px solid var(--land-rule)",
        borderRadius: 7,
        padding: "6px 9px",
        color: "var(--land-ink)",
        background: "var(--land-bg)",
        cursor: disabled || (busyAction && !["pause", "cancel"].includes(action)) ? "not-allowed" : "pointer",
        opacity: disabled || (busyAction && !["pause", "cancel"].includes(action)) ? 0.6 : 1,
      }}
    >
      {busyAction === action ? "Working…" : label}
    </button>
  );

  return (
    <section
      aria-label="Multi-step task plan"
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 9,
        border: "1px solid var(--land-rule)",
        background: "var(--land-bg-2)",
        color: "var(--land-ink)",
        fontSize: 11,
      }}
    >
      <strong>Task plan · {statusLabel(task.status)}</strong>
      {task.executionEnabled !== true && <p role="status">Multi-step execution is disabled by server configuration.</p>}
      <ol style={{ margin: "7px 0", paddingLeft: 20 }}>
        {task.steps.map((step) => (
          <li key={step.order} style={{ marginBottom: 4 }}>
            {step.description} <span style={{ color: "var(--land-ink-3)" }}>({statusLabel(step.status)})</span>
            {step.resultSummary && <div style={{ color: "var(--land-ink-3)" }}>{step.resultSummary}</div>}
          </li>
        ))}
      </ol>
      {task.status === "awaiting_review" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {task.executionEnabled === true && actionButton("approve", "Approve exact plan")}
          {actionButton("reject", "Reject")}
        </div>
      )}
      {task.status === "approved" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {task.executionEnabled === true && actionButton("step", `Run step ${task.currentStep + 1}`)}
          {task.executionEnabled === true && actionButton("pause", "Pause")}
          {actionButton("cancel", "Cancel")}
        </div>
      )}
      {task.status === "running" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {task.executionEnabled === true && actionButton("pause", "Pause after current step")}
          {actionButton("cancel", "Cancel after current step")}
        </div>
      )}
      {task.status === "paused" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {task.executionEnabled === true && actionButton("resume", "Resume")}
          {actionButton("cancel", "Cancel")}
        </div>
      )}
      {busyAction && <span role="status" style={{ display: "block", marginTop: 6 }}>Updating task…</span>}
      {task.status === "outcome_unknown" && <p role="alert">Check the current device state before creating a new task. Cheeni will not retry this step.</p>}
    </section>
  );
}
