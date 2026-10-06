import React from "react";

// Minimal inline SVGs
const IcoCpu = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
  </svg>
);

const IcoRam = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const IcoBattery = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="16" height="10" rx="2" />
    <line x1="22" y1="11" x2="22" y2="13" />
    <line x1="6" y1="11" x2="6" y2="13" />
    <line x1="10" y1="11" x2="10" y2="13" />
  </svg>
);

const IcoSliders = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const IcoLock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IcoVolumeMute = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const IcoDesktop = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const IcoNote = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

/**
 * Real-time OS telemetry status strip displaying CPU, RAM, battery,
 * master volume slider, and agent quick actions.
 */
export function StatusBar({
  isOpen,
  isAgentConnected,
  telemetry,
  onVolumeChange,
  onQuickAction,
}) {
  if (!isAgentConnected || !isOpen) return null;

  const quickActionBtnStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontFamily: "var(--land-sans)",
    color: "var(--land-ink-2)",
    background: "var(--land-bg)",
    border: "1px solid var(--land-rule)",
    cursor: "pointer",
    transition: "border-color 0.15s, color 0.15s, background-color 0.15s",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 860,
        margin: "10px auto 0",
        padding: "0 16px",
        fontFamily: "var(--land-sans)",
      }}
    >
      {/* Telemetry card */}
      <div
        style={{
          background: "var(--land-bg)",
          border: "1px solid var(--land-rule)",
          borderRadius: 12,
          padding: "12px 18px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          boxShadow: "0 2px 8px rgba(26, 25, 22, 0.04)",
        }}
      >
        {/* CPU Metric */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 150px" }}>
          <div
            style={{
              padding: 7,
              borderRadius: 8,
              background: "var(--land-bg-2)",
              color: "var(--land-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IcoCpu />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "var(--land-ink-3)" }}>CPU Load</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--land-ink)" }}>
                {telemetry.cpu !== null ? `${telemetry.cpu}%` : "--"}
              </span>
            </div>
            <div style={{ width: "100%", height: 4, borderRadius: 2, background: "var(--land-bg-2)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, telemetry.cpu || 0)}%`,
                  background: "var(--land-accent)",
                  borderRadius: 2,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* RAM Metric */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 150px" }}>
          <div
            style={{
              padding: 7,
              borderRadius: 8,
              background: "var(--land-bg-2)",
              color: "var(--land-ink-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IcoRam />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "var(--land-ink-3)" }}>RAM Usage</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--land-ink)" }}>
                {telemetry.ram !== null ? `${telemetry.ram}%` : "--"}
              </span>
            </div>
            <div style={{ width: "100%", height: 4, borderRadius: 2, background: "var(--land-bg-2)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, telemetry.ram || 0)}%`,
                  background: "var(--land-ink-2)",
                  borderRadius: 2,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* Battery Metric */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 150px" }}>
          <div
            style={{
              padding: 7,
              borderRadius: 8,
              background: "var(--land-bg-2)",
              color: "var(--land-ink-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IcoBattery />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "var(--land-ink-3)" }}>Battery</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--land-ink)" }}>
                {telemetry.battery !== null ? `${telemetry.battery}%` : "--"}
              </span>
            </div>
            <div style={{ width: "100%", height: 4, borderRadius: 2, background: "var(--land-bg-2)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, telemetry.battery || 0)}%`,
                  background: "var(--land-accent)",
                  borderRadius: 2,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* Master Volume Controller */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: "1 1 180px",
            paddingLeft: 12,
            borderLeft: "1px solid var(--land-rule)",
          }}
        >
          <div
            style={{
              padding: 7,
              borderRadius: 8,
              background: "var(--land-bg-2)",
              color: "var(--land-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IcoSliders />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "var(--land-ink-3)" }}>Master Volume</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--land-ink)" }}>
                {telemetry.volume !== null ? `${telemetry.volume}%` : "--"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={telemetry.volume || 50}
              onChange={(e) => onVolumeChange(e.target.value)}
              style={{
                width: "100%",
                accentColor: "var(--land-accent)",
                cursor: "pointer",
                height: 4,
              }}
              aria-label="Master volume slider"
            />
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 10,
        }}
      >
        <button
          onClick={() => onQuickAction("/api/agent/system/lock")}
          style={quickActionBtnStyle}
          title="Lock PC"
        >
          <IcoLock />
          <span>Lock PC</span>
        </button>
        <button
          onClick={() => onQuickAction("/api/agent/volume/mute")}
          style={quickActionBtnStyle}
          title="Mute Audio"
        >
          <IcoVolumeMute />
          <span>Mute Audio</span>
        </button>
        <button
          onClick={() => onQuickAction("/api/agent/windows/desktop")}
          style={quickActionBtnStyle}
          title="Show Desktop"
        >
          <IcoDesktop />
          <span>Show Desktop</span>
        </button>
        <button
          onClick={() => onQuickAction("/api/agent/launch", { app: "notepad" })}
          style={quickActionBtnStyle}
          title="Open Notepad"
        >
          <IcoNote />
          <span>Open Notepad</span>
        </button>
      </div>
    </div>
  );
}

export default StatusBar;
