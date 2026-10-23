import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/api";

/* ── SVG icons ──────────────────────────────────────────────────────────── */
const IcoCalendar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IcoMail = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IcoGithub = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
  </svg>
);
const IcoX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IcoCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IcoLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const IcoUnlink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    <line x1="4" y1="4" x2="20" y2="20"/>
  </svg>
);
const IcoShield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IcoLoader = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ animation: "intSpin 0.8s linear infinite" }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

const ICON_MAP = { calendar: <IcoCalendar />, mail: <IcoMail />, github: <IcoGithub /> };

const STATUS_CONFIG = {
  connected:    { label: "Connected",    color: "#2A7A3B", bg: "rgba(42,122,59,0.10)", dot: "#2A7A3B" },
  disconnected: { label: "Available",    color: "#A0580C", bg: "rgba(160,88,12,0.08)", dot: "#d97706" },
  planned:      { label: "Coming Soon",  color: "#6B6B8A", bg: "rgba(107,107,138,0.08)", dot: "#bbb" },
};

function DisconnectConfirm({ name, onConfirm, onCancel, isLoading }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--land-bg)", border: "1px solid var(--land-rule)",
        borderRadius: 14, padding: "28px 28px 24px",
        maxWidth: 380, width: "90%",
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      }}>
        <p style={{ fontFamily: "var(--land-sans)", fontSize: 15, fontWeight: 700, color: "var(--land-ink)", margin: "0 0 8px" }}>
          Disconnect {name}?
        </p>
        <p style={{ fontFamily: "var(--land-sans)", fontSize: 13, color: "var(--land-ink-2)", margin: "0 0 22px", lineHeight: 1.6 }}>
          This will revoke Cheeni's access and delete your stored credentials. Cheeni will no longer be able to read your calendar until you reconnect.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={isLoading} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--land-rule)", background: "transparent", color: "var(--land-ink-2)", fontFamily: "var(--land-sans)", fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isLoading} id="confirm-disconnect-btn"
            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(192,57,43,0.4)", background: "rgba(192,57,43,0.08)", color: "#C0392B", fontFamily: "var(--land-sans)", fontSize: 13, cursor: isLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            {isLoading ? <IcoLoader /> : <IcoUnlink />}
            {isLoading ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({ integration, onDisconnect, isActionLoading }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[integration.status] || STATUS_CONFIG.planned;
  const icon = ICON_MAP[integration.icon] || <IcoCalendar />;
  const op = integration.operations?.[0];
  const isConnected    = integration.status === "connected";
  const isDisconnected = integration.status === "disconnected";

  return (
    <div style={{
      border: `1px solid ${isConnected ? "rgba(42,122,59,0.25)" : "var(--land-rule)"}`,
      borderRadius: 12,
      background: isConnected ? "rgba(42,122,59,0.04)" : "var(--land-bg-2, var(--land-bg))",
      padding: "18px 20px",
      transition: "border-color 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: isConnected ? "rgba(42,122,59,0.10)" : "var(--land-bg)", border: "1px solid var(--land-rule)", display: "flex", alignItems: "center", justifyContent: "center", color: isConnected ? "#2A7A3B" : "var(--land-ink-2)" }}>
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <p style={{ fontFamily: "var(--land-sans)", fontSize: 14, fontWeight: 700, color: "var(--land-ink)", margin: 0 }}>
              {integration.name}
            </p>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
              {cfg.label}
            </span>
          </div>
          <p style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)", margin: 0, lineHeight: 1.45 }}>
            {integration.description}
          </p>
        </div>

        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          {isConnected && (
            <button id={`disconnect-${integration.id}`} onClick={() => onDisconnect(integration)} disabled={isActionLoading} title={`Disconnect ${integration.name}`}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid rgba(192,57,43,0.35)", background: "rgba(192,57,43,0.06)", color: "#C0392B", cursor: isActionLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--land-sans)" }}>
              <IcoUnlink /> Disconnect
            </button>
          )}
          {isDisconnected && (
            <a id={`connect-${integration.id}`} href={`http://localhost:2025/api/integrations/${integration.id}/connect`} title={`Connect ${integration.name}`}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--land-accent, #8B5CF6)", background: "var(--land-accent-light, rgba(139,92,246,0.07))", color: "var(--land-accent, #8B5CF6)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--land-sans)", textDecoration: "none" }}>
              <IcoLink /> Connect
            </a>
          )}
          {integration.status === "planned" && (
            <span style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--land-rule)", color: "var(--land-ink-3)", fontFamily: "var(--land-sans)", display: "inline-block" }}>
              Coming Soon
            </span>
          )}
        </div>
      </div>

      {op && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setExpanded((v) => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--land-ink-3)", fontFamily: "var(--land-sans)", fontSize: 12, padding: 0 }}>
            <IcoShield />
            {expanded ? "Hide" : "View"} data-sharing details
            <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 2 }}>{expanded ? "▲" : "▼"}</span>
          </button>

          {expanded && (
            <div style={{ marginTop: 12, padding: "14px 16px", background: "var(--land-bg)", border: "1px solid var(--land-rule)", borderRadius: 8, fontSize: 12, fontFamily: "var(--land-sans)", color: "var(--land-ink-2)", lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--land-ink)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Operation: {op.label || op.id}
              </p>

              {op.scopes?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 11 }}>OAuth scopes requested:</p>
                  {op.scopes.map((scope) => (
                    <div key={scope} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 2 }}>
                      <span style={{ color: "#2A7A3B", marginTop: 1, flexShrink: 0 }}><IcoCheck /></span>
                      <code style={{ fontSize: 11, wordBreak: "break-all", color: "var(--land-accent, #8B5CF6)" }}>{scope}</code>
                    </div>
                  ))}
                </div>
              )}

              {op.dataSent?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 11 }}>Data sent to provider:</p>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {op.dataSent.map((d, i) => <li key={i} style={{ marginBottom: 2 }}>{d}</li>)}
                  </ul>
                </div>
              )}

              {op.dataReceived?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 11 }}>Data received by Cheeni:</p>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {op.dataReceived.map((d, i) => <li key={i} style={{ marginBottom: 2 }}>{d}</li>)}
                  </ul>
                </div>
              )}

              <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--land-ink-3)" }}>
                <strong>Token storage:</strong> {integration.credentialStorage}
              </p>
              {op.confirmationRequired && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#A0580C" }}>
                  ⚠ Write operations require your explicit review before saving.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Toast({ message, type = "success", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 24, zIndex: 10000,
      padding: "12px 20px", borderRadius: 10, maxWidth: 360,
      background: type === "success" ? "rgba(42,122,59,0.95)" : "rgba(192,57,43,0.95)",
      color: "#fff", fontFamily: "var(--land-sans)", fontSize: 13, fontWeight: 500,
      boxShadow: "0 4px 20px rgba(0,0,0,0.20)",
      animation: "intFadeUp 0.25s ease",
    }}>
      {message}
    </div>
  );
}

export default function IntegrationsPanel({ isOpen, onClose }) {
  const [integrations, setIntegrations] = useState([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [toast, setToast]               = useState(null);

  const connectedCount = integrations.filter((i) => i.status === "connected").length;

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/api/integrations");
      if (res.data?.success) {
        setIntegrations(res.data.integrations || []);
      } else {
        setError("Could not load integration catalog.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load integrations.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchIntegrations();
  }, [isOpen, fetchIntegrations]);

  // Handle OAuth callback query params — show toast then clean URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integration");
    const status      = params.get("status");
    const reason      = params.get("reason");
    if (!integration || !status) return;

    if (status === "connected") {
      setToast({ message: `✓ ${integration.replace(/_/g, " ")} connected successfully!`, type: "success" });
      fetchIntegrations();
    } else if (status === "error") {
      setToast({ message: `Connection failed: ${decodeURIComponent(reason || "unknown error")}`, type: "error" });
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [fetchIntegrations]);

  const handleDisconnectRequest = (integration) => setConfirmTarget(integration);
  const handleDisconnectCancel  = () => { if (!actionLoading) setConfirmTarget(null); };

  const handleDisconnectConfirm = async () => {
    if (!confirmTarget) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/api/integrations/${confirmTarget.id}/disconnect`);
      setToast({ message: `${confirmTarget.name} disconnected.`, type: "success" });
      await fetchIntegrations();
    } catch (err) {
      setToast({ message: err.response?.data?.message || "Failed to disconnect.", type: "error" });
    } finally {
      setActionLoading(false);
      setConfirmTarget(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes intSlideIn { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        @keyframes intFadeUp  { from { transform: translateY(12px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes intSpin    { to { transform: rotate(360deg); } }
      `}</style>

      {/* Backdrop */}
      <div onClick={onClose} aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.35)" }}
      />

      {/* Drawer */}
      <div id="integrations-panel" role="dialog" aria-label="Connected Services"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(480px, 96vw)", zIndex: 1101,
          background: "var(--land-bg)", borderLeft: "1px solid var(--land-rule)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
          display: "flex", flexDirection: "column",
          animation: "intSlideIn 0.28s ease",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "18px 22px 16px",
          background: "var(--land-bg)", borderBottom: "1px solid var(--land-rule)",
        }}>
          <div>
            <p style={{ fontFamily: "var(--land-sans)", fontSize: 16, fontWeight: 700, color: "var(--land-ink)", margin: 0 }}>
              Connected Services
            </p>
            <p style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)", margin: "2px 0 0" }}>
              Opt-in · least-privilege · revocable
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {connectedCount > 0 && (
              <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(42,122,59,0.10)", color: "#2A7A3B", fontFamily: "var(--land-sans)" }}>
                {connectedCount} connected
              </span>
            )}
            <button onClick={onClose} id="close-integrations-panel" aria-label="Close integrations panel"
              style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--land-rule)", background: "transparent", color: "var(--land-ink-2)", cursor: "pointer" }}>
              <IcoX />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "11px 14px", borderRadius: 9, background: "rgba(107,107,138,0.07)", border: "1px solid rgba(107,107,138,0.15)", fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-2)", lineHeight: 1.6 }}>
            <strong>Privacy:</strong> Cheeni never stores passwords. Credentials are AES-256-GCM encrypted in your database record and are never sent to the AI model or shown in logs. Tokens are never sent to your browser.
          </div>

          {isLoading && (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", color: "var(--land-ink-3)" }}>
              <IcoLoader />
            </div>
          )}

          {!isLoading && error && (
            <div style={{ padding: "12px 16px", borderRadius: 9, background: "rgba(192,57,43,0.07)", border: "1px solid rgba(192,57,43,0.2)", color: "#C0392B", fontFamily: "var(--land-sans)", fontSize: 13 }}>
              {error}
              <button onClick={fetchIntegrations} style={{ marginLeft: 10, fontSize: 12, color: "#C0392B", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onDisconnect={handleDisconnectRequest}
              isActionLoading={actionLoading}
            />
          ))}

          {connectedCount > 0 && (
            <p style={{ fontFamily: "var(--land-sans)", fontSize: 11, color: "var(--land-ink-3)", lineHeight: 1.5, marginTop: 6 }}>
              To fully revoke access at the provider: visit <strong>Google Account Permissions</strong> or <strong>GitHub → Settings → Applications</strong>.
            </p>
          )}
        </div>
      </div>

      {confirmTarget && (
        <DisconnectConfirm
          name={confirmTarget.name}
          onConfirm={handleDisconnectConfirm}
          onCancel={handleDisconnectCancel}
          isLoading={actionLoading}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </>
  );
}

/**
 * useIntegrationCount — fetches connected integration count, refreshes on tab visibility change.
 * Used by Navbar to show the badge.
 */
export function useIntegrationCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      apiClient.get("/api/integrations")
        .then((res) => {
          if (res.data?.integrations) {
            setCount(res.data.integrations.filter((i) => i.status === "connected").length);
          }
        })
        .catch(() => {});
    };
    refresh();
    const onVisibility = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return count;
}
