import React from "react";

/*
 * Greeting header for the agent dashboard.
 * No particles, no emoji, no gradient text. Clean serif + dark ink.
 */
export function GreetingHeader({ greeting, userName, showSplash = false }) {
  if (showSplash) return null;

  return (
    <div style={{ textAlign: "center", marginBottom: 28 }}>
      <p style={{
        fontFamily: "var(--land-serif)",
        fontSize: "clamp(22px, 3vw, 32px)",
        fontWeight: 400,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        color: "var(--land-ink)",
        margin: "0 0 8px",
      }}>
        {greeting}, {userName}.
      </p>
      <p style={{
        fontFamily: "var(--land-sans)",
        fontSize: 14,
        color: "var(--land-ink-3)",
        margin: 0,
      }}>
        Tap the mic or type a command below.
      </p>
    </div>
  );
}

export default GreetingHeader;
