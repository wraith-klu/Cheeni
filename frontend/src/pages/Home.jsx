import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { UserDataContext } from "../context/userDataContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import apiClient, { streamAsk } from "../utils/api";


import defaultAvatar from "../assets/image1.jpg";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis";
import { useAgentTelemetry } from "../hooks/useAgentTelemetry";
import { useClock } from "../hooks/useClock";
import { executeAgenticAction } from "../utils/actionRunner";

import ChatDrawer from "../components/ChatDrawer";
import SettingsModal from "../components/SettingsModal";
import InterviewPrepModal from "../components/InterviewPrepModal";
import { AnalyticsDashboard, recordAnalyticsEvent } from "../components/AnalyticsDashboard";
import { PluginManager } from "../components/PluginManager";
import Navbar from "../components/home/Navbar";
import GreetingHeader from "../components/home/GreetingHeader";
import StatusBar from "../components/home/StatusBar";
import OrbSection from "../components/home/OrbSection";
import AgentToolbar from "../components/home/AgentToolbar";
import MicInputBar from "../components/home/MicInputBar";
import CornerCompanion from "../components/home/CornerCompanion";
import OfflineToast from "../components/common/OfflineToast";
import useConnectionStatus from "../hooks/useConnectionStatus";

// In-memory module-level cache for last known good conversation history (session safe, never on disk)
let cachedConversationHistory = null;

/**
 * Main Home Dashboard - Orchestrates Cheeni AI Voice Assistant
 * Modularized into focused components for 40 LPA grade architecture.
 */
function Home() {
  const { serverURL, userData, setUserData, handleLogout: contextLogout } = useContext(UserDataContext);
  const navigate = useNavigate();

  const assistantName = userData?.assistantName || "Cheeni";
  const assistantAvatar = userData?.assistantImage || defaultAvatar;
  const userName = userData?.name ? userData.name.split(" ")[0] : "Friend";

  // Interaction & Conversation states (initialize with in-memory cached data if available)
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [latestReply, setLatestReply] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInterviewPrepOpen, setIsInterviewPrepOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isPluginsOpen, setIsPluginsOpen] = useState(false);
  const [visionResult, setVisionResult] = useState(null); // For screenshot vision (#24)
  const [history, setHistory] = useState(() => cachedConversationHistory || []);
  const [isLoadingHistory, setIsLoadingHistory] = useState(() => !cachedConversationHistory);

  // Boot splash & Fullscreen
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Desktop Corner Companion Mode (only when query param mode=corner or explicitly toggled)
  const [isCornerMode, setIsCornerMode] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "corner" || params.get("mode") === "widget") return true;
      const saved = localStorage.getItem("cheeni_corner_mode");
      if (saved !== null) return saved === "true";
    }
    return false;
  });

  // Custom Hooks
  const { currentTime, currentDate, greeting } = useClock();
  const {
    isAgentConnected,
    telemetry,
    isTelemetryOpen,
    setIsTelemetryOpen,
    handleVolumeChange,
    handleQuickAction,
  } = useAgentTelemetry(serverURL);

  // Fetch Conversation History with in-memory caching and silent reconciliation
  const fetchHistory = useCallback(async () => {
    try {
      if (!cachedConversationHistory) {
        setIsLoadingHistory(true);
      }
      const res = await apiClient.get(`/api/assistant/history`);
      if (res.data?.history) {
        cachedConversationHistory = res.data.history;
        setHistory(res.data.history);
      }
    } catch (err) {
      console.warn("Could not fetch conversation history:", err.message);
      // If network error occurred, mark for reconnection tracking
      if (!err.response) {
        markNetworkError();
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Connection status hook (handles online, reconnecting, offline with backoff)
  const {
    status: connectionStatus,
    isReconnecting,
    triggerRetry,
    markNetworkError,
  } = useConnectionStatus(serverURL, {
    onReconnect: () => {
      fetchHistory();
    },
  });

  // Text-to-Speech Hook
  const {
    speak,
    stop: stopSpeaking,
    isSpeaking,
    isMuted,
    toggleMute,
    voices,
    selectedVoice,
    setSelectedVoice,
    pitch,
    setPitch,
    rate,
    setRate,
  } = useSpeechSynthesis();

  // First Interaction / Load Greeting with Autoplay unlock
  const hasGreetedRef = useRef(false);
  const triggerGreeting = useCallback(() => {
    if (hasGreetedRef.current || isMuted) return;
    hasGreetedRef.current = true;
    try {
      if (window.speechSynthesis?.paused) {
        window.speechSynthesis.resume();
      }
      speak(
        `${greeting}, ${userName}! I'm ${assistantName}, your personal AI assistant. Ready whenever you are.`
      );
    } catch (err) {
      console.warn("Greeting playback error:", err);
    }
  }, [greeting, userName, assistantName, speak, isMuted]);

  useEffect(() => {
    if (hasGreetedRef.current) return;
    const timer = setTimeout(() => triggerGreeting(), 1200);
    const onFirstGesture = () => {
      triggerGreeting();
      window.removeEventListener("click", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
    };
    window.addEventListener("click", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    window.addEventListener("touchstart", onFirstGesture, { once: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
    };
  }, [triggerGreeting]);

  // Initial Fetch on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Vision Intelligence: Take Screenshot and ask Gemini (#24)
  const handleScreenshotVision = useCallback(async (userQuestion) => {
    const question = (userQuestion || "What is on my screen?").trim();
    try {
      const res = await axios.post(`${serverURL}/api/screenshot`, {}, { withCredentials: true });
      if (res.data?.success && res.data?.image_base64) {
        // Forward to AI with the screenshot as context
        const visionPrompt = `[VISION MODE] The user asked: "${question}". I have attached a screenshot of their current screen. Please describe what you see and answer their question based on the screenshot content.\n\n[Screenshot attached: ${res.data.width}x${res.data.height}px]`;
        setVisionResult({ imageBase64: res.data.image_base64, question });
        handleSendPrompt(visionPrompt);
      } else {
        handleSendPrompt(`The user asked: "${question}" but the Desktop Agent screenshot failed. Please let them know the agent needs to be running.`);
      }
    } catch (err) {
      console.warn("Vision screenshot error:", err);
      handleSendPrompt(`Cannot take screenshot — Desktop Agent is not running. ${question}`);
    }
  }, [serverURL]);

  // Send Prompt with Token Streaming, Mid-Stream Disconnect Handling & Structured Actions
  const handleSendPrompt = async (promptText) => {
    const query = (promptText || "").trim();
    if (!query) return;

    // Track analytics event (#26)
    recordAnalyticsEvent("message", { text: query });

    // Optimistically add user bubble
    const userMsg = { role: "user", content: query, timestamp: new Date() };
    setHistory((prev) => {
      const updated = [...prev, userMsg];
      cachedConversationHistory = updated;
      return updated;
    });
    stopSpeaking();

    // Pulse bubble immediately
    setIsThinking(true);
    setIsStreaming(true);
    setStreamingText("");

    let accumulated = "";
    let pendingAction = null;
    let pendingSpeech = "";

    await streamAsk(query, {
      onMeta: (meta) => {
        setIsThinking(false);
        setIsStreaming(true);
        pendingSpeech = (meta.speechText || "").trim();
        pendingAction = meta.action || null;

        if (pendingSpeech) speak(pendingSpeech);
        if (pendingAction) {
          setLastAction(pendingAction);
          executeAgenticAction(pendingAction, serverURL).then((actionResult) => {
            if (pendingAction?.type === "system_status" && actionResult?.battery) {
              const batteryMsg = `Your laptop is currently at ${actionResult.battery.level} percent and ${actionResult.battery.charging}.`;
              speak(batteryMsg);
            }
          });
        }
      },
      onChunk: (text) => {
        accumulated += text;
        setStreamingText(accumulated);
      },
      onDone: () => {
        setIsStreaming(false);
        setStreamingText("");
        const finalText = accumulated.trim() || pendingSpeech || "I'm here to help!";
        const finalSpeech = pendingSpeech || finalText;

        const assistantMsg = {
          role: "assistant",
          content: finalText,
          speechText: finalSpeech,
          action: pendingAction,
          timestamp: new Date(),
        };
        setHistory((prev) => {
          const updated = [...prev, assistantMsg];
          cachedConversationHistory = updated;
          return updated;
        });
        setLatestReply({ speechText: finalSpeech, textResponse: finalText, action: pendingAction });
      },
      onError: (message) => {
        setIsThinking(false);
        setIsStreaming(false);
        setStreamingText("");
        markNetworkError();

        // If the stream dropped mid-flight with partial content, clearly mark it
        const wasInterrupted = accumulated && accumulated.trim().length > 0;
        const fallbackMsg = wasInterrupted
          ? `${accumulated.trim()}\n\n*(Stream interrupted)*`
          : (message || "I'm having a little trouble thinking right now. Please try again!");

        const errorMsgDoc = {
          role: "assistant",
          content: fallbackMsg,
          speechText: wasInterrupted ? "Connection dropped before response finished." : fallbackMsg,
          isIncomplete: wasInterrupted,
          failedPrompt: wasInterrupted ? query : null,
          timestamp: new Date(),
        };

        setHistory((prev) => {
          const updated = [...prev, errorMsgDoc];
          cachedConversationHistory = updated;
          return updated;
        });
        setLatestReply({ speechText: errorMsgDoc.speechText, textResponse: fallbackMsg });
        speak(errorMsgDoc.speechText);
      },
    });
  };

  // Clear History
  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear your conversation history?")) return;
    try {
      await apiClient.delete(`/api/assistant/history`);
      setHistory([]);
      setLatestReply(null);
      setLastAction(null);
    } catch (err) {
      console.error("Error clearing history:", err);
    }
  };

  // Speech-to-Text Recognition Hook
  const {
    isListening,
    transcript,
    error: micError,
    toggleListening,
    resetTranscript,
    requestMicPermission,
  } = useSpeechRecognition({
    onEnd: (finalText) => {
      if (finalText && finalText.trim()) {
        handleSendPrompt(finalText);
        resetTranscript();
      }
    },
  });

  // Corner Companion Mode Helpers
  const toggleCornerMode = () => {
    setIsCornerMode((prev) => {
      const next = !prev;
      localStorage.setItem("cheeni_corner_mode", String(next));
      return next;
    });
  };

  const handleSnapCorner = async () => {
    try {
      await axios.post(
        `${serverURL}/api/agent/windows/snap-corner`,
        { target: "Cheeni", width: 420, height: 750 },
        { withCredentials: true }
      );
    } catch (err) {
      console.warn("Could not snap window to corner:", err);
    }
  };

  useEffect(() => {
    if (isCornerMode && isAgentConnected) {
      const snapTimer = setTimeout(() => handleSnapCorner(), 800);
      return () => clearTimeout(snapTimer);
    }
  }, [isCornerMode, isAgentConnected]);

  // Fullscreen & Boot Splash Handlers
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFSChange);
    return () => document.removeEventListener("fullscreenchange", handleFSChange);
  }, []);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 800);
    const hideTimer = setTimeout(() => setShowSplash(false), 1200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // ── Global Keyboard Shortcuts (#19) ──────────────────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable);

      // 1. Escape: Stop TTS playback & close open drawers/modals
      if (e.key === "Escape") {
        let handled = false;
        if (isSpeaking) {
          stopSpeaking();
          handled = true;
        }
        if (isChatOpen) {
          setIsChatOpen(false);
          handled = true;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          handled = true;
        }
        if (isInterviewPrepOpen) {
          setIsInterviewPrepOpen(false);
          handled = true;
        }
        if (isAnalyticsOpen) {
          setIsAnalyticsOpen(false);
          handled = true;
        }
        if (isPluginsOpen) {
          setIsPluginsOpen(false);
          handled = true;
        }
        if (isTelemetryOpen) {
          setIsTelemetryOpen(false);
          handled = true;
        }
        if (handled) {
          e.preventDefault();
          // Unfocus any active input
          if (isInputFocused && activeEl?.blur) activeEl.blur();
        }
        return;
      }

      // 2. Ctrl+K (or Cmd+K): Focus active text input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const mainInput = document.getElementById("cheeni-main-input");
        const cornerInput = document.getElementById("cheeni-corner-input");
        const drawerInput = document.getElementById("chat-drawer-input");

        if (isChatOpen && drawerInput) {
          drawerInput.focus();
        } else if (isCornerMode && cornerInput) {
          cornerInput.focus();
        } else if (mainInput) {
          mainInput.focus();
        }
        return;
      }

      // 3. Ctrl+Shift+H: Open history / notes drawer
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
        return;
      }

      // 4. Space / Alt+M: Toggle microphone
      // Alt+M works anywhere (even inside input)
      if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        toggleListening();
        return;
      }

      // Space only toggles when NOT actively typing in an input/textarea
      if (e.code === "Space" && !isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleListening();
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    isSpeaking,
    stopSpeaking,
    isChatOpen,
    isSettingsOpen,
    isInterviewPrepOpen,
    isAnalyticsOpen,
    isPluginsOpen,
    isTelemetryOpen,
    setIsTelemetryOpen,
    toggleListening,
    isCornerMode,
  ]);

  const handleLogout = async () => {
    stopSpeaking();
    await contextLogout();
    navigate("/signin");
  };

  // Dynamic Visual Status Tokens
  const getStatus = () => {
    if (isListening) {
      return {
        text: "Listening to your voice...",
        color: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)] animate-pulse",
        ringBorder: "from-rose-500 via-amber-400 to-rose-600",
        glow: "shadow-[0_0_60px_rgba(244,63,94,0.45)]",
        aura: "bg-rose-500/15",
      };
    }
    if (isThinking) {
      return {
        text: "Analyzing & Thinking...",
        color: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-ping",
        ringBorder: "from-amber-400 via-yellow-200 to-amber-600",
        glow: "shadow-[0_0_60px_rgba(251,191,36,0.45)]",
        aura: "bg-amber-500/15",
      };
    }
    if (isStreaming) {
      return {
        text: "Streaming response...",
        color: "bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)] animate-pulse",
        ringBorder: "from-violet-400 via-purple-300 to-indigo-600",
        glow: "shadow-[0_0_60px_rgba(167,139,250,0.45)]",
        aura: "bg-violet-500/15",
      };
    }
    if (isSpeaking) {
      return {
        text: "Speaking sweetly...",
        color: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse",
        ringBorder: "from-emerald-400 via-cyan-300 to-teal-500",
        glow: "shadow-[0_0_65px_rgba(52,211,153,0.5)]",
        aura: "bg-emerald-500/15",
      };
    }
    return {
      text: "Online & Ready",
      color: "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]",
      ringBorder: "from-cyan-400 via-indigo-500 to-purple-600",
      glow: "shadow-[0_0_45px_rgba(6,182,212,0.3)]",
      aura: "bg-cyan-500/10",
    };
  };

  const status = getStatus();

  // Render Corner Companion View
  if (isCornerMode) {
    return (
      <>
        <CornerCompanion
          assistantName={assistantName}
          assistantAvatar={assistantAvatar}
          userName={userName}
          greeting={greeting}
          status={status}
          isAgentConnected={isAgentConnected}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isThinking={isThinking}
          isStreaming={isStreaming}
          streamingText={streamingText}
          transcript={transcript}
          latestReply={latestReply}
          lastAction={lastAction}
          micError={micError}
          history={history}
          isMuted={isMuted}
          showSplash={showSplash}
          splashFading={splashFading}
          onSplashClick={() => {
            setSplashFading(true);
            setTimeout(() => setShowSplash(false), 200);
            triggerGreeting();
          }}
          onSnapCorner={handleSnapCorner}
          onToggleMute={toggleMute}
          onOpenChat={() => setIsChatOpen(true)}
          onToggleCornerMode={toggleCornerMode}
          onToggleListening={toggleListening}
          onRequestMicPermission={requestMicPermission}
          onSendPrompt={handleSendPrompt}
        />

        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          history={history}
          onSendMessage={handleSendPrompt}
          onClearHistory={handleClearHistory}
          isThinking={isThinking}
          isStreaming={isStreaming}
          streamingText={streamingText}
          onSpeak={speak}
          assistantName={assistantName}
          assistantAvatar={assistantAvatar}
          isLoadingHistory={isLoadingHistory}
          isReconnecting={isReconnecting}
        />

        <OfflineToast status={connectionStatus} onRetry={triggerRetry} />
      </>
    );
  }

  // Render Full Dashboard View
  return (
    <div style={{ background: "var(--land-bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Boot splash */}
      {showSplash && (
        <div
          onClick={() => { setSplashFading(true); setTimeout(() => setShowSplash(false), 200); triggerGreeting(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "var(--land-bg)", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            opacity: splashFading ? 0 : 1, transition: "opacity 0.4s",
          }}
        >
          <p style={{ fontFamily: "var(--land-serif)", fontSize: 28, fontWeight: 400, color: "var(--land-ink)", letterSpacing: "-0.02em", marginBottom: 12 }}>
            {assistantName} is waking up…
          </p>
          <p style={{ fontFamily: "var(--land-sans)", fontSize: 13, color: "var(--land-ink-3)" }}>Tap anywhere to begin</p>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        assistantName={assistantName}
        assistantAvatar={assistantAvatar}
        status={status}
        currentTime={currentTime}
        currentDate={currentDate}
        isAgentConnected={isAgentConnected}
        isMuted={isMuted}
        isTelemetryOpen={isTelemetryOpen}
        onToggleTelemetry={() => setIsTelemetryOpen(!isTelemetryOpen)}
        onOpenInterviewPrep={() => setIsInterviewPrepOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onOpenPlugins={() => setIsPluginsOpen(true)}
        chatCount={history.filter((m) => m.role === "assistant").length}
        onToggleMute={toggleMute}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNavigateLanding={() => navigate("/")}
        onToggleCornerMode={toggleCornerMode}
        onLogout={handleLogout}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isThinking={isThinking}
        isStreaming={isStreaming}
      />

      {/* Live OS Telemetry Status Bar */}
      <StatusBar
        isOpen={isTelemetryOpen}
        isAgentConnected={isAgentConnected}
        telemetry={telemetry}
        onVolumeChange={handleVolumeChange}
        onQuickAction={handleQuickAction}
      />

      {/* Centerpiece (Mobile first responsive layout) */}
      <main
        className="w-full flex-1 flex flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-8 md:py-10 max-w-2xl mx-auto"
        style={{ width: "100%" }}
      >
        <GreetingHeader greeting={greeting} userName={userName} showSplash={showSplash} />

        <OrbSection
          assistantName={assistantName}
          assistantAvatar={assistantAvatar}
          status={status}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isThinking={isThinking}
          isStreaming={isStreaming}
          transcript={transcript}
          streamingText={streamingText}
          latestReply={latestReply}
          lastAction={lastAction}
          onTriggerGreeting={triggerGreeting}
          onToggleListening={toggleListening}
          onStopSpeaking={stopSpeaking}
          onExecuteAction={() => executeAgenticAction(lastAction, serverURL)}
        />

        <AgentToolbar
          onSendPrompt={handleSendPrompt}
          onOpenInterviewPrep={() => setIsInterviewPrepOpen(true)}
          onScreenshotVision={handleScreenshotVision}
        />

      </main>

      {/* Bottom Floating Mic & Text Input Dock */}
      <MicInputBar
        assistantName={assistantName}
        isListening={isListening}
        isThinking={isThinking}
        isStreaming={isStreaming}
        onToggleListening={toggleListening}
        onSendPrompt={handleSendPrompt}
      />

      {/* Slide-over Drawers (Chat & Settings) */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        history={history}
        onSendMessage={handleSendPrompt}
        onClearHistory={handleClearHistory}
        isThinking={isThinking}
        isStreaming={isStreaming}
        streamingText={streamingText}
        onSpeak={speak}
        assistantName={assistantName}
        assistantAvatar={assistantAvatar}
        isLoadingHistory={isLoadingHistory}
        isReconnecting={isReconnecting}
      />

      {/* Offline Mode Toast with Instant Manual Retry */}
      <OfflineToast status={connectionStatus} onRetry={triggerRetry} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userData={userData}
        setUserData={setUserData}
        voices={voices}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        pitch={pitch}
        setPitch={setPitch}
        rate={rate}
        setRate={setRate}
        speak={speak}
        navigate={navigate}
      />

      {/* Dedicated Interview Prep Studio (#17) */}
      <InterviewPrepModal
        isOpen={isInterviewPrepOpen}
        onClose={() => setIsInterviewPrepOpen(false)}
        assistantName={assistantName}
        onAskCheeni={(prompt) => {
          handleSendPrompt(prompt);
          setIsChatOpen(true);
        }}
      />

      {/* Analytics Dashboard (#26) */}
      <AnalyticsDashboard
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />

      {/* Plugin / Skill Manager (#25) */}
      <PluginManager
        isOpen={isPluginsOpen}
        onClose={() => setIsPluginsOpen(false)}
        onSkillInvoke={(prompt) => {
          handleSendPrompt(prompt);
          setIsChatOpen(true);
        }}
      />
    </div>
  );
}

export default Home;