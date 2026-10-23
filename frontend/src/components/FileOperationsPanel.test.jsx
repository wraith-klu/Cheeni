import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import apiClient from "../utils/api";
import FileOperationsPanel from "./FileOperationsPanel";

vi.mock("../utils/api", () => ({ default: { post: vi.fn() } }));

describe("FileOperationsPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the server preview and confirms only after a separate user action", async () => {
    const preview = {
      operation_id: "one-time-op",
      type: "create_folder",
      state: "pending",
      expires_at: Date.now() / 1000 + 300,
      parent: "C:/Users/demo/Downloads",
      destination: "C:/Users/demo/Downloads/New Folder",
      item_count: 1,
      estimated_bytes: 0,
      collision_policy: "reject; no overwrite",
      undo_available: false,
    };
    apiClient.post
      .mockResolvedValueOnce({ data: { preview } })
      .mockResolvedValueOnce({ data: { operation: { ...preview, state: "completed", result: { success: true } } } });

    render(<FileOperationsPanel />);
    fireEvent.change(screen.getByLabelText("Existing parent folder path"), { target: { value: preview.parent } });
    fireEvent.change(screen.getByLabelText("New name"), { target: { value: "New Folder" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview exact operation" }));

    await screen.findByText("Review before confirming");
    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/api/agent/files/operations/preview", {
      type: "create_folder", parent: preview.parent, name: "New Folder",
    });
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Confirm this exact change" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    expect(apiClient.post).toHaveBeenLastCalledWith("/api/agent/files/operations/one-time-op/confirm", {});
  }, 10000);
});
