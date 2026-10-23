import axios from "axios";
import { getAccessToken } from "./api.js";

const runDesktopTool = async (serverURL, name, args) => {
  const token = getAccessToken();
  const response = await axios.post(
    `${serverURL}/api/agent/tool`,
    { name, arguments: args },
    {
      withCredentials: true,
      timeout: 10000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
};

export const executeAgenticAction = async (action, serverURL = "http://localhost:2025") => {
  if (!action || typeof action.type !== "string") return { executed: false, status: "unsupported", retryable: false };

  try {
    let name;
    let args;

    switch (action.type) {
      case "launch_app":
        name = "launch_app";
        args = { app_name: action.app };
        break;
      case "open_folder":
        name = "open_folder";
        args = { folder: action.folder || action.subType };
        break;
      case "open_url":
      case "play_music":
      case "search_web":
        if (!action.url) {
          return { executed: false, success: false, status: "invalid_request", retryable: false, error: "This action needs a validated URL." };
        }
        name = "open_url";
        args = { url: action.url };
        break;
      case "system_status": {
        const allowedMetrics = ["battery", "cpu_ram", "specs", "datetime", "all"];
        const metric = allowedMetrics.includes(action.subType) ? action.subType : "all";
        name = "get_system_telemetry";
        args = { metric };
        break;
      }
      case "copy_text":
        if (action.text && navigator.clipboard) {
          await navigator.clipboard.writeText(action.text);
          return { executed: true, success: true, type: action.type, label: "Copied text to clipboard" };
        }
        return { executed: false, success: false, error: "Clipboard access is unavailable." };
      default:
        return {
          executed: false,
          success: false,
          status: "unsupported",
          retryable: false,
          error: `The ${action.type} action is not enabled in the current command milestone.`,
        };
    }

    const result = await runDesktopTool(serverURL, name, args);
    const success = result?.success === true;
    return {
      executed: true,
      success,
      status: success ? "succeeded" : "failed",
      retryable: false,
      type: action.type,
      label: action.label || result?.message || action.query || action.app || "Desktop action completed",
      data: result,
      error: success ? undefined : result?.message || result?.detail || "The desktop agent did not confirm success.",
    };
  } catch (error) {
    const status = error.response?.data?.status || (error.code === "ECONNABORTED" ? "outcome_unknown" : error.response ? "failed" : "agent_unavailable");
    return {
      executed: status === "outcome_unknown" ? null : false,
      success: false,
      status,
      retryable: false,
      error: error.response?.data?.message || error.response?.data?.detail || error.message,
    };
  }
};

export default executeAgenticAction;
