import React from "react";

/*
 * Bottom mic + text input dock for the agent dashboard.
 * Design: warm bg, ink text, single accent mic button.
 * No Lucide, no neon, no pill-with-gradient.
 */

const IcoMic = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3"/>
    <path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6"/>
  </svg>
);
const IcoMicOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 10v-1m14 0v1a7 7 0 0 1-.11 1.23M12 19v3M9 22h6"/>
  </svg>
);
const IcoSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IcoLoader = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }} aria-hidden="true">
    <line x1="12" y1="2" x2="12" y2="6"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/>
    <line x1="18" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
  </svg>
);

export function MicInputBar({
  assistantName = "Cheeni",
  isListening   = false,
  isThinking    = false,
  isStreaming   = false,
  onToggleListening,
  onSendPrompt,
}) {
  const [text, setText] = React.useState("");
  const isBusy = isThinking || isStreaming;

  const submit = (e) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q || isBusy) return;
    onSendPrompt(q);
    setText("");
  };

  return (
    <footer
      className="px-3 py-3 sm:px-6 sm:py-4"
      style={{
        position: "sticky", bottom: 0, zIndex: 20,
        background: "var(--land-bg)",
        borderTop: "1px solid var(--land-rule)",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}
    >
      <div className="hidden sm:flex items-center gap-3 mb-2 flex-wrap justify-center">
        <p style={{ fontFamily: "var(--land-sans)", fontSize: 11, color: "var(--land-ink-3)", margin: 0 }}>
          <kbd style={{ fontSize: 10, fontFamily: "monospace", padding: "1px 5px", border: "1px solid var(--land-rule)", borderRadius: 4, background: "var(--land-bg-2)" }}>Enter</kbd> to send
        </p>
        <span style={{ fontSize: 10, color: "var(--land-rule)" }}>•</span>
        <p style={{ fontFamily: "var(--land-sans)", fontSize: 11, color: "var(--land-ink-3)", margin: 0 }}>
          <kbd style={{ fontSize: 10, fontFamily: "monospace", padding: "1px 5px", border: "1px solid var(--land-rule)", borderRadius: 4, background: "var(--land-bg-2)" }}>Ctrl+K</kbd> focus
        </p>
        <span style={{ fontSize: 10, color: "var(--land-rule)" }}>•</span>
        <p style={{ fontFamily: "var(--land-sans)", fontSize: 11, color: "var(--land-ink-3)", margin: 0 }}>
          <kbd style={{ fontSize: 10, fontFamily: "monospace", padding: "1px 5px", border: "1px solid var(--land-rule)", borderRadius: 4, background: "var(--land-bg-2)" }}>Space</kbd> / <kbd style={{ fontSize: 10, fontFamily: "monospace", padding: "1px 5px", border: "1px solid var(--land-rule)", borderRadius: 4, background: "var(--land-bg-2)" }}>Alt+M</kbd> mic
        </p>
        <span style={{ fontSize: 10, color: "var(--land-rule)" }}>•</span>
        <p style={{ fontFamily: "var(--land-sans)", fontSize: 11, color: "var(--land-ink-3)", margin: 0 }}>
          <kbd style={{ fontSize: 10, fontFamily: "monospace", padding: "1px 5px", border: "1px solid var(--land-rule)", borderRadius: 4, background: "var(--land-bg-2)" }}>Esc</kbd> stop
        </p>
      </div>

      <div style={{
        width: "100%", maxWidth: 640,
        display: "flex", alignItems: "center", gap: 10,
        border: "1px solid var(--land-rule)",
        borderRadius: 10, background: "var(--land-bg-2)",
        padding: "6px 6px 6px 10px",
      }}>
        {/* Mic button */}
        <button
          onClick={onToggleListening}
          title={isListening ? "Stop listening" : "Speak"}
          disabled={isBusy}
          style={{
            flexShrink: 0,
            width: 40, height: 40, borderRadius: 8,
            border: "none",
            background: isListening ? "#C0392B" : "var(--land-accent)",
            color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: isBusy ? "not-allowed" : "pointer",
            opacity: isBusy ? 0.5 : 1,
            transition: "background 0.2s",
          }}
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {isListening ? <IcoMicOff /> : <IcoMic />}
        </button>

        {/* Input */}
        <form onSubmit={submit} style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <input
            id="cheeni-main-input"
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            disabled={isListening}
            placeholder={
              isListening ? "Listening — speak now" :
              isBusy      ? `${assistantName} is thinking…` :
                            `Ask ${assistantName} anything (Ctrl+K)`
            }
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: "var(--land-sans)", fontSize: 14, color: "var(--land-ink)",
              padding: "0 4px",
            }}
            aria-label="Message input"
          />
        </form>

        {/* Send button */}
        <button
          onClick={submit}
          disabled={!text.trim() || isBusy}
          title="Send"
          style={{
            flexShrink: 0,
            width: 38, height: 38, borderRadius: 7,
            background: text.trim() && !isBusy ? "var(--land-accent)" : "var(--land-bg)",
            color: text.trim() && !isBusy ? "#fff" : "var(--land-ink-3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: !text.trim() || isBusy ? "not-allowed" : "pointer",
            opacity: !text.trim() || isBusy ? 0.4 : 1,
            border: "1px solid var(--land-rule)",
          }}
          aria-label="Send message"
        >
          {isBusy ? <IcoLoader /> : <IcoSend />}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </footer>
  );
}

export default MicInputBar;
