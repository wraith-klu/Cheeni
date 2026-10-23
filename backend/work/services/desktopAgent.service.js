import { LOCAL_COMMAND_TOOLS } from "./toolsSchema.js";

export class DesktopAgentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DesktopAgentError";
    this.code = code;
  }
}

const APPROVED_APP_IDS = new Set([
  "notepad", "calculator", "calc", "paint", "mspaint", "chrome", "google chrome",
  "edge", "microsoft edge", "firefox", "brave", "vscode", "vs code",
  "visual studio code", "spotify", "file explorer", "explorer",
]);

const TOOL_VALIDATORS = {
  launch_app: (args) =>
    Object.keys(args).length === 1 &&
    typeof args.app_name === "string" &&
    args.app_name.trim().length > 0 &&
    args.app_name.length <= 80 &&
    APPROVED_APP_IDS.has(args.app_name.trim().toLowerCase()),
  open_folder: (args) =>
    Object.keys(args).length === 1 &&
    ["home", "desktop", "documents", "downloads"].includes(args.folder),
  open_url: (args) => {
    if (Object.keys(args).length !== 1 || typeof args.url !== "string" || args.url.length > 2048) return false;
    try {
      const url = new URL(args.url);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  },
  get_system_telemetry: (args) =>
    Object.keys(args).length === 1 &&
    ["battery", "cpu_ram", "specs", "datetime", "all"].includes(args.metric),
};

export function validateDesktopTool(name, args) {
  return Boolean(
    LOCAL_COMMAND_TOOLS.some(({ function: tool }) => tool.name === name) &&
      args &&
      typeof args === "object" &&
      !Array.isArray(args) &&
      TOOL_VALIDATORS[name]?.(args)
  );
}

export async function executeDesktopTool(name, args) {
  if (!validateDesktopTool(name, args)) {
    throw new Error("Unknown desktop tool or invalid arguments");
  }

  const token = process.env.AGENT_API_TOKEN;
  if (!token || token.length < 32) {
    throw new DesktopAgentError("agent_not_configured", "The local desktop agent is not configured.");
  }

  const baseUrl = (process.env.AGENT_BASE_URL || "http://127.0.0.1:2026").replace(/\/$/, "");
  let response;
  try {
    response = await fetch(`${baseUrl}/api/agent/tool`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, arguments: args }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    const networkCode = error?.cause?.code;
    const definitelyUnreachable = ["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH"].includes(networkCode);
    throw new DesktopAgentError(
      definitelyUnreachable ? "agent_unavailable" : "outcome_unknown",
      definitelyUnreachable ? "The local desktop agent is unavailable." : "The action outcome could not be verified. Check its effect before retrying."
    );
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const code = response.status >= 500 ? "outcome_unknown" : "agent_rejected";
    const message = code === "outcome_unknown"
      ? "The local agent did not return a verifiable result. Check the action before retrying."
      : "The local agent rejected the request.";
    throw new DesktopAgentError(code, message);
  }
  if (result?.success === false) {
    throw new DesktopAgentError("action_failed", "The local agent reported that the action failed.");
  }
  if (!result || result.success !== true) {
    throw new DesktopAgentError("outcome_unknown", "The action outcome could not be verified. Check its effect before retrying.");
  }
  return result;
}
