import React, { useState } from "react";
import apiClient from "../utils/api";

// Inline SVGs
const IcoSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IcoClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IcoVolume = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const IcoBot = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8.01" y2="16" />
    <line x1="16" y1="16" x2="16.01" y2="16" />
  </svg>
);

const IcoImage = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const IcoCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IcoSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const IcoSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spinModal 1s linear infinite" }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export function SettingsModal({
  isOpen,
  onClose,
  userData,
  setUserData,
  voices = [],
  selectedVoice,
  setSelectedVoice,
  pitch,
  setPitch,
  rate,
  setRate,
  speak,
  navigate,
}) {
  const [nameInput, setNameInput] = useState(userData?.assistantName || "Cheeni");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);

  // User Persona Preferences & Memory (Task 29)
  const [responseStyle, setResponseStyle] = useState(userData?.userPreferences?.responseStyle || "balanced");
  const [targetGoal, setTargetGoal] = useState(userData?.userPreferences?.targetGoal || "");
  const [customInstructions, setCustomInstructions] = useState(userData?.userPreferences?.customInstructions || "");
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsSavedSuccess, setPrefsSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleTestVoice = () => {
    if (speak) {
      speak(`Hello. I am ${nameInput}. How does my voice sound?`);
    }
  };

  const handleSaveName = async (e) => {
    e?.preventDefault();
    if (!nameInput.trim()) return;

    setIsSavingName(true);
    setNameSavedSuccess(false);

    try {
      const res = await apiClient.post(`/api/user/update`, { assistantName: nameInput.trim() });
      if (res.data?.user) {
        setUserData(res.data.user);
        setNameSavedSuccess(true);
        setTimeout(() => setNameSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.error("Failed to update assistant name:", err);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSavePreferences = async (e) => {
    e?.preventDefault();
    setIsSavingPrefs(true);
    setPrefsSavedSuccess(false);

    try {
      const userPreferences = {
        responseStyle,
        targetGoal: targetGoal.trim(),
        customInstructions: customInstructions.trim(),
      };
      const res = await apiClient.post(`/api/user/update`, { userPreferences });
      if (res.data?.user) {
        setUserData(res.data.user);
        setPrefsSavedSuccess(true);
        setTimeout(() => setPrefsSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(26, 25, 22, 0.45)",
        backdropFilter: "blur(5px)",
        padding: 16,
        fontFamily: "var(--land-sans)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--land-bg)",
          borderRadius: 14,
          padding: 24,
          boxShadow: "0 20px 48px rgba(26, 25, 22, 0.16)",
          border: "1px solid var(--land-rule)",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--land-rule)",
            paddingBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "var(--land-bg-2)",
                color: "var(--land-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--land-rule)",
              }}
            >
              <IcoSettings />
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "var(--land-serif)",
                  fontSize: 18,
                  fontWeight: 500,
                  margin: 0,
                  color: "var(--land-ink)",
                }}
              >
                Assistant & Voice Settings
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--land-ink-3)" }}>
                Fine-tune voice pitch, cadence, and identity
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "transparent",
              border: "1px solid var(--land-rule)",
              color: "var(--land-ink-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="Close"
            aria-label="Close"
          >
            <IcoClose />
          </button>
        </div>

        {/* SECTION 1: VOICE TUNING */}
        <div
          style={{
            background: "var(--land-bg-2)",
            border: "1px solid var(--land-rule)",
            borderRadius: 10,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--land-accent)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <IcoVolume />
            <span>Voice Tuning</span>
          </div>

          {/* Voice Selector */}
          {voices.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "var(--land-ink-2)" }}>Voice Engine</label>
              <select
                value={selectedVoice?.name || ""}
                onChange={(e) => {
                  const v = voices.find((voice) => voice.name === e.target.value);
                  if (v) setSelectedVoice(v);
                }}
                style={{
                  width: "100%",
                  background: "var(--land-bg)",
                  border: "1px solid var(--land-rule)",
                  color: "var(--land-ink)",
                  fontSize: 13,
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontFamily: "var(--land-sans)",
                  outline: "none",
                }}
              >
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Pitch Slider */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "var(--land-ink-2)" }}>Voice Pitch</span>
              <span style={{ fontFamily: "monospace", color: "var(--land-accent)", fontWeight: 600 }}>
                {pitch.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--land-accent)", cursor: "pointer" }}
              aria-label="Voice pitch"
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--land-ink-3)" }}>
              <span>Deeper (0.8x)</span>
              <span>Natural (1.0x)</span>
              <span>Higher (1.5x)</span>
            </div>
          </div>

          {/* Rate / Speed Slider */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "var(--land-ink-2)" }}>Speaking Speed</span>
              <span style={{ fontFamily: "monospace", color: "var(--land-accent)", fontWeight: 600 }}>
                {rate.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.05"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--land-accent)", cursor: "pointer" }}
              aria-label="Speaking speed"
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--land-ink-3)" }}>
              <span>Slower (0.7x)</span>
              <span>Normal (1.0x)</span>
              <span>Faster (1.3x)</span>
            </div>
          </div>

          {/* Test Voice Button */}
          <button
            type="button"
            onClick={handleTestVoice}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              background: "var(--land-bg)",
              border: "1px solid var(--land-rule)",
              color: "var(--land-ink)",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "var(--land-sans)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <IcoVolume />
            <span>Audition Voice Sample</span>
          </button>
        </div>

        {/* SECTION 2: IDENTITY & AVATAR */}
        <div
          style={{
            background: "var(--land-bg-2)",
            border: "1px solid var(--land-rule)",
            borderRadius: 10,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--land-accent)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <IcoBot />
            <span>Assistant Profile</span>
          </div>

          <form onSubmit={handleSaveName} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Assistant Name..."
              style={{
                flex: 1,
                background: "var(--land-bg)",
                border: "1px solid var(--land-rule)",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 13,
                color: "var(--land-ink)",
                outline: "none",
                fontFamily: "var(--land-sans)",
              }}
            />
            <button
              type="submit"
              disabled={isSavingName || !nameInput.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: "var(--land-accent)",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: isSavingName || !nameInput.trim() ? "not-allowed" : "pointer",
                opacity: !nameInput.trim() ? 0.6 : 1,
              }}
            >
              {isSavingName ? (
                <IcoSpinner />
              ) : nameSavedSuccess ? (
                <>
                  <IcoCheck />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <IcoSave />
                  <span>Save</span>
                </>
              )}
            </button>
          </form>

          {/* Change Avatar Link */}
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/customize");
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              background: "var(--land-bg)",
              border: "1px solid var(--land-rule)",
              color: "var(--land-ink-2)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              fontFamily: "var(--land-sans)",
            }}
          >
            <IcoImage />
            <span>Change Avatar Gallery</span>
          </button>
        </div>

        {/* SECTION 3: USER PERSONA & MEMORY PREFERENCES (Task 29) */}
        <div
          style={{
            background: "var(--land-bg-2)",
            border: "1px solid var(--land-rule)",
            borderRadius: 10,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--land-accent)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <span>🧠 AI Persona & Memory</span>
            </div>
            {prefsSavedSuccess && (
              <span style={{ fontSize: 11, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                <IcoCheck /> Saved
              </span>
            )}
          </div>

          <form onSubmit={handleSavePreferences} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Preferred Style */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--land-ink-2)" }}>Response Style</label>
              <select
                value={responseStyle}
                onChange={(e) => setResponseStyle(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--land-bg)",
                  border: "1px solid var(--land-rule)",
                  color: "var(--land-ink)",
                  fontSize: 13,
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontFamily: "var(--land-sans)",
                  outline: "none",
                }}
              >
                <option value="concise">Concise & Direct (Brief, bulleted answers)</option>
                <option value="balanced">Balanced (Clear answers with code & insights)</option>
                <option value="detailed">Detailed & Thorough (Deep explanations)</option>
                <option value="conversational">Conversational (Warm and friendly companion)</option>
              </select>
            </div>

            {/* Target Goal */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--land-ink-2)" }}>Target Goal / Preparation</label>
              <input
                type="text"
                value={targetGoal}
                onChange={(e) => setTargetGoal(e.target.value)}
                placeholder="e.g. Preparing for Google SDE II interviews (DSA & System Design)"
                style={{
                  background: "var(--land-bg)",
                  border: "1px solid var(--land-rule)",
                  color: "var(--land-ink)",
                  fontSize: 13,
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontFamily: "var(--land-sans)",
                  outline: "none",
                }}
              />
            </div>

            {/* Custom Instructions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--land-ink-2)" }}>Custom Persona Instructions</label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={2}
                placeholder="e.g. Always include time/space complexity and prefer concise TypeScript/Python snippets."
                style={{
                  background: "var(--land-bg)",
                  border: "1px solid var(--land-rule)",
                  color: "var(--land-ink)",
                  fontSize: 13,
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontFamily: "var(--land-sans)",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSavingPrefs}
              style={{
                alignSelf: "flex-end",
                padding: "8px 16px",
                borderRadius: 6,
                background: "var(--land-accent)",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: isSavingPrefs ? "not-allowed" : "pointer",
              }}
            >
              {isSavingPrefs ? (
                <IcoSpinner />
              ) : prefsSavedSuccess ? (
                <>
                  <IcoCheck />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <IcoSave />
                  <span>Save Preferences</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* SECTION 3: SYSTEM INFO */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            padding: "8px 4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--land-accent)" }} />
            <span style={{ color: "var(--land-ink-2)" }}>Agent Core</span>
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--land-ink-3)" }}>
            v3.0 Local Ready
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spinModal {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default SettingsModal;
