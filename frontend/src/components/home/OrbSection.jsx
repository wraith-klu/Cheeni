import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import defaultAvatar from "../../assets/image1.jpg";
import AudioWave from "../AudioWave";

/*
 * Central avatar + state display for the agent dashboard.
 * Design: clean circular avatar, readable status labels,
 *         warm-tinted speech/stream bubbles with framer-motion transitions.
 */

const IcoStop = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
  </svg>
);
const IcoLaptop = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
);
const IcoExternal = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

/* State → label / ring colour / motion variants */
function stateTokens(isListening, isThinking, isStreaming, isSpeaking) {
  if (isListening) return {
    id: "listening",
    label: "Listening…",
    ring: "#C0392B",
    dot: "#C0392B",
    glow: "0 0 35px rgba(192, 57, 43, 0.45)",
    scale: [1, 1.04, 1],
    duration: 1.4,
  };
  if (isThinking) return {
    id: "thinking",
    label: "Thinking…",
    ring: "#A0580C",
    dot: "#A0580C",
    glow: "0 0 30px rgba(160, 88, 12, 0.35)",
    scale: [1, 1.025, 1],
    duration: 1.8,
  };
  if (isStreaming) return {
    id: "streaming",
    label: "Responding…",
    ring: "#5B4FBE",
    dot: "#5B4FBE",
    glow: "0 0 35px rgba(91, 79, 190, 0.4)",
    scale: [1, 1.03, 1],
    duration: 1.2,
  };
  if (isSpeaking) return {
    id: "speaking",
    label: "Speaking…",
    ring: "#2A7A3B",
    dot: "#2A7A3B",
    glow: "0 0 40px rgba(42, 122, 59, 0.45)",
    scale: [1, 1.05, 1],
    duration: 1.0,
  };
  return {
    id: "ready",
    label: "Ready",
    ring: "var(--land-accent)",
    dot: "#2A7A3B",
    glow: "0 4px 20px rgba(181, 100, 42, 0.15)",
    scale: 1,
    duration: 2.5,
  };
}

export function OrbSection({
  assistantName,
  assistantAvatar,
  isListening,
  isSpeaking,
  isThinking,
  isStreaming,
  transcript,
  streamingText,
  latestReply,
  lastAction,
  onTriggerGreeting,
  onToggleListening,
  onStopSpeaking,
  onExecuteAction,
}) {
  const tk = stateTokens(isListening, isThinking, isStreaming, isSpeaking);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 0 }}>

      {/* Avatar ring with smooth Framer Motion orb transitions */}
      <motion.div
        onClick={() => { onTriggerGreeting?.(); onToggleListening?.(); }}
        title={isListening ? "Tap to stop listening" : "Tap to speak"}
        animate={{
          scale: tk.scale,
          borderColor: tk.ring,
          boxShadow: tk.glow,
        }}
        transition={{
          duration: tk.duration,
          repeat: Array.isArray(tk.scale) ? Infinity : 0,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        style={{
          position: "relative",
          width: 180,
          height: 180,
          borderRadius: "50%",
          cursor: "pointer",
          border: `3px solid ${tk.ring}`,
          flexShrink: 0,
          marginBottom: 20,
        }}
      >
        {/* Soft breathing background pulse aura */}
        <motion.div
          animate={{
            opacity: isListening || isSpeaking || isStreaming || isThinking ? [0.15, 0.45, 0.15] : 0,
            scale: [0.95, 1.12, 0.95],
          }}
          transition={{
            duration: tk.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            background: tk.ring,
            filter: "blur(14px)",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        <img
          src={assistantAvatar || defaultAvatar}
          alt={assistantName}
          onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultAvatar; }}
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          }}
        />

        {/* State label pill at bottom with smooth crossfade */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tk.id}
            initial={{ opacity: 0, y: 4, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.92 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute",
              bottom: -14,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--land-bg)",
              border: "1px solid var(--land-rule)",
              borderRadius: 20,
              padding: "4px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              zIndex: 2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: tk.dot,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: "var(--land-sans)", fontSize: 12, fontWeight: 500, color: "var(--land-ink-2)" }}>
              {tk.label}
            </span>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* AudioWave — dynamic waveform animation while speaking or listening */}
      <div style={{ marginTop: 24, marginBottom: 12 }}>
        <AudioWave isSpeaking={isSpeaking} isListening={isListening} barCount={11} size="md" />
      </div>

      {/* Live transcript */}
      <AnimatePresence>
        {isListening && transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{
              marginTop: 8, maxWidth: 480, width: "100%",
              background: "var(--land-bg-2)", border: "1px solid var(--land-rule)",
              borderLeft: "3px solid #C0392B",
              borderRadius: 10, padding: "10px 16px",
              fontFamily: "var(--land-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--land-ink-2)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#C0392B", display: "block", marginBottom: 4 }}>
              Listening
            </span>
            &ldquo;{transcript}&rdquo;
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streaming preview */}
      <AnimatePresence>
        {isStreaming && !isListening && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{
              marginTop: 8, maxWidth: 480, width: "100%",
              background: "var(--land-bg-2)", border: "1px solid var(--land-rule)",
              borderLeft: "3px solid #5B4FBE",
              borderRadius: 10, padding: "12px 16px",
              fontFamily: "var(--land-sans)", fontSize: 14, lineHeight: 1.65, color: "var(--land-ink-2)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B4FBE", display: "block", marginBottom: 4 }}>
              Responding
            </span>
            {streamingText || "▍"}
            <span style={{ opacity: isStreaming ? 1 : 0 }}>▍</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply subtitle */}
      <AnimatePresence>
        {latestReply?.speechText && !isListening && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{
              marginTop: 8, maxWidth: 480, width: "100%",
              background: "var(--land-bg-2)", border: "1px solid var(--land-rule)",
              borderLeft: "3px solid var(--land-accent)",
              borderRadius: 10, padding: "12px 16px",
              fontFamily: "var(--land-sans)", fontSize: 14, lineHeight: 1.65, color: "var(--land-ink-2)",
              textAlign: "left",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            &ldquo;{latestReply.speechText}&rdquo;
            {isSpeaking && (
              <button
                onClick={onStopSpeaking}
                style={{
                  marginTop: 8, display: "flex", alignItems: "center", gap: 5,
                  background: "transparent", border: "1px solid var(--land-rule)",
                  borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                  fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-3)",
                }}
              >
                <IcoStop /> Stop audio
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action toast */}
      {lastAction && (
        <motion.div
          onClick={onExecuteAction}
          title="Click to re-execute"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--land-bg-2)", border: "1px solid var(--land-rule)",
            borderRadius: 20, padding: "6px 14px", cursor: "pointer",
            fontFamily: "var(--land-sans)", fontSize: 12, color: "var(--land-ink-2)",
          }}
        >
          <IcoLaptop />
          <span>{lastAction.label || `Action: ${lastAction.type}`}</span>
          {(lastAction.type === "open_url" || lastAction.type === "play_music" || lastAction.type === "search_web") && lastAction.url && (
            <a
              href={lastAction.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: "var(--land-accent)", display: "flex" }}
              title={lastAction.url}
            >
              <IcoExternal />
            </a>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default OrbSection;
