import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BrowserWorkflowModal from "./BrowserWorkflowModal";

describe("BrowserWorkflowModal Component (Phase 5 UI)", () => {
  it("does not render when closed", () => {
    const { container } = render(<BrowserWorkflowModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders workflow title, categories, and close button when open", () => {
    render(<BrowserWorkflowModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText("Controlled Browser Workflows")).toBeInTheDocument();
    expect(screen.getByText(/Isolated, sandboxed read-only research/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Close modal")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    let closed = false;
    render(<BrowserWorkflowModal isOpen={true} onClose={() => { closed = true; }} />);
    const closeBtn = screen.getByLabelText("Close modal");
    fireEvent.click(closeBtn);
    expect(closed).toBe(true);
  });
});
