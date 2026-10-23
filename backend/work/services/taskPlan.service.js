import { validateDesktopTool } from "./desktopAgent.service.js";

const MAX_PLAN_STEPS = 5;

const describeStep = (name, args) => {
  switch (name) {
    case "launch_app": return `Open application: ${args.app_name}`;
    case "open_folder": return `Open folder: ${args.folder}`;
    case "open_url": return `Open website: ${args.url}`;
    case "get_system_telemetry": return `Read system status: ${args.metric}`;
    default: return null;
  }
};

export function createTaskPlan(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length < 2 || toolCalls.length > MAX_PLAN_STEPS) {
    return { success: false, reason: `Plans must contain between 2 and ${MAX_PLAN_STEPS} supported steps.` };
  }

  const steps = [];
  for (const [index, toolCall] of toolCalls.entries()) {
    const name = toolCall?.function?.name;
    let args;
    try {
      args = JSON.parse(toolCall?.function?.arguments || "{}");
    } catch {
      return { success: false, reason: "A proposed step had invalid arguments; nothing was executed." };
    }
    if (!validateDesktopTool(name, args)) {
      return { success: false, reason: "A proposed step is unsupported or invalid; nothing was executed." };
    }
    steps.push({
      order: index + 1,
      tool: name,
      arguments: args,
      description: describeStep(name, args),
      status: "pending",
    });
  }

  return {
    success: true,
    plan: {
      status: "awaiting_review",
      executionStarted: false,
      steps,
    },
  };
}

export function formatTaskPlan(plan) {
  const steps = plan.steps.map((step) => `${step.order}. ${step.description}`).join("\n");
  return `Proposed plan (not executed):\n${steps}\n\nReview and approve this exact plan in the task panel. Each step will require a separate run action.`;
}
