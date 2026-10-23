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
import { commandAliasStorageKey, commandAliasToolCall, matchCommandAlias, readCommandAliases } from "../utils/commandAliases";

import ChatDrawer from "../components/ChatDrawer";
import SettingsModal from "../components/SettingsModal";
import InterviewPrepModal from "../components/InterviewPrepModal";
import { AnalyticsDashboard, recordAnalyticsEvent } from "../components/AnalyticsDashboard";
import { PluginManager } from "../components/PluginManager";
import ReminderManager from "../components/ReminderManager";
import BrowserWorkflowModal from "../components/BrowserWorkflowModal";
import IntegrationsPanel, { useIntegrationCount } from "../components/IntegrationsPanel";
import Navbar from "../components/home/Navbar";
import GreetingHeader from "../components/home/GreetingHeader";
import StatusBar from "../components/home/StatusBar";
import OrbSection from "../components/home/OrbSection";
import AgentToolbar from "../components/home/AgentToolbar";
import MicInputBar from "../components/home/MicInputBar";
import CornerCompanion from "../components/home/CornerCompanion";
import TaskPlanCard from "../components/home/TaskPlanCard";
import OfflineToast from "../components/common/OfflineToast";
import { ScreenVisionModal } from "../components/home/ScreenVisionModal";
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
  const [taskPlan, setTaskPlan] = useState(null);
  const [taskActionBusy, setTaskActionBusy] = useState("");
  const [lastAction, setLastAction] = useState(null);
  const [actionExecution, setActionExecution] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInterviewPrepOpen, setIsInterviewPrepOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isPluginsOpen, setIsPluginsOpen] = useState(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const integrationCount = useIntegrationCount();
  const [isVisionModalOpen, setIsVisionModalOpen] = useState(false);
  const [visionModalQuestion, setVisionModalQuestion] = useState("");
  const [pendingVoiceTranscript, setPendingVoiceTranscript] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState(() => localStorage.getItem("cheeni_voice_language") === "hi-IN" ? "hi-IN" : "en-IN");
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

  useEffect(() => {
    apiClient.get("/api/tasks").then((response) => {
      if (response.data?.tasks?.length) setTaskPlan(response.data.tasks[0]);
    }).catch(() => {});
  }, []);

  // On-demand screen analysis — opens consent modal; actual capture happens on confirm.
  const handleScreenshotVision = useCallback((userQuestion) => {
    setVisionModalQuestion((userQuestion || "What is on my screen right now?").trim());
    setIsVisionModalOpen(true);
  }, []);

  // Called by ScreenVisionModal after user confirms consent and provides question.
  const handleVisionConfirm = useCallback(async (question, signal) => {
    setIsThinking(true);
    stopSpeaking();
    try {
      const res = await axios.post(
        `${serverURL}/api/agent/vision`,
        { question },
        { withCredentials: true, timeout: 45000, signal }
      );
      if (!res.data?.success || !res.data?.observation) throw new Error(res.data?.error || "The vision model returned no analysis.");
      setLatestReply({ speechText: res.data.observation, textResponse: res.data.observation });
      setHistory((prev) => {
        const updated = [
          ...prev,
          { role: "user", content: `🔍 [Screen Vision] ${question}`, timestamp: new Date() },
          { role: "assistant", content: res.data.observation, timestamp: new Date() },
        ];
        cachedConversationHistory = updated;
        return updated;
      });
      speak(res.data.observation);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      console.warn("Vision screenshot error:", err);
      const message = err.response?.data?.message || err.response?.data?.error || err.message || "Screen analysis failed.";
      setLatestReply({ speechText: message, textResponse: message });
    } finally {
      setIsThinking(false);
    }
  }, [serverURL, speak, stopSpeaking]);

  // Send Prompt with Token Streaming, Mid-Stream Disconnect Handling & Structured Actions
  const handleTaskPlanAction = async (action) => {
    if (!taskPlan || (taskActionBusy && !["pause", "cancel"].includes(action))) return;
    setTaskActionBusy(action);
    try {
      const body = action === "approve" ? { planDigest: taskPlan.planDigest } : {};
      const response = await apiClient.post(`/api/tasks/${taskPlan.id}/${action}`, body);
      if (response.data?.task) setTaskPlan(response.data.task);
    } catch (error) {
      const message = error.response?.data?.message || "Task update failed. Refresh the task status before trying again.";
      setLatestReply({ speechText: message, textResponse: message });
    } finally {
      setTaskActionBusy("");
    }
  };

  const handleSendPrompt = async (promptText) => {
    const query = (promptText || "").trim();
    if (!query) return;
    setActionExecution(null);
    setLastAction(null);

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

    const aliasStorageKey = commandAliasStorageKey(userData?._id || userData?.id || "local");
    const matchedAlias = matchCommandAlias(query, readCommandAliases(aliasStorageKey));
    const aliasToolCall = matchedAlias ? commandAliasToolCall(matchedAlias) : null;
    if (aliasToolCall) {
      setIsThinking(true);
      setIsStreaming(false);
      setStreamingText("");
      try {
        const response = await axios.post(
          `${serverURL}/api/assistant/aliases/execute`,
          { prompt: query, ...aliasToolCall },
          { withCredentials: true, timeout: 12000 }
        );
        const assistantMessage = response.data?.assistantMessage;
        const speechText = response.data?.speechText || response.data?.textResponse;
        if (!response.data?.success || !assistantMessage || !speechText) throw new Error("The saved command did not return a verified result.");
        setHistory((previous) => {
          const updated = [...previous, assistantMessage];
          cachedConversationHistory = updated;
          return updated;
        });
        const aliasAction = { type: matchedAlias.type, label: `Opening ${matchedAlias.phrase}` };
        setLastAction(aliasAction);
        setActionExecution({ status: "succeeded", retryable: false });
        setLatestReply({ speechText, textResponse: response.data.textResponse, action: aliasAction });
        speak(speechText);
      } catch (error) {
        const isHindi = /[\u0900-\u097F]/.test(query);
        const errorText = isHindi
          ? "माफ़ कीजिए, आपका सेव किया हुआ कमांड पूरा नहीं हो पाया।"
          : "Sorry, the saved command could not be completed.";
        setHistory((previous) => {
          const updated = [...previous, { role: "assistant", content: errorText, speechText: errorText, timestamp: new Date() }];
          cachedConversationHistory = updated;
          return updated;
        });
        setLatestReply({ speechText: errorText, textResponse: errorText });
        setActionExecution({ status: "failed", retryable: false, error: error.response?.data?.message || error.message });
        speak(errorText);
        console.warn("Saved alias request failed:", error.response?.data?.message || error.message);
      } finally {
        setIsThinking(false);
      }
      return;
    }

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
        if (meta.plan) setTaskPlan(meta.plan);

        if (pendingSpeech) speak(pendingSpeech);
        if (pendingAction) {
          setLastAction(pendingAction);
          setActionExecution({ status: "running", retryable: false });
          executeAgenticAction(pendingAction, serverURL).then((actionResult) => {
            setActionExecution(actionResult);
            const battery = actionResult?.data?.battery || actionResult?.battery;
            if (pendingAction?.type === "system_status" && battery) {
              const batteryMsg = `Your laptop is currently at ${battery.level} percent and ${battery.charging}.`;
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

  // Voice Confirmation State ('idle' | 'asking' | 'awaiting_reply')
  const [voiceConfirmState, setVoiceConfirmState] = useState("idle");
  const voiceConfirmStateRef = useRef("idle");
  const pendingTranscriptRef = useRef("");
  const confirmTimeoutRef = useRef(null);

  // Synchronize ref with state
  useEffect(() => {
    voiceConfirmStateRef.current = voiceConfirmState;
  }, [voiceConfirmState]);

  // Callback refs to decouple useSpeechRecognition from downstream handlers (prevents TDZ)
  const handleVoiceResultRef = useRef(null);
  const handleVoiceEndRef = useRef(null);

  // Speech-to-Text Recognition Hook (declared before handlers so startListening/stopListening are in scope)
  const {
    isListening,
    transcript,
    error: micError,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    requestMicPermission,
  } = useSpeechRecognition({
    lang: voiceLanguage,
    onResult: (text) => handleVoiceResultRef.current?.(text),
    onEnd: (text) => handleVoiceEndRef.current?.(text),
  });

  // Flag to lock out trailing speech events while executing a confirmed prompt
  const isExecutingConfirmedRef = useRef(false);

  // Voice Confirmation Reply Handler (checks for yes / no / confirmation phrases)
  const handleVoiceConfirmationReply = useCallback((replyText) => {
    const activePending = (pendingTranscriptRef.current || pendingVoiceTranscript || "").trim();
    if (!activePending) return false;
    if (!replyText || !replyText.trim()) return false;

    const clean = replyText.trim().toLowerCase();

    // 1. Check for affirmative reply: "yes", "yes this", "yes please", "yes that's right", "haan sahi hai", etc.
    const isYes = /\b(yes|yeah|yep|yup|correct|sure|proceed|confirm|confirmed|go ahead|do it|okay|ok|haan|sahi|bilkul|theek|ha|execute|right|true|kar do|chalao)\b/i.test(clean);

    // 2. Check for negative reply: "no", "cancel", "wrong", "galat", "stop", etc.
    const isNo = /\b(no|nope|nah|cancel|stop|wrong|incorrect|dont|don't|nahi|na|galat|mat karo)\b/i.test(clean);

    if (isYes && !isNo) {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      isExecutingConfirmedRef.current = true;
      voiceConfirmStateRef.current = "idle";
      setVoiceConfirmState("idle");
      stopSpeaking();
      stopListening({ discard: true });

      const phraseToExecute = activePending;
      setPendingVoiceTranscript("");
      pendingTranscriptRef.current = "";
      resetTranscript();

      // EXECUTE IMMEDIATELY — NEVER GATE ON TTS onEnd!
      handleSendPrompt(phraseToExecute);

      const isHindi = voiceLanguage === "hi-IN";
      speak(isHindi ? "Theek hai, execute kar rahi hoon." : "Executing now.");

      setTimeout(() => {
        isExecutingConfirmedRef.current = false;
      }, 1500);

      return true;
    }

    if (isNo) {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      voiceConfirmStateRef.current = "idle";
      setVoiceConfirmState("idle");
      stopSpeaking();
      stopListening({ discard: true });
      setPendingVoiceTranscript("");
      pendingTranscriptRef.current = "";
      resetTranscript();

      const isHindi = voiceLanguage === "hi-IN";
      speak(isHindi ? "Theek hai, cancel kar diya." : "Cancelled.");
      return true;
    }

    // 3. User spoke a brand new replacement sentence (neither yes nor no) while review dialog is open
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && !isYes && !isNo) {
      const newPhrase = replyText.trim();
      pendingTranscriptRef.current = newPhrase;
      setPendingVoiceTranscript(newPhrase);
      startVoiceConfirmation(newPhrase);
      return true;
    }

    return false;
  }, [pendingVoiceTranscript, voiceLanguage, stopListening, stopSpeaking, resetTranscript, handleSendPrompt, speak]);

  // Start Voice Confirmation: Cheeni asks aloud, then triggers listening for "yes" / "no"
  const startVoiceConfirmation = useCallback((phrase) => {
    const textToAsk = (phrase || "").trim();
    if (!textToAsk) return;

    // Reject standalone confirmation words from ever creating a review prompt
    const cleanLower = textToAsk.toLowerCase();
    if (/^(yes|yeah|yep|yup|correct|sure|haan|sahi|bilkul|theek|execute|proceed|ok|okay)(\s+(this|it|please|that|one))?$/i.test(cleanLower)) {
      return;
    }

    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }

    // Immediately stop microphone so Cheeni does not pick up her own voice
    stopListening({ discard: true });

    voiceConfirmStateRef.current = "asking";
    setVoiceConfirmState("asking");

    const isHindi = voiceLanguage === "hi-IN";
    const question = isHindi
      ? `Maine suna: "${textToAsk}". Kya yeh sahi hai?`
      : `I heard: "${textToAsk}". Is that correct?`;

    const openMicForReply = () => {
      voiceConfirmStateRef.current = "awaiting_reply";
      setVoiceConfirmState("awaiting_reply");
      setTimeout(() => {
        startListening();
      }, 100);

      // Safety timeout: stop listening after 15s if user doesn't respond
      confirmTimeoutRef.current = setTimeout(() => {
        if (voiceConfirmStateRef.current === "awaiting_reply") {
          voiceConfirmStateRef.current = "idle";
          setVoiceConfirmState("idle");
          stopListening();
        }
      }, 15000);
    };

    // If muted or TTS unavailable in browser, skip speech and listen immediately
    if (isMuted || !("speechSynthesis" in window)) {
      openMicForReply();
      return;
    }

    // Safety fallback: if onEnd doesn't fire within 6s (common Chrome TTS quirk), open mic anyway
    const ttsSafetyTimer = setTimeout(() => {
      if (voiceConfirmStateRef.current === "asking") {
        openMicForReply();
      }
    }, 6000);

    speak(question, {
      onEnd: () => {
        clearTimeout(ttsSafetyTimer);
        openMicForReply();
      },
      onError: () => {
        clearTimeout(ttsSafetyTimer);
        openMicForReply();
      },
    });
  }, [voiceLanguage, isMuted, speak, startListening, stopListening]);

  // Wire recognition callbacks to current handlers
  handleVoiceResultRef.current = (currentText) => {
    if (isExecutingConfirmedRef.current) return;
    const hasActiveReview = Boolean(pendingTranscriptRef.current || pendingVoiceTranscript);
    if (hasActiveReview) {
      handleVoiceConfirmationReply(currentText);
    }
  };

  handleVoiceEndRef.current = (finalText) => {
    if (!finalText || !finalText.trim()) return;
    if (isExecutingConfirmedRef.current) return;

    const clean = finalText.trim().toLowerCase();
    const isIsolatedConfirmWord = /^(yes|yeah|yep|yup|correct|sure|haan|sahi|bilkul|theek|execute|proceed|ok|okay)(\s+(this|it|please|that|one))?$/i.test(clean);

    const hasActiveReview = Boolean(pendingTranscriptRef.current || pendingVoiceTranscript);
    if (hasActiveReview) {
      handleVoiceConfirmationReply(finalText);
    } else if (!isIsolatedConfirmWord) {
      const phrase = finalText.trim();
      pendingTranscriptRef.current = phrase;
      setPendingVoiceTranscript(phrase);
      startVoiceConfirmation(phrase);
    }
  };

  const cancelVoiceReview = () => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    voiceConfirmStateRef.current = "idle";
    setVoiceConfirmState("idle");
    setPendingVoiceTranscript("");
    pendingTranscriptRef.current = "";
    stopSpeaking();
    stopListening();
    resetTranscript();
  };

  const submitVoiceReview = () => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    voiceConfirmStateRef.current = "idle";
    setVoiceConfirmState("idle");
    stopSpeaking();
    stopListening();
    const reviewedText = (pendingVoiceTranscript || pendingTranscriptRef.current || "").trim();
    cancelVoiceReview();
    if (reviewedText) handleSendPrompt(reviewedText);
  };

  const voiceReviewDialog = pendingVoiceTranscript ? (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(0,0,0,.65)",
        backdropFilter: "blur(4px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-review-title"
        style={{
          width: "min(540px, 100%)",
          padding: 24,
          borderRadius: 20,
          background: "var(--land-bg)",
          color: "var(--land-ink)",
          border: "1px solid var(--land-rule)",
          boxShadow: "0 28px 80px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 id="voice-review-title" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            Review what Cheeni heard
          </h2>
          {voiceConfirmState === "awaiting_reply" && (
            <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              Listening
            </span>
          )}
        </div>

        {/* Live Voice Status Indicator */}
        {voiceConfirmState === "asking" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.25)", color: "#2563eb", fontSize: 13, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🔊</span>
            <span>Cheeni is asking: <em>"{pendingVoiceTranscript}" — is that correct?</em></span>
          </div>
        )}

        {voiceConfirmState === "awaiting_reply" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#059669", fontSize: 13, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🎙️</span>
            <span>Say <strong>"Yes"</strong> to execute, or <strong>"No"</strong> to cancel.</span>
          </div>
        )}

        {voiceConfirmState === "idle" && (
          <p style={{ color: "var(--land-ink-3)", fontSize: 13, marginTop: 4, marginBottom: 14 }}>
            Edit the transcript if needed, or say <strong>"Yes"</strong> / <strong>"No"</strong> to confirm.
          </p>
        )}

        <textarea
          autoFocus
          rows={4}
          value={pendingVoiceTranscript}
          onChange={(event) => {
            setPendingVoiceTranscript(event.target.value);
            pendingTranscriptRef.current = event.target.value;
          }}
          aria-label="Recognized voice request"
          style={{
            width: "100%",
            resize: "vertical",
            padding: 12,
            borderRadius: 12,
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--land-ink)",
            background: "var(--land-bg)",
            border: "1px solid var(--land-rule)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 18 }}>
          <div>
            {voiceConfirmState === "idle" && (
              <button
                type="button"
                onClick={() => startVoiceConfirmation(pendingVoiceTranscript)}
                style={{
                  fontSize: 12,
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--land-rule)",
                  background: "transparent",
                  color: "var(--land-ink)",
                  cursor: "pointer",
                }}
              >
                🎙️ Ask again
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={cancelVoiceReview}
              style={{
                fontSize: 13,
                padding: "8px 16px",
                borderRadius: 10,
                border: "1px solid var(--land-rule)",
                background: "transparent",
                color: "var(--land-ink)",
                cursor: "pointer",
              }}
            >
              Cancel (No)
            </button>
            <button
              type="button"
              onClick={submitVoiceReview}
              disabled={!pendingVoiceTranscript.trim()}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 18px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                cursor: pendingVoiceTranscript.trim() ? "pointer" : "not-allowed",
                opacity: pendingVoiceTranscript.trim() ? 1 : 0.6,
              }}
            >
              Send to Cheeni (Yes)
            </button>
          </div>
        </div>
      </section>
    </div>
  ) : null;

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
        {voiceReviewDialog}
        <ReminderManager
          key={userData?._id || userData?.id || "local"}
          storageKey={`cheeni_reminders_v1_${userData?._id || userData?.id || "local"}`}
          isOpen={isRemindersOpen}
          onClose={() => setIsRemindersOpen(false)}
        />
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
          taskPlan={taskPlan}
          taskActionBusy={taskActionBusy}
          onTaskPlanAction={handleTaskPlanAction}
          lastAction={lastAction}
          actionExecution={actionExecution}
          micError={micError}
          voiceLanguage={voiceLanguage}
          onVoiceLanguageChange={(language) => {
            setVoiceLanguage(language);
            localStorage.setItem("cheeni_voice_language", language);
          }}
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
      {voiceReviewDialog}
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
        onOpenIntegrations={() => setIsIntegrationsOpen(true)}
        integrationCount={integrationCount}
        onOpenBrowser={() => setIsBrowserOpen(true)}
        onOpenReminders={() => setIsRemindersOpen(true)}
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
          actionExecution={actionExecution}
          voiceLanguage={voiceLanguage}
          onTriggerGreeting={triggerGreeting}
          onToggleListening={toggleListening}
          onStopSpeaking={stopSpeaking}
        />

        <AgentToolbar
          onSendPrompt={handleSendPrompt}
          onOpenInterviewPrep={() => setIsInterviewPrepOpen(true)}
          onScreenshotVision={handleScreenshotVision}
        />

      </main>

      <div className="w-full max-w-2xl mx-auto px-4">
        <TaskPlanCard task={taskPlan} busyAction={taskActionBusy} onAction={handleTaskPlanAction} />
      </div>

      {/* Bottom Floating Mic & Text Input Dock */}
      <MicInputBar
        assistantName={assistantName}
        isListening={isListening}
        isThinking={isThinking}
        isStreaming={isStreaming}
        onToggleListening={toggleListening}
        voiceLanguage={voiceLanguage}
        onVoiceLanguageChange={(language) => {
          setVoiceLanguage(language);
          localStorage.setItem("cheeni_voice_language", language);
        }}
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
        aliasStorageKey={commandAliasStorageKey(userData?._id || userData?.id || "local")}
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
      <ReminderManager
        key={userData?._id || userData?.id || "local"}
        storageKey={`cheeni_reminders_v1_${userData?._id || userData?.id || "local"}`}
        isOpen={isRemindersOpen}
        onClose={() => setIsRemindersOpen(false)}
      />
      <BrowserWorkflowModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
      />

      {/* Phase 7 — Connected Services Panel */}
      <IntegrationsPanel
        isOpen={isIntegrationsOpen}
        onClose={() => setIsIntegrationsOpen(false)}
      />

      {/* Phase 6 — Screen Vision consent & capture modal */}
      <ScreenVisionModal
        isOpen={isVisionModalOpen}
        defaultQuestion={visionModalQuestion}
        onConfirm={handleVisionConfirm}
        onClose={() => setIsVisionModalOpen(false)}
      />
    </div>
  );
}

export default Home;
