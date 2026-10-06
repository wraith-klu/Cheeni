import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/*
 * Analytics Dashboard (#26)
 * Shows usage stats stored in localStorage:
 *   - Total conversations
 *   - Most asked topics (category breakdown)
 *   - Daily action counts for the past 7 days (bar chart)
 *   - TTS voice time estimate
 *   - Keyboard shortcut summary
 */

// -- Utility: analytics store ------------------------------------------------

const STORE_KEY = "cheeni_analytics_v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore();
    return { ...defaultStore(), ...JSON.parse(raw) };
  } catch {
    return defaultStore();
  }
}

function defaultStore() {
  return {
    totalMessages: 0,
    totalTTSSeconds: 0,
    topicCounts: {},
    dailyCounts: {},
    actionCounts: {},
    sessionsStarted: 0,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
}

export function recordAnalyticsEvent(type, payload = {}) {
  try {
    const store = loadStore();
    const today = new Date().toISOString().split("T")[0];

    if (type === "message") {
      store.totalMessages = (store.totalMessages || 0) + 1;
      store.dailyCounts[today] = (store.dailyCounts[today] || 0) + 1;
      const text = (payload.text || "").toLowerCase();
      const topicMap = {
        DSA: ["array", "tree", "graph", "sort", "binary", "heap", "stack", "queue", "linked list", "algorithm", "dp", "dynamic programming", "recursion"],
        "System Design": ["database", "cache", "load balancer", "microservice", "api", "scalability", "architecture", "cdn", "kafka", "redis", "sql", "nosql"],
        Behavioural: ["tell me about yourself", "weakness", "strength", "conflict", "teamwork", "leadership", "challenge", "failure", "success", "goal"],
        Coding: ["python", "javascript", "java", "code", "function", "debug", "error", "bug", "class", "object", "react", "node"],
        System: ["battery", "volume", "cpu", "ram", "disk", "launch", "open", "close", "window", "snap"],
        General: ["what", "how", "why", "explain", "help", "summarize"],
      };
      for (const [topic, keywords] of Object.entries(topicMap)) {
        if (keywords.some((kw) => text.includes(kw))) {
          store.topicCounts[topic] = (store.topicCounts[topic] || 0) + 1;
          break;
        }
      }
    } else if (type === "tts") {
      store.totalTTSSeconds = (store.totalTTSSeconds || 0) + (payload.seconds || 0);
    } else if (type === "action") {
      const at = payload.actionType || "unknown";
      store.actionCounts[at] = (store.actionCounts[at] || 0) + 1;
    } else if (type === "session") {
      store.sessionsStarted = (store.sessionsStarted || 0) + 1;
    }

    store.lastSeen = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* non-critical */
  }
}

// -- SVG icons ----------------------------------------------------------------

const IcoX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IcoTrend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const IcoMsg = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IcoVolume = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
);
const IcoKeyboard = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
  </svg>
);
const IcoActivity = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IcoReset = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.36"/>
  </svg>
);

// -- Sub-components ------------------------------------------------------------

function StatCard({ icon: Icon, value, label, accentColor }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--land-bg-2)", border: "1px solid var(--land-rule)",
        borderRadius: 12, padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 6, minWidth: 0,
      }}
    >
      <span style={{ color: accentColor }}><Icon /></span>
      <span style={{ fontFamily: "var(--land-sans)", fontSize: 26, fontWeight: 700, color: "var(--land-ink)", lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)" }}>{label}</span>
    </motion.div>
  );
}

function WeeklyBarChart({ dailyCounts }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push({ key, label: d.toLocaleDateString("en-US", { weekday: "short" }), count: dailyCounts[key] || 0 });
  }
  const maxCount = Math.max(...days.map((d) => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80, width: "100%" }}>
      {days.map(({ key, label, count }) => (
        <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${Math.max((count / maxCount) * 60, count > 0 ? 6 : 0)}px` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            title={`${count} messages`}
            style={{
              width: "100%",
              background: count > 0 ? "var(--land-accent)" : "var(--land-rule)",
              borderRadius: 4, minHeight: count > 0 ? 6 : 2, maxHeight: 60,
            }}
          />
          <span style={{ fontFamily: "var(--land-sans)", fontSize: 10, color: "var(--land-ink-3)" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function TopicBar({ topic, count, total, accentColor }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--land-sans)", fontSize: 12, fontWeight: 500, color: "var(--land-ink-2)" }}>{topic}</span>
        <span style={{ fontFamily: "var(--land-sans)", fontSize: 11, color: "var(--land-ink-3)" }}>{count} ({pct}%)</span>
      </div>
      <div style={{ height: 6, background: "var(--land-rule)", borderRadius: 3, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{ height: "100%", background: accentColor, borderRadius: 3 }}
        />
      </div>
    </div>
  );
}

const SHORTCUTS = [
  { keys: ["Space"],            action: "Toggle microphone (when not typing)" },
  { keys: ["Alt", "M"],         action: "Toggle microphone (anywhere)" },
  { keys: ["Escape"],           action: "Stop TTS / close modals" },
  { keys: ["Ctrl", "K"],        action: "Focus text input" },
  { keys: ["Ctrl", "Shift", "H"], action: "Open chat history drawer" },
];

function ShortcutRow({ keys, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--land-rule)" }}>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {keys.map((k, i) => (
          <kbd key={i} style={{
            fontFamily: "monospace", fontSize: 11, fontWeight: 600,
            background: "var(--land-bg-2)", border: "1px solid var(--land-rule)",
            borderBottom: "2px solid var(--land-rule)",
            borderRadius: 5, padding: "2px 7px", color: "var(--land-ink-2)", display: "inline-block",
          }}>{k}</kbd>
        ))}
      </div>
      <span style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)" }}>{action}</span>
    </div>
  );
}

// -- Main Component -------------------------------------------------------------

const TOPIC_COLORS = ["#B5642A", "#5B4FBE", "#2A7A3B", "#C0392B", "#0891b2", "#7c3aed"];
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "topics",   label: "Topics" },
  { id: "activity", label: "Activity" },
  { id: "shortcuts",label: "Shortcuts" },
];

export function AnalyticsDashboard({ isOpen, onClose }) {
  const [store, setStore]     = useState(() => loadStore());
  const [activeTab, setTab]   = useState("overview");

  useEffect(() => { if (isOpen) setStore(loadStore()); }, [isOpen]);

  const topicEntries    = useMemo(() => Object.entries(store.topicCounts || {}).sort((a, b) => b[1] - a[1]), [store.topicCounts]);
  const totalTopics     = useMemo(() => topicEntries.reduce((s, [, c]) => s + c, 0), [topicEntries]);
  const ttsMin          = Math.round((store.totalTTSSeconds || 0) / 60);
  const daysSince       = useMemo(() => {
    try { return Math.max(1, Math.round((Date.now() - new Date(store.firstSeen).getTime()) / 86_400_000)); }
    catch { return 1; }
  }, [store.firstSeen]);

  const handleReset = () => {
    if (window.confirm("Reset all analytics data? This cannot be undone.")) {
      localStorage.removeItem(STORE_KEY);
      setStore(defaultStore());
    }
  };

  const modalStyle = {
    position: "fixed", top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 201, width: "min(700px, 96vw)", maxHeight: "90vh",
    display: "flex", flexDirection: "column",
    background: "var(--land-bg)", border: "1px solid var(--land-rule)",
    borderRadius: 18, overflow: "hidden",
    boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={modalStyle}
            role="dialog" aria-modal="true" aria-label="Analytics Dashboard"
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid var(--land-rule)", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontFamily: "var(--land-serif)", fontSize: 22, fontWeight: 700, color: "var(--land-ink)", margin: 0 }}>Usage Analytics</h2>
                <p style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)", margin: "4px 0 0" }}>Your personal Cheeni stats — stored locally, never uploaded</p>
              </div>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--land-rule)", background: "transparent", color: "var(--land-ink-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Close">
                <IcoX />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, padding: "12px 24px 0", borderBottom: "1px solid var(--land-rule)", flexShrink: 0 }}>
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  fontFamily: "var(--land-sans)", fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
                  color: activeTab === t.id ? "var(--land-ink)" : "var(--land-ink-3)",
                  background: "transparent", border: "none", cursor: "pointer", padding: "8px 14px",
                  borderBottom: activeTab === t.id ? "2px solid var(--land-accent)" : "2px solid transparent",
                  marginBottom: -1, transition: "color 0.15s",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>
              <AnimatePresence mode="wait">

                {activeTab === "overview" && (
                  <motion.div key="overview" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
                      <StatCard icon={IcoMsg}      value={store.totalMessages || 0} label="Total messages"       accentColor="#5B4FBE" />
                      <StatCard icon={IcoTrend}    value={store.sessionsStarted || 0} label="Sessions started"   accentColor="var(--land-accent)" />
                      <StatCard icon={IcoVolume}   value={`${ttsMin}m`}            label="Voice time (TTS)"      accentColor="#2A7A3B" />
                      <StatCard icon={IcoActivity} value={daysSince}               label="Days since first use"  accentColor="#C0392B" />
                    </div>
                    <div style={{ background: "var(--land-bg-2)", border: "1px solid var(--land-rule)", borderRadius: 12, padding: "16px 18px" }}>
                      <h3 style={{ fontFamily: "var(--land-sans)", fontSize: 13, fontWeight: 600, color: "var(--land-ink-2)", margin: "0 0 12px" }}>Messages — Last 7 Days</h3>
                      <WeeklyBarChart dailyCounts={store.dailyCounts || {}} />
                    </div>
                    {Object.keys(store.actionCounts || {}).length > 0 && (
                      <div style={{ marginTop: 12, background: "var(--land-bg-2)", border: "1px solid var(--land-rule)", borderRadius: 12, padding: "16px 18px" }}>
                        <h3 style={{ fontFamily: "var(--land-sans)", fontSize: 13, fontWeight: 600, color: "var(--land-ink-2)", margin: "0 0 12px" }}>Actions Executed</h3>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {Object.entries(store.actionCounts).map(([type, count]) => (
                            <span key={type} style={{ fontFamily: "var(--land-sans)", fontSize: 12, background: "var(--land-bg)", border: "1px solid var(--land-rule)", borderRadius: 20, padding: "4px 10px", color: "var(--land-ink-2)" }}>
                              {type.replace(/_/g, " ")}: <strong>{count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "topics" && (
                  <motion.div key="topics" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
                    {topicEntries.length === 0
                      ? <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--land-ink-3)", fontFamily: "var(--land-sans)", fontSize: 14 }}>
                          <p style={{ margin: 0 }}>No topic data yet.</p>
                          <p style={{ margin: "8px 0 0", fontSize: 12 }}>Ask Cheeni questions to build your topic profile.</p>
                        </div>
                      : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <p style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)", margin: "0 0 8px" }}>Based on {store.totalMessages || 0} total messages</p>
                          {topicEntries.map(([topic, count], i) => (
                            <TopicBar key={topic} topic={topic} count={count} total={totalTopics} accentColor={TOPIC_COLORS[i % TOPIC_COLORS.length]} />
                          ))}
                        </div>
                    }
                  </motion.div>
                )}

                {activeTab === "activity" && (
                  <motion.div key="activity" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
                    <div style={{ background: "var(--land-bg-2)", border: "1px solid var(--land-rule)", borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
                      <h3 style={{ fontFamily: "var(--land-sans)", fontSize: 13, fontWeight: 600, color: "var(--land-ink-2)", margin: "0 0 16px" }}>Daily Message Volume</h3>
                      <WeeklyBarChart dailyCounts={store.dailyCounts || {}} />
                    </div>
                    <div style={{ background: "var(--land-bg-2)", border: "1px solid var(--land-rule)", borderRadius: 12, padding: "16px 18px" }}>
                      <h3 style={{ fontFamily: "var(--land-sans)", fontSize: 13, fontWeight: 600, color: "var(--land-ink-2)", margin: "0 0 12px" }}>All-Time Records</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { label: "Total messages sent",  value: store.totalMessages || 0 },
                          { label: "Sessions started",     value: store.sessionsStarted || 0 },
                          { label: "TTS voice time",       value: `${ttsMin} min (${store.totalTTSSeconds || 0}s)` },
                          { label: "First session",        value: store.firstSeen ? new Date(store.firstSeen).toLocaleDateString() : "—" },
                          { label: "Last session",         value: store.lastSeen  ? new Date(store.lastSeen).toLocaleDateString()  : "—" },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--land-rule)" }}>
                            <span style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)" }}>{label}</span>
                            <span style={{ fontFamily: "var(--land-sans)", fontSize: 12, fontWeight: 600, color: "var(--land-ink)" }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleReset} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(192,57,43,0.35)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "var(--land-sans)", fontSize: 12, color: "#C0392B" }}>
                      <IcoReset /> Reset analytics data
                    </button>
                  </motion.div>
                )}

                {activeTab === "shortcuts" && (
                  <motion.div key="shortcuts" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <IcoKeyboard />
                      <p style={{ fontFamily: "var(--land-sans)", fontSize: 13, color: "var(--land-ink-2)", margin: 0 }}>Global keyboard shortcuts — works anywhere in the app</p>
                    </div>
                    {SHORTCUTS.map(({ keys, action }) => <ShortcutRow key={action} keys={keys} action={action} />)}
                    <div style={{ marginTop: 20, padding: "14px 16px", background: "var(--land-bg-2)", border: "1px solid var(--land-rule)", borderRadius: 10 }}>
                      <p style={{ fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)", margin: 0, lineHeight: 1.6 }}>
                        <strong style={{ color: "var(--land-ink-2)" }}>Tip:</strong> Press <kbd style={{ fontFamily: "monospace", fontSize: 11, background: "var(--land-bg)", border: "1px solid var(--land-rule)", borderRadius: 4, padding: "1px 5px" }}>Space</kbd> on the home screen to instantly start voice input.
                      </p>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AnalyticsDashboard;
