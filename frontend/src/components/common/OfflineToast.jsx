import React, { useState, useEffect } from "react";

// Minimal inline SVGs
const IcoWifiOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const IcoRefresh = ({ spinning }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={spinning ? { animation: "toastSpin 1s linear infinite" } : {}}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IcoClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * OfflineToast
 * Dismissible, debounced toast banner shown when useConnectionStatus reports
 * 'offline' or 'reconnecting' for more than 3.5 seconds.
 */
export function OfflineToast({ status, onRetry }) {
  const isOffline = status === "offline" || status === "reconnecting";
  const [debouncedVisible, setDebouncedVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);

  // Reset state during render when connection status changes
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (!isOffline) {
      setDebouncedVisible(false);
      setDismissed(false);
      setRetrying(false);
    }
  }

  useEffect(() => {
    if (isOffline) {
      const timer = setTimeout(() => {
        setDebouncedVisible(true);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOffline, status]);

  if (!isOffline || !debouncedVisible || dismissed) return null;

  const handleManualRetry = async () => {
    setRetrying(true);
    await onRetry?.();
    setRetrying(false);
  };

  const isReconnecting = status === "reconnecting";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 96,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        width: "92%",
        maxWidth: 440,
        fontFamily: "var(--land-sans)",
      }}
    >
      <div
        style={{
          background: "var(--land-bg)",
          border: "1px solid var(--land-accent)",
          borderRadius: 12,
          padding: "12px 16px",
          boxShadow: "0 8px 30px rgba(26, 25, 22, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              padding: 6,
              borderRadius: 8,
              background: "var(--land-accent-light)",
              color: "var(--land-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IcoWifiOff />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--land-ink)" }}>
              {isReconnecting ? "Reconnecting to server..." : "Server unavailable"}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "var(--land-ink-3)" }}>
              {isReconnecting ? "Checking reachability..." : "Showing cached session data."}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleManualRetry}
            disabled={retrying}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              background: "var(--land-accent)",
              color: "#fff",
              border: "none",
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "var(--land-sans)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              cursor: retrying ? "not-allowed" : "pointer",
              opacity: retrying ? 0.6 : 1,
            }}
            title="Retry connecting now"
          >
            <IcoRefresh spinning={retrying} />
            <span>{retrying ? "Checking..." : "Retry"}</span>
          </button>

          <button
            onClick={() => setDismissed(true)}
            style={{
              padding: 6,
              borderRadius: 6,
              background: "transparent",
              border: "none",
              color: "var(--land-ink-3)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <IcoClose />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes toastSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default OfflineToast;
