import React from "react";

/*
 * Quick-prompt shortcut grid for the agent dashboard.
 * Design: plain bordered tiles, ink text, accent on hover label.
 * Added: Screen Vision button (#24) for Gemini Vision / screenshot intelligence.
 */

const IcoMonitor = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
);
const IcoMusic = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
  </svg>
);
const IcoGlobe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IcoActivity = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IcoBriefcase = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
const IcoCamera = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const COMMANDS = [
  { Icon: IcoMonitor,   label: "Launch app",    sub: "Notepad, Chrome, VS Code",   prompt: "Cheeni, open Notepad for me",                    type: "prompt" },
  { Icon: IcoMusic,     label: "Play music",    sub: "YouTube, Spotify, Lofi",     prompt: "Cheeni, play lofi chill beats on YouTube",        type: "prompt" },
  { Icon: IcoGlobe,     label: "Web search",    sub: "Google, news, AI",           prompt: "What are the latest updates in artificial intelligence?", type: "prompt" },
  { Icon: IcoActivity,  label: "System info",   sub: "Battery, CPU, RAM",          prompt: "What is my laptop battery percentage?",           type: "prompt" },
  { Icon: IcoCamera,    label: "Screen Vision", sub: "What's on my screen?",       prompt: "What is on my screen right now?",                 type: "vision" },
  { Icon: IcoBriefcase, label: "Mock interview",sub: "DSA, System Design, HR",     prompt: "",                                                type: "interview" },
];

export function AgentToolbar({ onSendPrompt, onOpenInterviewPrep, onScreenshotVision }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5 sm:mt-7 w-full max-w-xl px-1 sm:px-0">
      {COMMANDS.map((c, i) => (
        <button
          key={i}
          onClick={() => {
            if (c.type === "interview" && onOpenInterviewPrep) {
              onOpenInterviewPrep();
            } else if (c.type === "vision" && onScreenshotVision) {
              onScreenshotVision(c.prompt);
            } else {
              onSendPrompt(c.prompt);
            }
          }}
          title={c.sub}
          style={{
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
            padding: "14px 14px",
            background: "var(--land-bg-2)",
            border: "1px solid var(--land-rule)",
            borderRadius: 10,
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "var(--land-sans)",
          }}
        >
          <span style={{ color: c.type === "vision" ? "#5B4FBE" : "var(--land-accent)", display: "flex" }}><c.Icon /></span>
          <span>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--land-ink)", lineHeight: 1.2 }}>{c.label}</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--land-ink-3)", marginTop: 2, lineHeight: 1.4 }}>{c.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default AgentToolbar;
