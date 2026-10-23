import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { executeAgenticAction } from "./actionRunner";

vi.mock("./api.js", () => ({ getAccessToken: () => "test-access-token" }));

afterEach(() => vi.restoreAllMocks());

describe("desktop action result reporting", () => {
  it("reports a confirmed tool result as succeeded", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { success: true, message: "Opened Documents" } });

    const result = await executeAgenticAction({ type: "open_folder", folder: "documents" });

    expect(result).toMatchObject({ executed: true, success: true, status: "succeeded", retryable: false });
  });

  it("preserves an uncertain backend outcome without suggesting a retry", async () => {
    vi.spyOn(axios, "post").mockRejectedValue({
      response: { data: { status: "outcome_unknown", message: "Check before retrying." } },
    });

    const result = await executeAgenticAction({ type: "open_url", url: "https://example.com" });

    expect(result).toMatchObject({ executed: null, success: false, status: "outcome_unknown", retryable: false });
    expect(result.error).toBe("Check before retrying.");
  });
});
