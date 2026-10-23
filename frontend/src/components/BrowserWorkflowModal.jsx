import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

export default function BrowserWorkflowModal({ isOpen, onClose }) {
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);

  // Preview & execution state
  const [preview, setPreview] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [activeRun, setActiveRun] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const pollIntervalRef = useRef(null);

  // Load registered workflows on open
  useEffect(() => {
    if (!isOpen) {
      clearInterval(pollIntervalRef.current);
      return;
    }
    setErrorMsg("");
    setIsLoadingWorkflows(true);
    axios
      .get("http://localhost:2025/api/browser/workflows", { withCredentials: true })
      .then((res) => {
        if (res.data?.workflows?.length) {
          setWorkflows(res.data.workflows);
          setSelectedWorkflowId(res.data.workflows[0].id);
        }
      })
      .catch((err) => {
        setErrorMsg(err.response?.data?.message || "Failed to load browser workflows");
      })
      .finally(() => {
        setIsLoadingWorkflows(false);
      });
  }, [isOpen]);

  // Clean up polling timer
  useEffect(() => {
    return () => clearInterval(pollIntervalRef.current);
  }, []);

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);

  // Pre-fill suggested domain example when switching workflow
  useEffect(() => {
    if (selectedWorkflow && (!targetUrl || !selectedWorkflow.allowedDomains.some(d => targetUrl.includes(d)))) {
      const firstDomain = selectedWorkflow.allowedDomains[0];
      if (firstDomain.includes("wikipedia")) {
        setTargetUrl("https://en.wikipedia.org/wiki/Artificial_intelligence");
      } else if (firstDomain.includes("python")) {
        setTargetUrl("https://docs.python.org/3/");
      } else if (firstDomain.includes("apple")) {
        setTargetUrl("https://www.apple.com/iphone-16-pro/specs/");
      } else {
        setTargetUrl(`https://${firstDomain}/`);
      }
    }
  }, [selectedWorkflowId]);

  // Handle Preview Generation
  const handleGeneratePreview = async (e) => {
    e?.preventDefault();
    if (!selectedWorkflowId || !targetUrl.trim()) return;

    setErrorMsg("");
    setIsPreviewing(true);
    setPreview(null);
    setRunResult(null);

    try {
      const res = await axios.post(
        "http://localhost:2025/api/browser/workflows/preview",
        { workflowId: selectedWorkflowId, url: targetUrl.trim() },
        { withCredentials: true }
      );
      if (res.data?.success) {
        setPreview(res.data.preview);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Could not generate workflow preview");
    } finally {
      setIsPreviewing(false);
    }
  };

  // Handle Explicit User Start
  const handleStartWorkflow = async () => {
    if (!preview) return;

    setErrorMsg("");
    setRunResult(null);
    try {
      const res = await axios.post(
        "http://localhost:2025/api/browser/workflows/start",
        {
          workflowId: preview.workflowId,
          url: preview.targetUrl,
          previewId: preview.previewId,
        },
        { withCredentials: true }
      );

      if (res.data?.success) {
        setActiveRun(res.data.run);
        startStatusPolling(res.data.run.runId);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to start workflow execution");
    }
  };

  // Poll Run Status
  const startStatusPolling = (runId) => {
    clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:2025/api/browser/runs/${runId}`, {
          withCredentials: true,
        });
        if (res.data?.success) {
          const run = res.data.run;
          setActiveRun(run);

          if (["completed", "failed", "cancelled", "blocked_by_policy", "timed_out"].includes(run.state)) {
            clearInterval(pollIntervalRef.current);
            fetchRunResult(runId);
          }
        }
      } catch {
        clearInterval(pollIntervalRef.current);
      }
    }, 1200);
  };

  // Fetch Final Results
  const fetchRunResult = async (runId) => {
    try {
      const res = await axios.get(`http://localhost:2025/api/browser/runs/${runId}/result`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setRunResult(res.data.data);
      }
    } catch (err) {
      setErrorMsg("Failed to retrieve final workflow result.");
    }
  };

  // Stop Run
  const handleStopRun = async () => {
    if (!activeRun?.runId) return;
    try {
      await axios.post(
        `http://localhost:2025/api/browser/runs/${activeRun.runId}/stop`,
        {},
        { withCredentials: true }
      );
      setActiveRun((prev) => (prev ? { ...prev, state: "cancelled", statusText: "Stopped by user" } : null));
    } catch (err) {
      setErrorMsg("Failed to stop run");
    }
  };

  const resetAll = () => {
    clearInterval(pollIntervalRef.current);
    setActiveRun(null);
    setRunResult(null);
    setPreview(null);
    setErrorMsg("");
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="browser-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 10, 15, 0.65)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          width: "92%",
          maxWidth: 680,
          maxHeight: "90vh",
          background: "var(--land-bg, #fff)",
          color: "var(--land-ink, #1f2937)",
          borderRadius: 16,
          border: "1px solid var(--land-rule, #e5e7eb)",
          boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "var(--land-sans, sans-serif)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--land-rule, #e5e7eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🌐</span>
            <div>
              <h2 id="browser-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Controlled Browser Workflows
              </h2>
              <span style={{ fontSize: 11, color: "var(--land-ink-3, #6b7280)" }}>
                Isolated, sandboxed read-only research • Phase 5
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              resetAll();
              onClose();
            }}
            aria-label="Close modal"
            style={{
              background: "transparent",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "var(--land-ink-2, #4b5563)",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {errorMsg && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#dc2626",
                fontSize: 13,
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Workflow Picker & URL input */}
          {!activeRun && (
            <>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Select Workflow Capability
                </label>
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  disabled={isLoadingWorkflows || isPreviewing}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--land-rule, #d1d5db)",
                    background: "var(--land-bg-2, #f9fafb)",
                    color: "inherit",
                    fontSize: 13,
                  }}
                >
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title} ({w.category})
                    </option>
                  ))}
                </select>
                {selectedWorkflow && (
                  <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--land-ink-3, #6b7280)" }}>
                    {selectedWorkflow.description}
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Target Webpage URL
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://en.wikipedia.org/wiki/..."
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--land-rule, #d1d5db)",
                      background: "var(--land-bg-2, #f9fafb)",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  />
                  <button
                    onClick={handleGeneratePreview}
                    disabled={isPreviewing || !targetUrl.trim()}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: "var(--land-accent, #3b82f6)",
                      color: "#fff",
                      border: "none",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      opacity: isPreviewing ? 0.7 : 1,
                    }}
                  >
                    {isPreviewing ? "Checking..." : "Preview Plan"}
                  </button>
                </div>
                {selectedWorkflow && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--land-ink-3, #6b7280)" }}>
                    Approved hostnames:{" "}
                    {selectedWorkflow.allowedDomains.slice(0, 5).join(", ")}
                    {selectedWorkflow.allowedDomains.length > 5 ? "..." : ""}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Workflow Preview Card */}
          {preview && !activeRun && (
            <div
              style={{
                border: "1px solid rgba(59, 130, 246, 0.3)",
                background: "rgba(59, 130, 246, 0.04)",
                borderRadius: 12,
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--land-accent, #2563eb)" }}>
                  Verified Safe Execution Preview
                </span>
                <span style={{ fontSize: 11, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 10 }}>
                  Time Limit: {preview.limits.maxDurationSeconds}s
                </span>
              </div>

              <div style={{ fontSize: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <strong>Target Domain:</strong> <code>{preview.targetDomain}</code>
                </div>
                <div>
                  <strong>Maximum Extracted:</strong> {preview.limits.maxTextChars} chars
                </div>
              </div>

              <div>
                <strong style={{ fontSize: 12 }}>Safety Disclosures:</strong>
                <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 11, color: "var(--land-ink-2, #4b5563)" }}>
                  <li>{preview.disclosure.networkAccess}</li>
                  <li>{preview.disclosure.storage}</li>
                  <li>{preview.disclosure.modelDisclosure}</li>
                </ul>
              </div>

              <div>
                <strong style={{ fontSize: 12 }}>Deterministic Execution Steps:</strong>
                <ol style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 11, color: "var(--land-ink-2, #4b5563)" }}>
                  {preview.estimatedSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => setPreview(null)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "transparent",
                    border: "1px solid var(--land-rule, #d1d5db)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartWorkflow}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    background: "#16a34a",
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ▶ Start Isolated Run
                </button>
              </div>
            </div>
          )}

          {/* Active Run Status & Logs */}
          {activeRun && (
            <div
              style={{
                border: "1px solid var(--land-rule, #e5e7eb)",
                background: "var(--land-bg-2, #f9fafb)",
                borderRadius: 12,
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background:
                        activeRun.state === "completed"
                          ? "#16a34a"
                          : activeRun.state === "cancelled" || activeRun.state === "failed" || activeRun.state === "blocked_by_policy"
                          ? "#dc2626"
                          : "#eab308",
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    Status: {activeRun.state.toUpperCase()}
                  </span>
                </div>
                {["launching", "policy_check", "navigating", "extracting"].includes(activeRun.state) && (
                  <button
                    onClick={handleStopRun}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ⏹ Stop Run
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div style={{ height: 6, background: "rgba(0,0,0,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${activeRun.progress || 10}%`,
                    background: activeRun.state === "failed" ? "#dc2626" : "var(--land-accent, #3b82f6)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>

              <div style={{ fontSize: 12, color: "var(--land-ink-2, #4b5563)" }}>
                {activeRun.statusText}
              </div>

              {/* Terminal-style live log lines */}
              <div
                style={{
                  background: "#18181b",
                  color: "#a1a1aa",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: "monospace",
                  maxHeight: 120,
                  overflowY: "auto",
                }}
              >
                {activeRun.logs?.map((l, i) => (
                  <div key={i} style={{ marginBottom: 3 }}>
                    &gt; {l}
                  </div>
                ))}
              </div>

              {/* Completion Results View */}
              {runResult && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "12px",
                    background: "var(--land-bg, #fff)",
                    border: "1px solid var(--land-rule, #e5e7eb)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>
                      {runResult.result?.title || "Extracted Content"}
                    </strong>
                    <span style={{ fontSize: 11, color: "var(--land-ink-3, #6b7280)" }}>
                      {runResult.result?.charsExtracted} characters
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--land-ink-2, #4b5563)",
                      maxHeight: 150,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      padding: "8px",
                      background: "var(--land-bg-2, #f9fafb)",
                      borderRadius: 6,
                    }}
                  >
                    {runResult.result?.content || "(No text content extracted)"}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--land-ink-3, #6b7280)" }}>
                    Source URL:{" "}
                    <a
                      href={runResult.result?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--land-accent, #3b82f6)", textDecoration: "underline" }}
                    >
                      {runResult.result?.url}
                    </a>
                  </div>
                </div>
              )}

              {["completed", "failed", "cancelled", "blocked_by_policy", "timed_out"].includes(activeRun.state) && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    onClick={resetAll}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      background: "var(--land-accent, #3b82f6)",
                      color: "#fff",
                      border: "none",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Start Another Run
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
