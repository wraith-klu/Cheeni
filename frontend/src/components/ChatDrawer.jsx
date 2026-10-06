import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MarkdownRenderer from "./MarkdownRenderer";
import ChatSkeleton from "./common/ChatSkeleton";

// ── SVG Icon Set ──────────────────────────────────────────────────────────────

const IcoClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IcoTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IcoSend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IcoVolume = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const IcoCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IcoCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IcoRefresh = ({ spinning }) => (
  <svg
    width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={spinning ? { animation: "drawerSpin 1s linear infinite" } : {}}
  >
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IcoTerminal = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const IcoAlert = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IcoSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IcoBookmark = ({ filled }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const IcoTag = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IcoXSmall = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ── Tag colour map ──────────────────────────────────────────────────────────────
const TAG_COLORS = {
  interview: { bg: "rgba(251,191,36,0.12)", text: "#b45309", border: "rgba(251,191,36,0.35)" },
  coding: { bg: "rgba(99,102,241,0.12)", text: "#6366f1", border: "rgba(99,102,241,0.35)" },
  "system-design": { bg: "rgba(16,185,129,0.12)", text: "#059669", border: "rgba(16,185,129,0.35)" },
  general: { bg: "rgba(156,163,175,0.12)", text: "#6b7280", border: "rgba(156,163,175,0.3)" },
};

function tagStyle(tag) {
  const c = TAG_COLORS[tag] || TAG_COLORS.general;
  return {
    display: "inline-flex", alignItems: "center", gap: 3,
    fontSize: 9, fontWeight: 600, letterSpacing: "0.04em",
    textTransform: "uppercase",
    padding: "2px 6px", borderRadius: 4,
    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    fontFamily: "var(--land-sans)",
  };
}

// ── API helpers ────────────────────────────────────────────────────────────────
const API = "/api/assistant";

async function apiSearchHistory(q, tag) {
  const params = new URLSearchParams({ q });
  if (tag && tag !== "all") params.set("tag", tag);
  const res = await fetch(`${API}/history/search?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

async function apiGetTagSummary() {
  const res = await fetch(`${API}/history/tags`, { credentials: "include" });
  if (!res.ok) throw new Error("Tag summary failed");
  return res.json();
}

async function apiToggleBookmark(id) {
  const res = await fetch(`${API}/history/${id}/bookmark`, { method: "PATCH", credentials: "include" });
  if (!res.ok) throw new Error("Bookmark toggle failed");
  return res.json();
}

// ── ChatDrawer ─────────────────────────────────────────────────────────────────

export function ChatDrawer({
  isOpen,
  onClose,
  history = [],
  onSendMessage,
  onClearHistory,
  isThinking = false,
  isStreaming = false,
  streamingText = "",
  onSpeak,
  assistantName = "Cheeni",
  assistantAvatar,
  isLoadingHistory = false,
  isReconnecting = false,
}) {
  const [inputVal, setInputVal] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);

  // ── Search & Filter State (#16) ──────────────────────────────────────────────
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [activeTag, setActiveTag] = useState("all");
  const [tagSummary, setTagSummary] = useState(null);

  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  const messagesEndRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);

  // Load tag summary when drawer opens
  useEffect(() => {
    if (isOpen) {
      apiGetTagSummary()
        .then((data) => {
          if (data.success) setTagSummary(data);
          // Prime bookmarked IDs from current history
          const bm = new Set(history.filter((m) => m.bookmarked).map((m) => m._id));
          setBookmarkedIds(bm);
        })
        .catch(() => {/* ignore */});
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom in normal mode
  useEffect(() => {
    if (isOpen && !searchMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, history, isThinking, isStreaming, streamingText, searchMode]);

  // Focus search input when search mode opens
  useEffect(() => {
    if (searchMode) setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [searchMode]);

  // Debounced search
  const runSearch = useCallback((q, tag) => {
    clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    setSearchError(null);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const data = await apiSearchHistory(q, tag);
        setSearchResults(data.results || []);
      } catch (e) {
        setSearchError("Search unavailable");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 380);
  }, []);

  const handleSearchInput = (e) => {
    const v = e.target.value;
    setSearchQuery(v);
    runSearch(v, activeTag);
  };

  const handleTagChange = (tag) => {
    setActiveTag(tag);
    if (searchMode && searchQuery) runSearch(searchQuery, tag);
  };

  const handleToggleBookmark = async (msgId) => {
    try {
      const data = await apiToggleBookmark(msgId);
      if (data.success) {
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (data.bookmarked) next.add(msgId);
          else next.delete(msgId);
          return next;
        });
      }
    } catch {/* ignore */}
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputVal.trim() || isThinking || isStreaming) return;
    onSendMessage(inputVal.trim());
    setInputVal("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const exitSearch = () => {
    setSearchMode(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  };

  const isBusy = isThinking || isStreaming;

  // Filter history by active tag (client-side, fast)
  const displayHistory = activeTag === "all" || searchMode
    ? history
    : history.filter((m) => m.tags?.includes(activeTag));

  if (!isOpen) return null;

  const allTags = ["all", ...(tagSummary?.tags?.map((t) => t.tag) || [])];

  // ── Render helpers ───────────────────────────────────────────────────────────
  const renderMessage = (msg, index, isSearchResult = false) => {
    const isUser = msg.role === "user";
    const timeLabel = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    const msgId = msg._id;
    const isBookmarked = msgId ? bookmarkedIds.has(msgId) : false;

    return (
      <div
        key={isSearchResult ? `sr-${msgId}-${index}` : index}
        style={{
          display: "flex", gap: 10,
          justifyContent: isUser ? "flex-end" : "flex-start",
          alignItems: "flex-start",
        }}
      >
        {/* Assistant Avatar */}
        {!isUser && (
          <div style={{ flexShrink: 0, marginTop: 4 }}>
            <img
              src={assistantAvatar} alt={assistantName}
              style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--land-rule)" }}
            />
          </div>
        )}

        {/* Message Bubble */}
        <div
          style={{
            maxWidth: "85%",
            borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
            padding: "12px 16px", fontSize: 13, lineHeight: 1.55,
            background: isUser ? "var(--land-accent)" : "var(--land-bg-2)",
            color: isUser ? "#ffffff" : "var(--land-ink)",
            border: isUser ? "none" : "1px solid var(--land-rule)",
          }}
        >
          {/* Action execution tag */}
          {msg.action && (
            <div style={{
              marginBottom: 8, padding: "3px 8px", borderRadius: 6,
              background: "var(--land-bg)", border: "1px solid var(--land-rule)",
              color: "var(--land-accent)", fontSize: 11,
              display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace",
            }}>
              <IcoTerminal />
              <span>{msg.action.label || msg.action.type}</span>
            </div>
          )}

          {/* Topic tags (#16) */}
          {msg.tags && msg.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 7 }}>
              {msg.tags.map((tag) => (
                <span key={tag} style={tagStyle(tag)}>
                  <IcoTag /> {tag}
                </span>
              ))}
            </div>
          )}

          {isUser ? (
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
          ) : (
            <>
              <MarkdownRenderer content={msg.content} />
              {msg.isIncomplete && (
                <div style={{
                  marginTop: 10, padding: "8px 10px", borderRadius: 6,
                  background: "var(--land-accent-light)", border: "1px solid var(--land-accent)",
                  color: "var(--land-ink)", fontSize: 11,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <IcoAlert />
                    <span>Message incomplete &mdash; connection interrupted</span>
                  </span>
                  {msg.failedPrompt && (
                    <button
                      onClick={() => onSendMessage(msg.failedPrompt)}
                      style={{
                        padding: "3px 8px", borderRadius: 4, background: "var(--land-accent)",
                        color: "#fff", border: "none", fontSize: 10, fontWeight: 500, cursor: "pointer",
                      }}
                    >Retry</button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Action bar for assistant messages */}
          {!isUser && (
            <div style={{
              marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--land-rule)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontSize: 11, color: "var(--land-ink-3)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {onSpeak && (msg.speechText || msg.content) && (
                  <button
                    onClick={() => onSpeak(msg.speechText || msg.content)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "none", border: "none", color: "var(--land-accent)",
                      cursor: "pointer", padding: 0, fontSize: 11, fontFamily: "var(--land-sans)",
                    }}
                    title="Replay Voice"
                  >
                    <IcoVolume /><span>Replay</span>
                  </button>
                )}
                <button
                  onClick={() => handleCopy(msg.content, index)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "none", border: "none", color: "var(--land-ink-3)",
                    cursor: "pointer", padding: 0, fontSize: 11, fontFamily: "var(--land-sans)",
                  }}
                  title="Copy message"
                >
                  {copiedIndex === index ? (
                    <><IcoCheck /><span style={{ color: "var(--land-accent)" }}>Copied</span></>
                  ) : (
                    <><IcoCopy /><span>Copy</span></>
                  )}
                </button>
                {/* Bookmark button (#16) */}
                {msgId && (
                  <button
                    onClick={() => handleToggleBookmark(msgId)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "none", border: "none",
                      color: isBookmarked ? "var(--land-accent)" : "var(--land-ink-3)",
                      cursor: "pointer", padding: 0, fontSize: 11, fontFamily: "var(--land-sans)",
                    }}
                    title={isBookmarked ? "Remove bookmark" : "Bookmark this"}
                  >
                    <IcoBookmark filled={isBookmarked} />
                    <span>{isBookmarked ? "Saved" : "Save"}</span>
                  </button>
                )}
              </div>
              <span style={{ fontFamily: "monospace", fontSize: 10 }}>{timeLabel}</span>
            </div>
          )}

          {/* Timestamp for user messages */}
          {isUser && timeLabel && (
            <p style={{ margin: "4px 0 0 0", fontSize: 9, opacity: 0.8, textAlign: "right", fontFamily: "monospace" }}>
              {timeLabel}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", justifyContent: "flex-end",
        background: "rgba(26, 25, 22, 0.45)", backdropFilter: "blur(4px)",
        fontFamily: "var(--land-sans)",
      }}
    >
      {/* Backdrop */}
      <div style={{ flex: 1, cursor: "pointer" }} onClick={onClose} aria-label="Close drawer" />

      {/* Drawer Container */}
      <div
        style={{
          width: "100%", maxWidth: 560, height: "100%",
          background: "var(--land-bg)", borderLeft: "1px solid var(--land-rule)",
          display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(26, 25, 22, 0.12)",
          position: "relative", zIndex: 10,
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: "16px 20px", borderBottom: "1px solid var(--land-rule)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--land-bg-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <img
                src={assistantAvatar} alt={assistantName}
                style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--land-accent)" }}
              />
              <span style={{
                position: "absolute", bottom: 0, right: 0, width: 8, height: 8,
                borderRadius: "50%", background: "var(--land-accent)", border: "2px solid var(--land-bg-2)",
              }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{
                  fontFamily: "var(--land-serif)", fontSize: 16, fontWeight: 500,
                  margin: 0, color: "var(--land-ink)",
                }}>
                  {assistantName}
                </h3>
                <span style={{
                  fontSize: 11, color: "var(--land-ink-3)", background: "var(--land-bg)",
                  border: "1px solid var(--land-rule)", padding: "1px 7px", borderRadius: 999,
                }}>
                  Notes &amp; Session
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "var(--land-ink-3)" }}>
                {tagSummary
                  ? `${tagSummary.total} messages · ${tagSummary.bookmarked} saved`
                  : "Spoken interactions, interview prep, and system commands"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Search toggle (#16) */}
            <button
              onClick={() => searchMode ? exitSearch() : setSearchMode(true)}
              title={searchMode ? "Exit search" : "Search history"}
              style={{
                width: 32, height: 32, borderRadius: 6, cursor: "pointer",
                background: searchMode ? "var(--land-accent)" : "transparent",
                border: "1px solid var(--land-rule)",
                color: searchMode ? "#fff" : "var(--land-ink-3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              aria-label="Search conversation history"
              id="chat-search-toggle"
            >
              <IcoSearch />
            </button>

            {history.length > 0 && !searchMode && (
              <span style={{ fontSize: 11, color: "var(--land-ink-3)", fontFamily: "monospace", marginRight: 4 }}>
                {history.filter((m) => m.role === "assistant").length} replies
              </span>
            )}

            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                title="Clear Conversation History"
                style={{
                  width: 32, height: 32, borderRadius: 6, background: "transparent",
                  border: "1px solid var(--land-rule)", color: "var(--land-ink-3)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
                aria-label="Clear conversation history"
              >
                <IcoTrash />
              </button>
            )}

            <button
              onClick={onClose} title="Close Panel"
              style={{
                width: 32, height: 32, borderRadius: 6, background: "transparent",
                border: "1px solid var(--land-rule)", color: "var(--land-ink-3)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
              aria-label="Close panel"
            >
              <IcoClose />
            </button>
          </div>
        </div>

        {/* ── Search Bar (#16) ──────────────────────────────────────────────────── */}
        {searchMode && (
          <div style={{
            padding: "10px 16px", borderBottom: "1px solid var(--land-rule)",
            background: "var(--land-bg)",
          }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: 10, color: "var(--land-ink-3)", pointerEvents: "none" }}>
                <IcoSearch />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                id="chat-history-search"
                value={searchQuery}
                onChange={handleSearchInput}
                placeholder="Search your conversation history…"
                style={{
                  width: "100%", background: "var(--land-bg-2)",
                  border: "1px solid var(--land-accent)", borderRadius: 8,
                  padding: "9px 32px 9px 32px", fontSize: 13, color: "var(--land-ink)",
                  outline: "none", fontFamily: "var(--land-sans)", boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                  style={{
                    position: "absolute", right: 8, background: "none", border: "none",
                    color: "var(--land-ink-3)", cursor: "pointer", padding: 2, borderRadius: 4,
                    display: "flex", alignItems: "center",
                  }}
                  aria-label="Clear search"
                >
                  <IcoXSmall />
                </button>
              )}
            </div>
            {isSearching && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--land-ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
                <IcoRefresh spinning /><span>Searching…</span>
              </div>
            )}
            {searchError && (
              <p style={{ marginTop: 6, fontSize: 11, color: "#ef4444" }}>{searchError}</p>
            )}
          </div>
        )}

        {/* ── Tag Filter Bar (#16) ──────────────────────────────────────────────── */}
        {allTags.length > 1 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderBottom: "1px solid var(--land-rule)", overflowX: "auto",
            background: "var(--land-bg)", flexShrink: 0,
            scrollbarWidth: "none",
          }}>
            {allTags.map((tag) => {
              const isActive = activeTag === tag;
              const count = tag === "all"
                ? tagSummary?.total
                : tagSummary?.tags?.find((t) => t.tag === tag)?.count;
              const tc = TAG_COLORS[tag] || TAG_COLORS.general;
              return (
                <button
                  key={tag}
                  onClick={() => handleTagChange(tag)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500,
                    fontFamily: "var(--land-sans)", cursor: "pointer", whiteSpace: "nowrap",
                    flexShrink: 0, transition: "all 0.15s",
                    background: isActive
                      ? (tag === "all" ? "var(--land-accent)" : tc.bg)
                      : "transparent",
                    color: isActive
                      ? (tag === "all" ? "#fff" : tc.text)
                      : "var(--land-ink-3)",
                    border: isActive
                      ? (tag === "all" ? "1px solid var(--land-accent)" : `1px solid ${tc.border}`)
                      : "1px solid var(--land-rule)",
                  }}
                  aria-pressed={isActive}
                >
                  {tag !== "all" && <IcoTag />}
                  <span style={{ textTransform: tag === "all" ? "none" : "capitalize" }}>
                    {tag}
                  </span>
                  {count !== undefined && (
                    <span style={{ opacity: 0.7, fontSize: 10 }}>({count})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Reconnecting banner */}
        {isReconnecting && (
          <div style={{
            padding: "8px 16px", background: "var(--land-accent-light)",
            borderBottom: "1px solid var(--land-accent)", color: "var(--land-accent)",
            fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IcoRefresh spinning />
              <span>Reconnecting to brain... displaying cached session data.</span>
            </span>
            <span style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.8 }}>Offline Cache</span>
          </div>
        )}

        {/* ── Messages Feed ─────────────────────────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "20px 20px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>

          {/* Search results view */}
          {searchMode ? (
            searchQuery.trim() === "" ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--land-ink-3)", fontSize: 13 }}>
                <IcoSearch />
                <p style={{ marginTop: 10 }}>Type to search your conversation history</p>
                <p style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
                  Full-text search across all messages
                </p>
              </div>
            ) : searchResults.length === 0 && !isSearching ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--land-ink-3)", fontSize: 13 }}>
                <p>No results for <strong>&ldquo;{searchQuery}&rdquo;</strong></p>
                <p style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>Try different keywords or remove the tag filter</p>
              </div>
            ) : (
              <>
                {searchResults.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--land-ink-3)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <IcoSearch />
                    <span>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;</span>
                  </div>
                )}
                {searchResults.map((msg, i) => renderMessage(msg, i, true))}
              </>
            )
          ) : isLoadingHistory && history.length === 0 ? (
            <ChatSkeleton count={4} />
          ) : displayHistory.length === 0 ? (
            <div style={{
              height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              textAlign: "center", padding: "20px 10px",
            }}>
              <h4 style={{
                fontFamily: "var(--land-serif)", fontSize: 18, fontWeight: 500,
                color: "var(--land-ink)", margin: "0 0 6px 0",
              }}>
                {activeTag === "all" ? "Session Notes & History" : `No "${activeTag}" conversations`}
              </h4>
              <p style={{ fontSize: 13, color: "var(--land-ink-3)", maxWidth: 340, lineHeight: 1.5, margin: "0 0 24px 0" }}>
                {activeTag === "all"
                  ? "Spoken queries, coding challenges, and desktop automation logs appear here in real time."
                  : `No messages tagged as "${activeTag}" yet. Start a conversation and Cheeni will auto-tag it.`}
              </p>

              {activeTag === "all" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 360 }}>
                  {[
                    { label: "Technical Interview on Binary Search", prompt: "Cheeni, conduct a technical coding interview on binary search algorithms" },
                    { label: "Explain STAR Method for Behavioral Interviews", prompt: "Cheeni, explain the STAR method for behavioral interviews with examples" },
                    { label: "Top Tech Headlines Today", prompt: "Cheeni, what are the top tech and engineering news today?" },
                    { label: "System Design: Scaling a Message Queue", prompt: "Cheeni, walk me through designing a resilient distributed message queue" },
                  ].map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => onSendMessage(chip.prompt)}
                      style={{
                        padding: "10px 14px", borderRadius: 8, background: "var(--land-bg-2)",
                        border: "1px solid var(--land-rule)", textAlign: "left", fontSize: 12,
                        color: "var(--land-ink-2)", display: "flex", alignItems: "center",
                        justifyContent: "space-between", cursor: "pointer",
                        fontFamily: "var(--land-sans)", transition: "border-color 0.15s, background-color 0.15s",
                      }}
                    >
                      <span>{chip.label}</span>
                      <span style={{ fontSize: 11, color: "var(--land-accent)", fontWeight: 500 }}>Ask &rarr;</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            displayHistory.map((msg, index) => renderMessage(msg, index))
          )}

          {/* Typing Indicator with 3 Bouncing Dots (#18) */}
          {!searchMode && isThinking && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex", gap: 10, alignItems: "center" }}
            >
              <img
                src={assistantAvatar}
                alt={assistantName}
                style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--land-rule)" }}
              />
              <div
                style={{
                  borderRadius: "14px 14px 14px 2px",
                  padding: "10px 14px",
                  fontSize: 12,
                  background: "var(--land-bg-2)",
                  border: "1px solid var(--land-rule)",
                  color: "var(--land-ink-2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* 3 Bouncing Dots */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {[0, 1, 2].map((dotIdx) => (
                    <motion.span
                      key={dotIdx}
                      animate={{
                        y: [-3, 3, -3],
                        opacity: [0.4, 1, 0.4],
                      }}
                      transition={{
                        duration: 0.65,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: dotIdx * 0.15,
                      }}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--land-accent)",
                        display: "inline-block",
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontWeight: 500 }}>{assistantName} is thinking...</span>
              </div>
            </motion.div>
          )}

          {/* Streaming Live Bubble */}
          {!searchMode && isStreaming && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <img src={assistantAvatar} alt={assistantName}
                style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--land-rule)", marginTop: 4 }}
              />
              <div style={{
                maxWidth: "85%", borderRadius: "14px 14px 14px 2px", padding: "12px 16px",
                fontSize: 13, lineHeight: 1.55, background: "var(--land-bg-2)",
                color: "var(--land-ink)", border: "1px solid var(--land-accent)",
              }}>
                <div style={{ fontSize: 10, color: "var(--land-accent)", fontFamily: "monospace", marginBottom: 6, fontWeight: 600 }}>
                  Generating response...
                </div>
                {streamingText ? (
                  <MarkdownRenderer content={streamingText} />
                ) : (
                  <span style={{ fontSize: 12, color: "var(--land-ink-3)" }}>Composing reply...</span>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Drawer Footer Input */}
        {!searchMode && (
          <form
            onSubmit={handleSend}
            style={{
              padding: "14px 18px", borderTop: "1px solid var(--land-rule)",
              background: "var(--land-bg-2)", display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <input
              type="text"
              id="chat-drawer-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isBusy ? `${assistantName} is responding...` : `Message ${assistantName}...`}
              disabled={isBusy}
              style={{
                flex: 1, background: "var(--land-bg)", border: "1px solid var(--land-rule)",
                borderRadius: 8, padding: "10px 14px", fontSize: 13,
                color: "var(--land-ink)", outline: "none", fontFamily: "var(--land-sans)",
              }}
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || isBusy}
              style={{
                width: 38, height: 38, borderRadius: 8,
                background: inputVal.trim() && !isBusy ? "var(--land-accent)" : "var(--land-bg)",
                color: inputVal.trim() && !isBusy ? "#fff" : "var(--land-ink-3)",
                border: "1px solid var(--land-rule)", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: !inputVal.trim() || isBusy ? "not-allowed" : "pointer",
                opacity: !inputVal.trim() || isBusy ? 0.4 : 1, flexShrink: 0,
              }}
              title="Send" aria-label="Send"
            >
              <IcoSend />
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes drawerSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes drawerBounce {
          0% { opacity: 0.3; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

export default ChatDrawer;
