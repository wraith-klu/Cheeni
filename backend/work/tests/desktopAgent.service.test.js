import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopAgentError, executeDesktopTool, validateDesktopTool } from "../services/desktopAgent.service.js";
import { LOCAL_COMMAND_TOOLS } from "../services/toolsSchema.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("registered desktop tool policy", () => {
  it("accepts only canonical app, standard-folder, and web alias payloads", () => {
    expect(validateDesktopTool("launch_app", { app_name: "notepad" })).toBe(true);
    expect(validateDesktopTool("open_folder", { folder: "downloads" })).toBe(true);
    expect(validateDesktopTool("open_url", { url: "https://example.com/" })).toBe(true);
  });

  it("rejects alias payloads that try to expand the registered tools", () => {
    expect(validateDesktopTool("launch_app", { app_name: "notepad", executable: "C:\\evil.exe" })).toBe(false);
    expect(validateDesktopTool("launch_app", { app_name: "C:\\evil.exe" })).toBe(false);
    expect(validateDesktopTool("open_folder", { folder: "C:\\Users\\Admin" })).toBe(false);
    expect(validateDesktopTool("open_url", { url: "javascript:alert(1)" })).toBe(false);
    expect(validateDesktopTool("run_shell", { command: "whoami" })).toBe(false);
  });

  it("marks every model-exposed local tool schema as closed to unknown arguments", () => {
    expect(LOCAL_COMMAND_TOOLS.every(({ function: tool }) => tool.parameters.additionalProperties === false)).toBe(true);
  });

  it("does not report success when the agent response is not valid JSON", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "t".repeat(40));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => null }));

    await expect(executeDesktopTool("open_folder", { folder: "documents" }))
      .rejects.toMatchObject({ name: "DesktopAgentError", code: "outcome_unknown" });
  });

  it("reports an explicit agent failure as failed rather than uncertain", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "t".repeat(40));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }));

    await expect(executeDesktopTool("open_folder", { folder: "documents" }))
      .rejects.toMatchObject({ code: "action_failed" });
  });

  it("distinguishes a refused local connection from an uncertain timeout", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "t".repeat(40));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(
      new TypeError("fetch failed"),
      { cause: { code: "ECONNREFUSED" } },
    )));

    await expect(executeDesktopTool("open_folder", { folder: "documents" }))
      .rejects.toMatchObject({ code: "agent_unavailable" });
  });
});
