import React from "react";
import { motion } from "framer-motion";

/**
 * AudioWave Component
 * Renders an understated, dynamic equalizer soundwave when Cheeni is speaking or listening.
 * Uses framer-motion transitions with realistic frequency dynamics.
 */
export function AudioWave({ isSpeaking, isListening, barCount = 11, size = "md" }) {
  const bars = Array.from({ length: barCount }, (_, i) => i);
  const isActive = isSpeaking || isListening;

  // Sizing tokens
  const heightScale = size === "sm" ? 18 : size === "lg" ? 42 : 30;
  const barWidth = size === "sm" ? 2.5 : size === "lg" ? 4 : 3;
  const gap = size === "sm" ? 3 : 4;

  // Color tone based on state
  const activeColor = isSpeaking ? "#2A7A3B" : isListening ? "#C0392B" : "var(--land-accent)";
  const activeGlow = isSpeaking
    ? "0 2px 10px rgba(42, 122, 59, 0.25)"
    : isListening
    ? "0 2px 10px rgba(192, 57, 43, 0.25)"
    : "0 2px 10px rgba(181, 100, 42, 0.2)";

  if (!isActive) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap,
          height: heightScale,
          padding: "0 12px",
          borderRadius: 999,
          background: "var(--land-bg-2)",
          border: "1px solid var(--land-rule)",
          transition: "all 0.3s ease",
        }}
        aria-hidden="true"
      >
        {bars.map((i) => (
          <span
            key={i}
            style={{
              width: barWidth,
              height: 4,
              borderRadius: 2,
              background: "var(--land-ink-3)",
              opacity: 0.3,
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>
    );
  }

  // Realistic natural wave patterns (mirrored from center)
  // Indices near middle oscillate higher
  const mid = (barCount - 1) / 2;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
        height: heightScale + 6,
        padding: "0 16px",
        borderRadius: 999,
        background: "var(--land-bg)",
        border: `1px solid ${activeColor}`,
        boxShadow: activeGlow,
      }}
      aria-label={isSpeaking ? "TTS Speaking audio wave" : "Microphone listening audio wave"}
    >
      {bars.map((i) => {
        // Distance from center determines baseline magnitude
        const distFromMid = Math.abs(i - mid);
        const maxBarHeight = Math.max(6, heightScale - distFromMid * 3.5);
        const minBarHeight = 4;
        const duration = isListening ? 0.45 + (i % 3) * 0.15 : 0.6 + (i % 4) * 0.12;

        return (
          <motion.span
            key={i}
            animate={{
              height: [minBarHeight, maxBarHeight, minBarHeight + 2, maxBarHeight * 0.8, minBarHeight],
              opacity: [0.6, 1, 0.7, 0.95, 0.6],
            }}
            transition={{
              duration,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
              delay: (i * 0.07) % 0.4,
            }}
            style={{
              width: barWidth,
              borderRadius: barWidth / 2,
              background: activeColor,
              display: "inline-block",
            }}
          />
        );
      })}
    </motion.div>
  );
}

export default AudioWave;
