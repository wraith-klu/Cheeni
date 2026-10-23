import React, { useState, useEffect, useRef } from "react";

/**
 * ScreenVisionModal — Phase 6: Screen Understanding & Visual Context Grounding
 *
 * Shows a consent disclosure before any screen capture is performed.
 * Provides a question input field, "Capture & Analyze" action, in-flight
 * loading state with cancel option, and clear "Cancel" to abort without
 * any screen data leaving the client.
 *
 * Props:
 *   isOpen          — boolean, controls visibility
 *   defaultQuestion — string, pre-filled from toolbar shortcut
 *   onConfirm(question, abortSignal) — called when user approves; receives AbortSignal
 *   onClose()       — called when user cancels or closes the modal
 */

const IcoCamera = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const IcoShield = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IcoX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export function ScreenVisionModal({ isOpen, defaultQuestion = "", onConfirm, onClose }) {
  const [question, setQuestion] = useState(defaultQuestion);
  const [scanning, setScanning] = useState(false);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuestion(defaultQuestion || "What is on my screen right now?");
      setScanning(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, defaultQuestion]);

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setScanning(false);
    onClose();
  };

  const handleProceed = async () => {
    const trimmed = question.trim();
    if (!trimmed || trimmed.length > 500) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setScanning(true);
    try {
      await onConfirm(trimmed, controller.signal);
    } finally {
      setScanning(false);
      abortRef.current = null;
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter" && !e.shiftKey && !scanning) { e.preventDefault(); handleProceed(); }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="svm-title"
      aria-describedby="svm-disclosure"
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "var(--land-bg, #1a1a2e)",
          border: "1px solid var(--land-rule, rgba(255,255,255,0.1))",
          borderRadius: 16,
          padding: "28px 28px 24px",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          position: "relative",
          fontFamily: "var(--land-sans, Inter, sans-serif)",
        }}
      >
        <button
          id="svm-close-btn"
          onClick={handleCancel}
          aria-label="Cancel screen vision"
          style={{
            position: "absolute", top: 16, right: 16,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--land-ink-3, #888)", padding: 4, borderRadius: 6,
            lineHeight: 0,
          }}
        >
          <IcoX />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{
            width: 48, height: 48, borderRadius: 12,
            background: "rgba(91,79,190,0.15)", border: "1px solid rgba(91,79,190,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#8b7ef8", flexShrink: 0,
          }}>
            <IcoCamera />
          </span>
          <div>
            <h2 id="svm-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--land-ink, #fff)", lineHeight: 1.3 }}>
              Screen Vision
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--land-ink-3, #888)", marginTop: 2 }}>
              Powered by Google Gemini
            </p>
          </div>
        </div>

        <div
          id="svm-disclosure"
          style={{
            background: "rgba(91,79,190,0.08)",
            border: "1px solid rgba(91,79,190,0.25)",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 20,
            fontSize: 13,
            color: "var(--land-ink-2, #ccc)",
            lineHeight: 1.6,
          }}
        >
          <span style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color: "#8b7ef8", flexShrink: 0, marginTop: 1 }}><IcoShield /></span>
            <span>
              Cheeni will capture your <strong style={{ color: "var(--land-ink, #fff)" }}>primary screen</strong> and send it to{" "}
              <strong style={{ color: "var(--land-ink, #fff)" }}>Google Gemini</strong> to answer your question.
              The image is processed ephemerally and <strong style={{ color: "var(--land-ink, #fff)" }}>never saved to disk</strong>.
              <br /><br />
              <span style={{ color: "#f59e0b" }}>Warning: Ensure no passwords, private messages, or sensitive documents are visible on screen before proceeding.</span>
            </span>
          </span>
        </div>

        {!scanning && (
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="svm-question" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--land-ink-2, #ccc)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Your Question
            </label>
            <textarea
              id="svm-question"
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What is the error shown in my terminal?"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "var(--land-bg-2, rgba(255,255,255,0.05))",
                border: "1px solid var(--land-rule, rgba(255,255,255,0.12))",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
                color: "var(--land-ink, #fff)",
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                lineHeight: 1.5,
              }}
            />
            <div style={{ fontSize: 11, color: "var(--land-ink-3, #888)", textAlign: "right", marginTop: 4 }}>
              {question.trim().length} / 500
            </div>
          </div>
        )}

        {scanning && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            padding: "20px 0", marginBottom: 20,
          }}>
            <div style={{ position: "relative", width: 56, height: 56 }}>
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: "3px solid rgba(139,126,248,0.15)",
              }} />
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: "3px solid transparent",
                borderTopColor: "#8b7ef8",
                animation: "svm-spin 0.9s linear infinite",
              }} />
              <div style={{
                position: "absolute", inset: "14px", borderRadius: "50%",
                background: "rgba(91,79,190,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#8b7ef8",
              }}>
                <IcoCamera />
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--land-ink, #fff)" }}>
                Capturing and inspecting screen...
              </div>
              <div style={{ fontSize: 12, color: "var(--land-ink-3, #888)", marginTop: 4 }}>
                Analyzing with Gemini Vision
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            id="svm-cancel-btn"
            onClick={handleCancel}
            style={{
              flex: 1, padding: "11px 16px",
              background: "transparent",
              border: "1px solid var(--land-rule, rgba(255,255,255,0.15))",
              borderRadius: 10, cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              color: "var(--land-ink-2, #ccc)",
              fontFamily: "inherit",
            }}
          >
            {scanning ? "Abort" : "Cancel"}
          </button>
          {!scanning && (
            <button
              id="svm-proceed-btn"
              onClick={handleProceed}
              disabled={!question.trim() || question.trim().length > 500}
              style={{
                flex: 2, padding: "11px 16px",
                background: "linear-gradient(135deg, #5B4FBE, #8b7ef8)",
                border: "none", borderRadius: 10, cursor: "pointer",
                fontSize: 14, fontWeight: 700,
                color: "#fff",
                fontFamily: "inherit",
                opacity: (!question.trim() || question.trim().length > 500) ? 0.45 : 1,
              }}
            >
              Capture and Analyze
            </button>
          )}
        </div>

        <style>{`
          @keyframes svm-spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

export default ScreenVisionModal;
