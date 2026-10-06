import React from "react";
import { useTheme } from "../../context/ThemeContext";

/*
 * Top navigation bar for the agent dashboard.
 * Design: warm off-white bg, dark ink text, single clay accent.
 * No Lucide icons, no glassmorphism, no gradient text.
 */

/* ── SVG icons ─────────────────────────────────────────────────────────── */
const IcoActivity = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IcoChat = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IcoVolume = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);
const IcoVolumeMute = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
);
const IcoSettings = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IcoDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v13M5 14l7 7 7-7"/><path d="M3 21h18"/>
  </svg>
);
const IcoMinimize = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
    <line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/>
  </svg>
);
const IcoLogOut = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IcoTarget = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const IcoBarChart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

const IcoPuzzle = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.5 14.99l-4.5 4.5M9 5H5a2 2 0 0 0-2 2v4M9 5a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4z"/>
    <path d="M15 5h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
    <path d="M5 15h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"/>
  </svg>
);

const IcoSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IcoMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/* ── Shared button styles ───────────────────────────────────────────────── */
const iconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 34, height: 34, borderRadius: 8,
  border: "1px solid var(--land-rule)", background: "transparent",
  color: "var(--land-ink-2)", cursor: "pointer",
};

/* ── Status dot colour → readable ink colour (no neon) ─────────────────── */
function StatusLabel({ isListening, isThinking, isStreaming, isSpeaking }) {
  if (isListening)  return <span style={{ color: "#C0392B", fontSize: 12, fontWeight: 500 }}>Listening</span>;
  if (isThinking)   return <span style={{ color: "#A0580C", fontSize: 12, fontWeight: 500 }}>Thinking</span>;
  if (isStreaming)  return <span style={{ color: "#5B4FBE", fontSize: 12, fontWeight: 500 }}>Responding</span>;
  if (isSpeaking)   return <span style={{ color: "#2A7A3B", fontSize: 12, fontWeight: 500 }}>Speaking</span>;
  return <span style={{ fontSize: 12, color: "var(--land-ink-3)" }}>Ready</span>;
}

/* 3 Clear Agent States: Connecting (Spinner) | Connected (Green) | Disconnected (Orange + Guide link) (#22) */
function AgentStatusIndicator({ isAgentConnected }) {
  if (isAgentConnected === null) {
    return (
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--land-ink-3)" }}
        title="Connecting to local desktop agent service on port 2026..."
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%",
            border: "1.5px solid var(--land-accent)",
            borderTopColor: "transparent",
            display: "inline-block",
            animation: "navSpin 0.8s linear infinite",
          }}
        />
        <span>Agent Connecting...</span>
      </span>
    );
  }

  if (isAgentConnected === true) {
    return (
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#2A7A3B", fontWeight: 500 }}
        title="Desktop Agent active on http://localhost:2026 (OS actions & telemetry online)"
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2A7A3B", display: "inline-block" }} />
        <span>Agent Connected</span>
      </span>
    );
  }

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#d97706" }}
      title="Desktop Agent offline. Run start_cheeni.bat or check docs."
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706", display: "inline-block" }} />
      <span>Agent Disconnected</span>
      <a
        href="http://localhost:2026/docs"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--land-accent)", textDecoration: "underline", marginLeft: 2 }}
        title="View Desktop Agent setup guide & API docs"
      >
        Guide
      </a>
    </span>
  );
}

function HealthDot({ ok, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--land-ink-3)" }} title={label}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? "#2A7A3B" : "#bbb", display: "inline-block" }} />
      {label}
    </span>
  );
}

export function Navbar({
  assistantName,
  assistantAvatar,
  status,
  currentTime,
  currentDate,
  isAgentConnected,
  isMuted,
  isTelemetryOpen,
  onToggleTelemetry,
  onOpenChat,
  chatCount = 0,
  onOpenInterviewPrep,
  onOpenAnalytics,
  onOpenPlugins,
  onToggleMute,
  onOpenSettings,
  onNavigateLanding,
  onToggleCornerMode,
  onLogout,
  isListening,
  isThinking,
  isStreaming,
  isSpeaking,
}) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "var(--land-bg)",
      borderBottom: "1px solid var(--land-rule)",
      padding: "0 24px", height: 60,
      display: "flex", alignItems: "center",
    }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

        {/* Left: identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <img
              src={assistantAvatar}
              alt={assistantName}
              style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", border: "2px solid var(--land-accent)", display: "block" }}
            />
            <span style={{
              position: "absolute", bottom: -1, right: -1,
              width: 10, height: 10, borderRadius: "50%",
              background: isAgentConnected ? "#2A7A3B" : "#bbb",
              border: "2px solid var(--land-bg)",
            }} />
          </div>

          <div>
            <p style={{ fontFamily: "var(--land-sans)", fontSize: 14, fontWeight: 700, color: "var(--land-ink)", margin: 0, lineHeight: 1.2 }}>
              {assistantName}
            </p>
            <StatusLabel isListening={isListening} isThinking={isThinking} isStreaming={isStreaming} isSpeaking={isSpeaking} />
          </div>
        </div>

        {/* Centre: clock + health (hidden on mobile phones to prevent header crunch) */}
        <div className="hidden sm:flex" style={{ flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontFamily: "var(--land-sans)", fontSize: 13, fontWeight: 600, color: "var(--land-ink)" }}>
            {currentTime} <span style={{ fontWeight: 400, color: "var(--land-ink-3)" }}>{currentDate}</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AgentStatusIndicator isAgentConnected={isAgentConnected} />
            <HealthDot ok={true}              label="Backend" />
            <HealthDot ok={!isMuted}          label="Voice" />
            <HealthDot ok={true}              label="Gemini" />
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Dark / Light Theme Toggle (#21) */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Switch to warm light theme" : "Switch to dark studio theme"}
            style={{
              ...iconBtn,
              background: isDark ? "rgba(255, 255, 255, 0.06)" : "var(--land-bg-2)",
              color: isDark ? "#fbbf24" : "var(--land-ink)",
            }}
            aria-label="Toggle Dark and Light theme"
          >
            {isDark ? <IcoSun /> : <IcoMoon />}
          </button>

          {isAgentConnected && (
            <button
              onClick={onToggleTelemetry}
              title="Toggle system telemetry"
              style={{ ...iconBtn, ...(isTelemetryOpen ? { background: "var(--land-accent-light)", borderColor: "var(--land-accent)", color: "var(--land-accent)" } : {}) }}
              className="hidden md:flex"
            >
              <IcoActivity />
            </button>
          )}

          {/* Interview Prep Studio Dedicated Launcher (#17) */}
          <button
            onClick={onOpenInterviewPrep}
            title="Interview Prep Studio (Flash Cards, Timer & Roadmap)"
            style={{
              ...iconBtn,
              display: "flex",
              gap: 6,
              padding: "0 10px",
              width: "auto",
              background: "var(--land-accent-light)",
              borderColor: "var(--land-accent)",
              color: "var(--land-accent)",
            }}
            id="nav-interview-prep"
          >
            <IcoTarget />
            <span className="hidden sm:inline" style={{ fontSize: 13, fontWeight: 600 }}>Prep</span>
          </button>

          <button onClick={onOpenChat} title="Notes and chat" style={{ ...iconBtn, display: "flex", gap: 6, padding: "0 10px", width: "auto" }} id="nav-chat">
            <IcoChat />
            <span className="hidden sm:inline" style={{ fontSize: 13, fontWeight: 500 }}>Chat</span>
            {chatCount > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9, padding: "0 5px",
                background: "var(--land-accent)", color: "#fff",
                fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {chatCount > 9 ? "9+" : chatCount}
              </span>
            )}
          </button>

          <button onClick={onToggleMute} title={isMuted ? "Unmute voice" : "Mute voice"} style={{ ...iconBtn, ...(isMuted ? { color: "#C0392B", borderColor: "rgba(192,57,43,0.4)" } : {}) }}>
            {isMuted ? <IcoVolumeMute /> : <IcoVolume />}
          </button>

          <button onClick={onOpenSettings} title="Settings" style={iconBtn}><IcoSettings /></button>
          <button onClick={onNavigateLanding} title="Landing page and downloads" style={iconBtn} className="hidden sm:flex"><IcoDownload /></button>

          {/* Analytics Dashboard (#26) */}
          <button
            onClick={onOpenAnalytics}
            title="Usage Analytics (messages, topics, voice time)"
            style={iconBtn}
            id="nav-analytics"
            className="hidden md:flex"
          >
            <IcoBarChart />
          </button>

          {/* Plugin / Skill Manager (#25) */}
          <button
            onClick={onOpenPlugins}
            title="Skills & Plugin Manager"
            style={iconBtn}
            id="nav-plugins"
            className="hidden md:flex"
          >
            <IcoPuzzle />
          </button>

          <button onClick={onToggleCornerMode} title="Switch to corner widget"
            style={{ ...iconBtn, display: "flex", gap: 5, padding: "0 10px", width: "auto" }}
            className="hidden lg:flex"
          >
            <IcoMinimize />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Widget</span>
          </button>

          <button onClick={onLogout} title="Sign out"
            style={{ ...iconBtn, color: "#C0392B", borderColor: "rgba(192,57,43,0.35)" }}>
            <IcoLogOut />
          </button>
        </div>
      </div>
      <style>{`@keyframes navSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}

export default Navbar;
