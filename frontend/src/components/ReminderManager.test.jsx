import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReminderManager from "./ReminderManager";

describe("ReminderManager Component (Phase 9)", () => {
  const storageKey = "cheeni_reminders_test_user";

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not render modal contents when closed", () => {
    const { container } = render(<ReminderManager isOpen={false} onClose={() => {}} storageKey={storageKey} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders empty state and schedule form when open", () => {
    render(<ReminderManager isOpen={true} onClose={() => {}} storageKey={storageKey} />);
    expect(screen.getByRole("heading", { name: "Reminders" })).toBeInTheDocument();
    expect(screen.getByText("No reminders yet.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Reminder text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("adds a one-time reminder to localStorage and displays it", () => {
    render(<ReminderManager isOpen={true} onClose={() => {}} storageKey={storageKey} />);
    
    const input = screen.getByPlaceholderText("Reminder text");
    fireEvent.change(input, { target: { value: "Submit assignment" } });
    
    const submitBtn = screen.getByRole("button", { name: "Add" });
    fireEvent.click(submitBtn);

    expect(screen.getByText("Submit assignment")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].title).toBe("Submit assignment");
    expect(stored[0].repeat).toBe("never");
    expect(stored[0].status).toBe("pending");
  });

  it("pauses and resumes a reminder", () => {
    const initialReminders = [
      {
        id: "rem-1",
        title: "Team meeting",
        at: new Date(Date.now() + 3600000).toISOString(),
        repeat: "never",
        status: "pending",
      },
    ];
    localStorage.setItem(storageKey, JSON.stringify(initialReminders));

    render(<ReminderManager isOpen={true} onClose={() => {}} storageKey={storageKey} />);
    
    const pauseBtn = screen.getByRole("button", { name: "Pause" });
    fireEvent.click(pauseBtn);

    let stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    expect(stored[0].status).toBe("paused");
    expect(screen.getByText(/paused/i)).toBeInTheDocument();

    const resumeBtn = screen.getByRole("button", { name: "Resume" });
    fireEvent.click(resumeBtn);

    stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    expect(stored[0].status).toBe("pending");
  });

  it("deletes a reminder from list and storage", () => {
    const initialReminders = [
      {
        id: "rem-del",
        title: "Delete me",
        at: new Date(Date.now() + 3600000).toISOString(),
        repeat: "never",
        status: "pending",
      },
    ];
    localStorage.setItem(storageKey, JSON.stringify(initialReminders));

    render(<ReminderManager isOpen={true} onClose={() => {}} storageKey={storageKey} />);
    expect(screen.getByText("Delete me")).toBeInTheDocument();

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    expect(screen.queryByText("Delete me")).toBeNull();
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    expect(stored.length).toBe(0);
  });
});
