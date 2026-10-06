import React from "react";

/**
 * ChatSkeleton
 * Displays subtle skeleton message bubbles matching the warm Apple-inspired theme
 * while conversation history loads.
 */
export function ChatSkeleton({ count = 3 }) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0", width: "100%" }} aria-label="Loading conversation history">
      {items.map((i) => (
        <React.Fragment key={i}>
          {/* User message skeleton bubble (right-aligned) */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "flex-end", opacity: 0.6 }}>
            <div
              style={{
                width: "55%",
                borderRadius: "12px 12px 2px 12px",
                padding: "12px 14px",
                background: "var(--land-bg-2)",
                border: "1px solid var(--land-rule)",
              }}
            >
              <div style={{ height: 10, background: "rgba(26,25,22,0.12)", borderRadius: 4, width: "80%", marginBottom: 8 }} />
              <div style={{ height: 9, background: "rgba(26,25,22,0.07)", borderRadius: 4, width: "50%" }} />
            </div>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--land-bg-2)", border: "1px solid var(--land-rule)", flexShrink: 0 }} />
          </div>

          {/* Assistant message skeleton bubble (left-aligned) */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start", alignItems: "flex-start", opacity: 0.7 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--land-bg-2)", border: "1px solid var(--land-rule)", flexShrink: 0, marginTop: 4 }} />
            <div
              style={{
                width: "72%",
                borderRadius: "12px 12px 12px 2px",
                padding: "14px 16px",
                background: "var(--land-bg)",
                border: "1px solid var(--land-rule)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ height: 10, background: "rgba(181, 100, 42, 0.2)", borderRadius: 4, width: "30%", marginBottom: 4 }} />
              <div style={{ height: 9, background: "rgba(26,25,22,0.08)", borderRadius: 4, width: "100%" }} />
              <div style={{ height: 9, background: "rgba(26,25,22,0.08)", borderRadius: 4, width: "85%" }} />
              <div style={{ height: 9, background: "rgba(26,25,22,0.08)", borderRadius: 4, width: "65%" }} />
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export default ChatSkeleton;
