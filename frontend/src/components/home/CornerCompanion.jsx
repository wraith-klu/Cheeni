import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AudioWave from "../AudioWave";

// Minimal inline SVGs
const IcoMic = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const IcoMicOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const IcoVolume = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const IcoVolumeMute = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const IcoMessage = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IcoMaximize = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const IcoMonitor = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const IcoSend = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IcoBattery = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="16" height="10" rx="2" />
    <line x1="22" y1="11" x2="22" y2="13" />
  </svg>
);

const IcoGlobe = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const IcoLock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IcoClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IcoSpinner = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "cornerSpin 1s linear infinite" }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export function CornerCompanion({
  assistantName,
  assistantAvatar,
  userName,
  greeting,
  status,
  isAgentConnected,
  isListening,
  isSpeaking,
  isThinking,
  isStreaming,
  streamingText,
  transcript,
  latestReply,
  lastAction,
  micError,
  history,
  isMuted,
  showSplash,
  splashFading,
  onSplashClick,
  onSnapCorner,
  onToggleMute,
  onOpenChat,
  onToggleCornerMode,
  onToggleListening,
  onRequestMicPermission,
  onSendPrompt,
}) {
  const [textInput, setTextInput] = useState("");

  const handleSend = (e) => {
    e?.preventDefault();
    const query = textInput.trim();
    if (!query || isThinking) return;
    onSendPrompt(query);
    setTextInput("");
  };

  const iconBtnStyle = {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "var(--land-bg)",
    border: "1px solid var(--land-rule)",
    color: "var(--land-ink-3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 380,
        margin: "0 auto",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "var(--land-sans)",
        padding: "16px 14px",
      }}
    >
      {/* Boot Splash Screen */}
      {showSplash && (
        <div
          onClick={onSplashClick}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "var(--land-bg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "opacity 0.6s ease",
            opacity: splashFading ? 0 : 1,
            pointerEvents: splashFading ? "none" : "auto",
          }}
        >
          <img
            src={assistantAvatar}
            alt={assistantName}
            style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--land-accent)", marginBottom: 16 }}
          />
          <p style={{ fontFamily: "var(--land-serif)", fontSize: 20, margin: 0, color: "var(--land-ink)" }}>
            {assistantName} is starting...
          </p>
          <span style={{ fontSize: 12, color: "var(--land-ink-3)", marginTop: 6 }}>Tap anywhere to begin</span>
        </div>
      )}

      {/* Companion Header */}
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "var(--land-bg)",
          borderRadius: 12,
          border: "1px solid var(--land-rule)",
          boxShadow: "0 2px 8px rgba(26, 25, 22, 0.04)",
        }}
      >
        {/* Left: Avatar & Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <img
              src={assistantAvatar}
              alt={assistantName}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--land-accent)",
              }}
            />
            <span
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--land-accent)",
                border: "1px solid var(--land-bg)",
              }}
            />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--land-serif)", fontSize: 14, fontWeight: 500, color: "var(--land-ink)" }}>
                {assistantName}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "var(--land-bg-2)",
                  color: "var(--land-ink-3)",
                  border: "1px solid var(--land-rule)",
                }}
              >
                Compact
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--land-ink-3)" }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: isAgentConnected ? "var(--land-accent)" : "var(--land-ink-3)",
                }}
              />
              <span>{status?.text || "Ready"}</span>
            </div>
          </div>
        </div>

        {/* Right Action Icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={onSnapCorner} title="Snap to Corner" style={iconBtnStyle} aria-label="Snap to corner">
            <IcoMonitor />
          </button>

          <button
            onClick={onToggleMute}
            title={isMuted ? "Unmute Voice" : "Mute Voice"}
            style={{
              ...iconBtnStyle,
              color: isMuted ? "var(--land-accent)" : "var(--land-ink-3)",
            }}
            aria-label={isMuted ? "Unmute Voice" : "Mute Voice"}
          >
            {isMuted ? <IcoVolumeMute /> : <IcoVolume />}
          </button>

          <button onClick={onOpenChat} title="Open Chat" style={iconBtnStyle} aria-label="Open Chat">
            <IcoMessage />
            {history?.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 13,
                  height: 13,
                  background: "var(--land-accent)",
                  color: "#fff",
                  fontSize: 8,
                  fontWeight: 700,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {history.filter((m) => m.role === "assistant").length}
              </span>
            )}
          </button>

          <button
            onClick={onToggleCornerMode}
            title="Expand to Full Studio"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 9px",
              borderRadius: 6,
              background: "var(--land-bg)",
              border: "1px solid var(--land-rule)",
              color: "var(--land-ink)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
            }}
            aria-label="Expand to Studio"
          >
            <IcoMaximize />
            <span>Studio</span>
          </button>
        </div>
      </div>

      {/* Center Stage: Avatar & Equalizer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 0" }}>
        <motion.div
          animate={{
            scale: isSpeaking ? [1, 1.05, 1] : isListening ? [1, 1.04, 1] : isThinking ? [1, 1.02, 1] : 1,
            boxShadow: isSpeaking
              ? "0 0 30px rgba(42, 122, 59, 0.35)"
              : isListening
              ? "0 0 30px rgba(192, 57, 43, 0.35)"
              : isThinking
              ? "0 0 25px rgba(160, 88, 12, 0.3)"
              : "0 4px 20px rgba(181, 100, 42, 0.15)",
          }}
          transition={{
            repeat: isSpeaking || isListening || isThinking ? Infinity : 0,
            duration: isSpeaking ? 1 : isListening ? 1.4 : 1.8,
            ease: "easeInOut",
          }}
          style={{
            position: "relative",
            marginBottom: 12,
            borderRadius: "50%",
            border: `2px solid ${isSpeaking ? "#2A7A3B" : isListening ? "#C0392B" : isThinking ? "#A0580C" : "var(--land-accent)"}`,
            padding: 2,
          }}
        >
          <img
            src={assistantAvatar}
            alt={assistantName}
            style={{
              width: 104,
              height: 104,
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
            }}
          />
          <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)" }}>
            <AudioWave isSpeaking={isSpeaking} isListening={isListening} barCount={7} size="sm" />
          </div>
        </motion.div>

        {/* Status Text */}
        <div style={{ margin: "10px 0 6px 0", fontSize: 12, color: "var(--land-ink-3)", fontWeight: 500 }}>
          {status?.text || "Standing by"}
        </div>

        {/* 2-Way Live Subtitles */}
        <div style={{ width: "100%", minHeight: 70, display: "flex", flexDirection: "column", justifyContent: "center", margin: "6px 0" }}>
          {transcript ? (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--land-bg)",
                border: "1px solid var(--land-rule)",
                fontSize: 12,
                color: "var(--land-ink)",
              }}
            >
              <span style={{ fontSize: 10, color: "var(--land-accent)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 2 }}>
                You
              </span>
              <p style={{ margin: 0, lineHeight: 1.4 }}>{transcript}</p>
            </div>
          ) : isStreaming ? (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--land-bg-2)",
                border: "1px solid var(--land-rule)",
                fontSize: 12,
                color: "var(--land-ink)",
              }}
            >
              <span style={{ fontSize: 10, color: "var(--land-accent)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 2 }}>
                {assistantName}
              </span>
              <p style={{ margin: 0, lineHeight: 1.4 }}>{streamingText || "..."}</p>
            </div>
          ) : latestReply ? (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--land-bg-2)",
                border: "1px solid var(--land-rule)",
                fontSize: 12,
                color: "var(--land-ink)",
              }}
            >
              <span style={{ fontSize: 10, color: "var(--land-accent)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 2 }}>
                {assistantName}
              </span>
              <p style={{ margin: 0, lineHeight: 1.4 }}>
                {latestReply.speechText || latestReply.textResponse}
              </p>
              {lastAction && (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 4,
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "var(--land-accent)",
                  }}
                >
                  [{lastAction.type}]
                </span>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--land-bg)",
                border: "1px solid var(--land-rule)",
                textAlign: "center",
                fontSize: 12,
                color: "var(--land-ink-3)",
              }}
            >
              <p style={{ margin: "0 0 2px 0", fontWeight: 600, color: "var(--land-ink)" }}>
                {greeting}, {userName}
              </p>
              <span>Tap microphone or speak freely</span>
            </div>
          )}

          {micError && (
            <div
              onClick={onRequestMicPermission}
              style={{
                marginTop: 6,
                padding: "6px 10px",
                borderRadius: 6,
                background: "var(--land-accent-light)",
                border: "1px solid var(--land-accent)",
                color: "var(--land-ink)",
                fontSize: 11,
                textAlign: "center",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <IcoMicOff />
              <span>Microphone access needed. Click to allow.</span>
            </div>
          )}
        </div>

        {/* Central Large Mic Button */}
        <div style={{ margin: "10px 0 4px 0" }}>
          <button
            onClick={onToggleListening}
            disabled={isThinking || isStreaming}
            title={isListening ? "Stop listening" : "Speak to Cheeni"}
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: isListening ? "var(--land-accent)" : "var(--land-bg)",
              color: isListening ? "#fff" : "var(--land-accent)",
              border: `2px solid ${isListening ? "var(--land-accent)" : "var(--land-rule)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isThinking || isStreaming ? "not-allowed" : "pointer",
              boxShadow: isListening ? "0 4px 16px rgba(181, 100, 42, 0.35)" : "0 2px 8px rgba(26,25,22,0.06)",
              transition: "all 0.2s ease",
            }}
            aria-label={isListening ? "Stop listening" : "Speak to Cheeni"}
          >
            {isThinking || isStreaming ? <IcoSpinner /> : <IcoMic />}
          </button>
        </div>
        <span style={{ fontSize: 10, color: "var(--land-ink-3)" }}>
          {isListening ? "Listening... tap to send" : "Tap to speak"}
        </span>

        {/* Quick Action Suggestion Chips */}
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            padding: "8px 0",
            marginTop: 8,
          }}
        >
          {[
            { icon: <IcoBattery />, label: "Battery", prompt: "What is my laptop battery percentage?" },
            { icon: <IcoGlobe />, label: "Chrome", prompt: "Open Google Chrome" },
            { icon: <IcoLock />, label: "Lock PC", prompt: "Lock my laptop" },
            { icon: <IcoClock />, label: "Time", prompt: "What is the current time and date?" },
            { icon: <IcoVolume />, label: "Vol 50%", prompt: "Set volume to 50 percent" },
          ].map((chip, i) => (
            <button
              key={i}
              onClick={() => onSendPrompt(chip.prompt)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                borderRadius: 6,
                background: "var(--land-bg)",
                border: "1px solid var(--land-rule)",
                color: "var(--land-ink-2)",
                fontSize: 11,
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "var(--land-sans)",
              }}
            >
              {chip.icon}
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Text Input Bar */}
      <form
        onSubmit={handleSend}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--land-bg)",
          borderRadius: 8,
          border: "1px solid var(--land-rule)",
          padding: "4px 6px",
        }}
      >
        <input
          id="cheeni-corner-input"
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={`Talk or type to ${assistantName}... (Ctrl+K)`}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 12,
            color: "var(--land-ink)",
            padding: "4px 6px",
            fontFamily: "var(--land-sans)",
          }}
        />
        <button
          type="submit"
          disabled={!textInput.trim() || isThinking}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: textInput.trim() && !isThinking ? "var(--land-accent)" : "transparent",
            color: textInput.trim() && !isThinking ? "#fff" : "var(--land-ink-3)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: !textInput.trim() || isThinking ? "not-allowed" : "pointer",
          }}
          aria-label="Send"
        >
          <IcoSend />
        </button>
      </form>

      <style>{`
        @keyframes cornerSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default CornerCompanion;
