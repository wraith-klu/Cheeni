import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { UserDataContext } from "../context/userDataContext";

/**
 * Cheeni JARVIS-Lite Unified Agent Dashboard (V16)
 *
 * Full control center featuring:
 * - Live agent connection & Voice State FSM
 * - Real-time system telemetry (CPU, RAM, Battery, Volume)
 * - Remote command execution (no microphone required)
 * - 1-Click quick actions (lock, mute, desktop, screenshot, speak)
 * - Personal Memory browser & semantic recall tester
 * - Screen vision grounding & autonomous goal trigger
 */
export default function AgentDashboard() {
  const { serverURL } = useContext(UserDataContext);

  // Connection & Telemetry State
  const [isConnected, setIsConnected] = useState(false);
  const [agentName, setAgentName] = useState("Sam");
  const [voiceState, setVoiceState] = useState("IDLE");
  const [llmBackend, setLlmBackend] = useState("Node Backend");
  const [telemetry, setTelemetry] = useState({
    cpu: 0,
    ram: 0,
    battery: null,
    isCharging: false,
    volume: 50,
    isMuted: false,
    screenResolution: "1920x1080",
  });

  // Remote Command State
  const [commandInput, setCommandInput] = useState("");
  const [isExecutingCmd, setIsExecutingCmd] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);

  // Memory Browser State
  const [memoryTab, setMemoryTab] = useState("shortcuts"); // "shortcuts" | "preferences" | "search"
  const [shortcuts, setShortcuts] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [memoryStats, setMemoryStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingMemory, setIsSearchingMemory] = useState(false);

  // New Memory Inputs
  const [newShortcutPhrase, setNewShortcutPhrase] = useState("");
  const [newShortcutTarget, setNewShortcutTarget] = useState("");
  const [newPrefCategory, setNewPrefCategory] = useState("preference");
  const [newPrefKey, setNewPrefKey] = useState("");
  const [newPrefValue, setNewPrefValue] = useState("");

  // Screen Vision & Goal State
  const [screenGoalInput, setScreenGoalInput] = useState("");
  const [isGoalRunning, setIsGoalRunning] = useState(false);
  const [goalResult, setGoalResult] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);

  // Spoken feedback
  const [speakInput, setSpeakInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // WebSocket Ref
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // ── Establish WebSocket to Desktop Agent ─────────────────────────────────────
  useEffect(() => {
    let unmounted = false;

    const connectWS = async () => {
      try {
        let wsUrl = "ws://127.0.0.1:2026/ws";
        try {
          const configRes = await axios.get("/api/agent/ws-config", { withCredentials: true, timeout: 2000 });
          if (configRes.data?.wsUrl) {
            wsUrl = configRes.data.wsUrl;
          }
        } catch {
          // Fallback to direct url if proxy route unavailable
        }

        if (unmounted) return;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.event === "connected" || data.event === "telemetry") {
              setIsConnected(true);
              if (data.agent_name) setAgentName(data.agent_name);
              if (data.voice_state) setVoiceState(data.voice_state);
              if (data.llm_backend) setLlmBackend(data.llm_backend);
              setTelemetry((prev) => ({
                ...prev,
                cpu: data.cpu?.usage_percent ?? prev.cpu,
                ram: data.ram?.usage_percent ?? prev.ram,
                battery: data.battery?.level ?? prev.battery,
                isCharging: data.battery?.charging === "Charging",
                volume: data.volume ?? prev.volume,
                isMuted: data.is_muted ?? prev.isMuted,
              }));
            } else if (data.event === "llm_backend") {
              if (data.active) setLlmBackend(data.active);
            } else if (data.event === "voice_state") {
              setVoiceState(data.state);
            } else if (data.event === "tool_executing") {
              setVoiceState("PROCESSING");
            } else if (data.event === "tool_result") {
              setVoiceState("IDLE");
            } else if (data.event === "command_result") {
              setIsExecutingCmd(false);
              setCommandHistory((prev) => [
                {
                  id: Date.now(),
                  time: new Date().toLocaleTimeString(),
                  text: data.intent || "Command",
                  success: data.success,
                  speech: data.speech,
                  elapsed_ms: data.elapsed_ms || 120,
                },
                ...prev.slice(0, 19),
              ]);
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          if (unmounted) return;
          setIsConnected(false);
          // Try reconnecting in 3 seconds
          reconnectTimeoutRef.current = setTimeout(connectWS, 3000);
        };

        ws.onerror = () => {
          if (unmounted) return;
          setIsConnected(false);
        };
      } catch {
        setIsConnected(false);
      }
    };

    connectWS();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // ── Initial Fetch & Memory Load ──────────────────────────────────────────────
  const loadMemoryData = useCallback(async () => {
    try {
      const res = await axios.get(`${serverURL}/api/agent/memory/all`, { withCredentials: true });
      if (res.data?.success) {
        setShortcuts(res.data.shortcuts || []);
        setPreferences(res.data.preferences || []);
        setMemoryStats(res.data.stats || null);
      }
    } catch {
      // Fallback direct agent call if node bridge is starting
      try {
        const direct = await axios.get("http://127.0.0.1:2026/api/agent/memory/all");
        if (direct.data?.success) {
          setShortcuts(direct.data.shortcuts || []);
          setPreferences(direct.data.preferences || []);
          setMemoryStats(direct.data.stats || null);
        }
      } catch {
        // Silent catch
      }
    }
  }, [serverURL]);

  useEffect(() => {
    loadMemoryData();
  }, [loadMemoryData]);

  // ── Remote Command Execution ─────────────────────────────────────────────────
  const handleSendCommand = async (cmdText) => {
    const textToRun = cmdText || commandInput;
    if (!textToRun.trim() || isExecutingCmd) return;

    setIsExecutingCmd(true);
    setCommandInput("");

    // Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "command", text: textToRun }));
    } else {
      // Fallback via HTTP API
      try {
        const res = await axios.post(
          `${serverURL}/api/agent/remote/command`,
          { text: textToRun },
          { withCredentials: true }
        );
        const data = res.data;
        setCommandHistory((prev) => [
          {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            text: textToRun,
            success: data.success,
            speech: data.speech,
            elapsed_ms: data.elapsed_ms || 150,
          },
          ...prev.slice(0, 19),
        ]);
      } catch (err) {
        setCommandHistory((prev) => [
          {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            text: textToRun,
            success: false,
            speech: err.response?.data?.message || "Execution error.",
            elapsed_ms: 0,
          },
          ...prev.slice(0, 19),
        ]);
      } finally {
        setIsExecutingCmd(false);
      }
    }
  };

  // ── Quick Action Handler ─────────────────────────────────────────────────────
  const handleQuickAction = async (action) => {
    try {
      if (action === "screenshot") {
        setIsTakingScreenshot(true);
        const res = await axios.post(`${serverURL}/api/agent/quick-action`, { action: "screenshot" }, { withCredentials: true });
        if (res.data?.image_base64) {
          setScreenshotPreview(`data:image/jpeg;base64,${res.data.image_base64}`);
        }
        setIsTakingScreenshot(false);
        return;
      }
      await axios.post(`${serverURL}/api/agent/quick-action`, { action }, { withCredentials: true });
    } catch (err) {
      console.warn(`Quick action ${action} failed:`, err);
      setIsTakingScreenshot(false);
    }
  };

  // ── Direct TTS Speaking ──────────────────────────────────────────────────────
  const handleDirectSpeak = async () => {
    if (!speakInput.trim() || isSpeaking) return;
    setIsSpeaking(true);
    try {
      await axios.post(`${serverURL}/api/agent/speak`, { text: speakInput }, { withCredentials: true });
      setSpeakInput("");
    } catch (err) {
      console.warn("Speak error:", err);
    } finally {
      setIsSpeaking(false);
    }
  };

  // ── Memory Management Handlers ───────────────────────────────────────────────
  const handleAddShortcut = async (e) => {
    e.preventDefault();
    if (!newShortcutPhrase.trim() || !newShortcutTarget.trim()) return;
    try {
      await axios.post(
        `${serverURL}/api/agent/memory/shortcut`,
        { phrase: newShortcutPhrase, target: newShortcutTarget },
        { withCredentials: true }
      );
      setNewShortcutPhrase("");
      setNewShortcutTarget("");
      loadMemoryData();
    } catch (err) {
      console.error("Failed to save shortcut:", err);
      alert("Failed to save shortcut.");
    }
  };

  const handleDeleteShortcut = async (phrase) => {
    try {
      await axios.delete(`${serverURL}/api/agent/memory/shortcut?phrase=${encodeURIComponent(phrase)}`, { withCredentials: true });
      loadMemoryData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPreference = async (e) => {
    e.preventDefault();
    if (!newPrefKey.trim() || !newPrefValue.trim()) return;
    try {
      await axios.post(
        `${serverURL}/api/agent/memory/preference`,
        { category: newPrefCategory, key: newPrefKey, value: newPrefValue },
        { withCredentials: true }
      );
      setNewPrefKey("");
      setNewPrefValue("");
      loadMemoryData();
    } catch (err) {
      console.error("Failed to save preference:", err);
      alert("Failed to save preference.");
    }
  };

  const handleDeletePreference = async (category, key) => {
    try {
      await axios.delete(
        `${serverURL}/api/agent/memory/preference?category=${encodeURIComponent(category)}&key=${encodeURIComponent(key)}`,
        { withCredentials: true }
      );
      loadMemoryData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchMemory = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchingMemory(true);
    try {
      const res = await axios.post(
        `${serverURL}/api/agent/memory/search`,
        { query: searchQuery, top_k: 5 },
        { withCredentials: true }
      );
      setSearchResults(res.data?.results || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearchingMemory(false);
    }
  };

  // ── Autonomous Screen Goal Execution ─────────────────────────────────────────
  const handleRunScreenGoal = async (e) => {
    e.preventDefault();
    if (!screenGoalInput.trim() || isGoalRunning) return;
    setIsGoalRunning(true);
    setGoalResult(null);
    try {
      const res = await axios.post(
        `${serverURL}/api/agent/screen/goal`,
        { goal: screenGoalInput, max_steps: 8 },
        { withCredentials: true }
      );
      setGoalResult(res.data);
    } catch (err) {
      setGoalResult({
        success: false,
        reason: err.response?.data?.detail || "Screen goal execution failed.",
      });
    } finally {
      setIsGoalRunning(false);
    }
  };

  // Voice State Badge Helper
  const getVoiceBadge = (state) => {
    switch (state) {
      case "LISTENING":
        return { label: "LISTENING", bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse" };
      case "PROCESSING":
        return { label: "PROCESSING", bg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse" };
      case "SPEAKING":
        return { label: "SPEAKING", bg: "bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse" };
      default:
        return { label: "IDLE / READY", bg: "bg-slate-700/40 text-slate-300 border-slate-600/40" };
    }
  };

  const voiceBadge = getVoiceBadge(voiceState);

  return (
    <div className="min-h-screen bg-[#050713] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/80 bg-[#070b1e]/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/app"
            className="flex items-center gap-2.5 group transition-transform active:scale-95"
            title="Return to Main Assistant"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-all">
              <span className="font-bold text-lg text-white">🌸</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-white tracking-wide">Cheeni OS Control</h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  V16 Unified
                </span>
              </div>
              <p className="text-xs text-slate-400">Desktop AI Assistant Telemetry & Automation Hub</p>
            </div>
          </Link>
        </div>

        {/* Global Agent Status & Controls */}
        <div className="flex items-center gap-3">
          {/* Connection Status Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              isConnected
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-900/20"
                : "bg-rose-950/60 text-rose-400 border-rose-500/40"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-ping" : "bg-rose-400"
              }`}
            />
            <span>{isConnected ? "Agent Connected (:2026)" : "Agent Offline"}</span>
          </div>

          {/* Voice State Badge */}
          <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${voiceBadge.bg}`}>
            {voiceBadge.label}
          </div>

          {/* Agent Identity & LLM Backend Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-500/40 bg-indigo-950/50 text-indigo-300 text-xs font-medium">
            <span className="font-semibold text-white">{agentName}</span>
            <span className="text-indigo-400/60">•</span>
            <span className="text-indigo-300/80">{llmBackend}</span>
          </div>

          <Link
            to="/app"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <span>Voice Portal</span>
            <span>→</span>
          </Link>
        </div>
      </header>

      {/* ── Main Dashboard Layout ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT COLUMN: Telemetry, Quick Actions & Remote Input (7 cols) ── */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Live Telemetry Grid */}
          <section className="bg-[#090d26]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>⚡</span> System Telemetry & Hardware
              </h2>
              <span className="text-[11px] text-slate-500">Live 2s Stream</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* CPU */}
              <div className="bg-[#0e1335]/90 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
                <span className="text-xs text-slate-400 mb-1">CPU Load</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-white tracking-tight">{telemetry.cpu}%</span>
                </div>
                <div className="w-full bg-slate-800/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      telemetry.cpu > 80 ? "bg-rose-500" : telemetry.cpu > 50 ? "bg-amber-400" : "bg-cyan-400"
                    }`}
                    style={{ width: `${Math.min(100, telemetry.cpu)}%` }}
                  />
                </div>
              </div>

              {/* RAM */}
              <div className="bg-[#0e1335]/90 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
                <span className="text-xs text-slate-400 mb-1">RAM Usage</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-white tracking-tight">{telemetry.ram}%</span>
                </div>
                <div className="w-full bg-slate-800/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      telemetry.ram > 85 ? "bg-rose-500" : telemetry.ram > 65 ? "bg-purple-400" : "bg-indigo-400"
                    }`}
                    style={{ width: `${Math.min(100, telemetry.ram)}%` }}
                  />
                </div>
              </div>

              {/* Battery */}
              <div className="bg-[#0e1335]/90 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Battery</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-white tracking-tight">
                    {telemetry.battery !== null ? `${telemetry.battery}%` : "AC"}
                  </span>
                  {telemetry.isCharging && <span className="text-amber-400 text-xs">⚡</span>}
                </div>
                <div className="w-full bg-slate-800/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-500 rounded-full"
                    style={{ width: `${telemetry.battery || 100}%` }}
                  />
                </div>
              </div>

              {/* Volume */}
              <div className="bg-[#0e1335]/90 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Master Audio</span>
                  <button
                    onClick={() => handleQuickAction("mute")}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      telemetry.isMuted ? "bg-rose-500/20 text-rose-300" : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {telemetry.isMuted ? "MUTED" : "ON"}
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-white tracking-tight">{telemetry.volume}%</span>
                </div>
                <div className="w-full bg-slate-800/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-500 rounded-full"
                    style={{ width: `${telemetry.volume}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Remote Command Terminal */}
          <section className="bg-[#090d26]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>💻</span> Remote Command Console
              </h2>
              <span className="text-[11px] text-slate-400">Execute without voice</span>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendCommand();
              }}
              className="flex items-center gap-2 mb-3"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="e.g. 'open notepad', 'what is on my screen', 'calculate 42 * 7'..."
                  disabled={isExecutingCmd}
                  className="w-full bg-[#0e1335]/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isExecutingCmd || !commandInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isExecutingCmd ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <span>Execute</span>
                    <span>↵</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Chips */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-[11px] text-slate-500 font-medium">Try:</span>
              {[
                "open notepad",
                "what is on my screen",
                "automate: open calculator and compute 42 * 7",
                "search latest AI news",
                "play lofi songs",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSendCommand(chip)}
                  disabled={isExecutingCmd}
                  className="text-[11px] bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-slate-300 px-2.5 py-1 rounded-lg transition-colors active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Command Output Log */}
            <div className="flex-1 bg-[#050716] border border-slate-800/90 rounded-xl p-3.5 font-mono text-xs overflow-y-auto max-h-60 space-y-2.5">
              {commandHistory.length === 0 ? (
                <div className="h-28 flex flex-col items-center justify-center text-slate-600 text-xs">
                  <span>Terminal ready. Type a command above to execute remotely.</span>
                </div>
              ) : (
                commandHistory.map((item) => (
                  <div key={item.id} className="border-b border-slate-800/50 pb-2 last:border-b-0">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                      <span className="text-cyan-400 font-semibold">&gt; {item.text}</span>
                      <span>{item.time} ({item.elapsed_ms}ms)</span>
                    </div>
                    <p className={`text-xs ${item.success ? "text-emerald-300" : "text-rose-400"}`}>
                      {item.speech || (item.success ? "Action completed." : "Failed.")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Quick Actions Panel */}
          <section className="bg-[#090d26]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>⚡</span> 1-Click OS Controls
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => handleQuickAction("lock")}
                className="bg-[#0e1335] hover:bg-slate-800/80 border border-slate-700/70 rounded-xl p-3 text-left transition-all hover:border-cyan-500/50 group"
              >
                <div className="text-lg mb-1 group-hover:scale-110 transition-transform">🔒</div>
                <div className="font-semibold text-xs text-white">Lock PC</div>
                <div className="text-[10px] text-slate-400">LockWorkstation</div>
              </button>

              <button
                onClick={() => handleQuickAction("desktop")}
                className="bg-[#0e1335] hover:bg-slate-800/80 border border-slate-700/70 rounded-xl p-3 text-left transition-all hover:border-cyan-500/50 group"
              >
                <div className="text-lg mb-1 group-hover:scale-110 transition-transform">🖥️</div>
                <div className="font-semibold text-xs text-white">Show Desktop</div>
                <div className="text-[10px] text-slate-400">Minimize all apps</div>
              </button>

              <button
                onClick={() => handleQuickAction("mute")}
                className="bg-[#0e1335] hover:bg-slate-800/80 border border-slate-700/70 rounded-xl p-3 text-left transition-all hover:border-cyan-500/50 group"
              >
                <div className="text-lg mb-1 group-hover:scale-110 transition-transform">🔇</div>
                <div className="font-semibold text-xs text-white">Toggle Mute</div>
                <div className="text-[10px] text-slate-400">Master volume</div>
              </button>

              <button
                onClick={() => handleQuickAction("screenshot")}
                disabled={isTakingScreenshot}
                className="bg-[#0e1335] hover:bg-slate-800/80 border border-slate-700/70 rounded-xl p-3 text-left transition-all hover:border-cyan-500/50 group disabled:opacity-50"
              >
                <div className="text-lg mb-1 group-hover:scale-110 transition-transform">📸</div>
                <div className="font-semibold text-xs text-white">Capture Screen</div>
                <div className="text-[10px] text-slate-400">Instant snapshot</div>
              </button>
            </div>

            {/* Screenshot Preview Modal / Drawer */}
            {screenshotPreview && (
              <div className="mt-4 p-3 bg-[#050716] border border-cyan-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-cyan-300">Active Desktop Capture:</span>
                  <button
                    onClick={() => setScreenshotPreview(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    ✕ Close
                  </button>
                </div>
                <img
                  src={screenshotPreview}
                  alt="Desktop Capture"
                  className="rounded-lg max-h-48 w-auto object-contain border border-slate-800"
                />
              </div>
            )}
          </section>
        </div>

        {/* ── RIGHT COLUMN: Personal Memory & Screen Vision (5 cols) ── */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Personal Memory Browser (V15) */}
          <section className="bg-[#090d26]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col flex-1">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <span>🧠</span> Personal Memory Store
                </h2>
                <p className="text-[11px] text-slate-400">SQLite + Sentence-BERT Semantic Search</p>
              </div>
              {memoryStats && (
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full font-medium">
                  {memoryStats.shortcuts + memoryStats.preferences} facts
                </span>
              )}
            </div>

            {/* Memory Tabs */}
            <div className="flex border-b border-slate-800 mb-4">
              <button
                onClick={() => setMemoryTab("shortcuts")}
                className={`flex-1 py-2 text-xs font-medium border-b-2 transition-all ${
                  memoryTab === "shortcuts"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Shortcuts ({shortcuts.length})
              </button>
              <button
                onClick={() => setMemoryTab("preferences")}
                className={`flex-1 py-2 text-xs font-medium border-b-2 transition-all ${
                  memoryTab === "preferences"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Preferences ({preferences.length})
              </button>
              <button
                onClick={() => setMemoryTab("search")}
                className={`flex-1 py-2 text-xs font-medium border-b-2 transition-all ${
                  memoryTab === "search"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Semantic Recall
              </button>
            </div>

            {/* TAB 1: Shortcuts */}
            {memoryTab === "shortcuts" && (
              <div className="flex flex-col flex-1">
                {/* Add Shortcut Form */}
                <form onSubmit={handleAddShortcut} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newShortcutPhrase}
                    onChange={(e) => setNewShortcutPhrase(e.target.value)}
                    placeholder="Phrase (e.g. 'college portal')"
                    className="flex-1 bg-[#0e1335] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                  />
                  <input
                    type="text"
                    value={newShortcutTarget}
                    onChange={(e) => setNewShortcutTarget(e.target.value)}
                    placeholder="URL or app name"
                    className="flex-1 bg-[#0e1335] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                  >
                    + Add
                  </button>
                </form>

                {/* Shortcuts List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {shortcuts.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      No custom shortcuts added yet.
                    </div>
                  ) : (
                    shortcuts.map((s) => (
                      <div
                        key={s.phrase}
                        className="bg-[#0e1335] border border-slate-800 p-2.5 rounded-lg flex items-center justify-between text-xs group"
                      >
                        <div className="overflow-hidden pr-2">
                          <span className="font-semibold text-cyan-300">"{s.phrase}"</span>
                          <span className="text-slate-500 mx-1.5">→</span>
                          <span className="text-slate-300 truncate">{s.target}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteShortcut(s.phrase)}
                          className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete shortcut"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Preferences */}
            {memoryTab === "preferences" && (
              <div className="flex flex-col flex-1">
                {/* Add Preference Form */}
                <form onSubmit={handleAddPreference} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newPrefCategory}
                    onChange={(e) => setNewPrefCategory(e.target.value)}
                    placeholder="Category"
                    className="w-1/4 bg-[#0e1335] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                  />
                  <input
                    type="text"
                    value={newPrefKey}
                    onChange={(e) => setNewPrefKey(e.target.value)}
                    placeholder="Key (e.g. 'browser')"
                    className="w-1/3 bg-[#0e1335] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                  />
                  <input
                    type="text"
                    value={newPrefValue}
                    onChange={(e) => setNewPrefValue(e.target.value)}
                    placeholder="Value (e.g. 'Chrome')"
                    className="flex-1 bg-[#0e1335] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    + Save
                  </button>
                </form>

                {/* Preferences List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {preferences.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      No preferences stored yet.
                    </div>
                  ) : (
                    preferences.map((p) => (
                      <div
                        key={`${p.category}-${p.key}`}
                        className="bg-[#0e1335] border border-slate-800 p-2.5 rounded-lg flex items-center justify-between text-xs group"
                      >
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase mr-1.5">[{p.category}]</span>
                          <span className="font-semibold text-purple-300">{p.key}:</span>{" "}
                          <span className="text-slate-200">{p.value}</span>
                        </div>
                        <button
                          onClick={() => handleDeletePreference(p.category, p.key)}
                          className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Forget preference"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Semantic Recall Tester */}
            {memoryTab === "search" && (
              <div className="flex flex-col flex-1">
                <form onSubmit={handleSearchMemory} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type natural query (e.g. 'my favorite browser')..."
                    className="flex-1 bg-[#0e1335] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingMemory || !searchQuery.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {isSearchingMemory ? "Recalling..." : "Recall"}
                  </button>
                </form>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {searchResults.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      Enter a query above to test semantic similarity recall.
                    </div>
                  ) : (
                    searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0e1335] border border-slate-800 p-2.5 rounded-lg text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">[{item.table}]</span>
                          <span className="text-[10px] font-semibold text-cyan-400">
                            Score: {(item.score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-slate-200">{item.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Autonomous Screen Goal Agent (V12) */}
          <section className="bg-[#090d26]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <span>🎯</span> ReAct Vision Agent (V12)
                </h2>
                <p className="text-[11px] text-slate-400">Observe → Reason → Act Screen Automation</p>
              </div>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded-full font-medium">
                Gemini 3.5 Flash
              </span>
            </div>

            <form onSubmit={handleRunScreenGoal} className="flex gap-2 mb-3">
              <input
                type="text"
                value={screenGoalInput}
                onChange={(e) => setScreenGoalInput(e.target.value)}
                placeholder="e.g. 'Open calculator and calculate 42 * 7'..."
                disabled={isGoalRunning}
                className="flex-1 bg-[#0e1335] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isGoalRunning || !screenGoalInput.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isGoalRunning ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <span>Run Goal</span>
                )}
              </button>
            </form>

            {goalResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono max-h-48 overflow-y-auto ${
                  goalResult.success
                    ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
                    : "bg-rose-950/40 border-rose-800/50 text-rose-300"
                }`}
              >
                <div className="font-semibold mb-1">
                  {goalResult.success ? "✓ Goal Completed Successfully:" : "✕ Goal Ended:"}
                </div>
                <p className="text-slate-200">{goalResult.message || goalResult.reason}</p>
                {goalResult.steps_completed && (
                  <div className="text-[11px] text-slate-400 mt-1">
                    Steps executed: {goalResult.steps_completed}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Direct Speech Test */}
          <section className="bg-[#090d26]/80 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span>🗣️</span> Voice Speaker Output (V13 Edge TTS)
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={speakInput}
                onChange={(e) => setSpeakInput(e.target.value)}
                placeholder="Type text for Sam to speak out loud..."
                className="flex-1 bg-[#0e1335] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500"
              />
              <button
                onClick={handleDirectSpeak}
                disabled={isSpeaking || !speakInput.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700"
              >
                {isSpeaking ? "Speaking..." : "Speak"}
              </button>
            </div>
          </section>

          {/* ── V19: Kokoro TTS ───────────────────────────────────────── */}
          <KokoroPanelSection serverURL={serverURL} />

          {/* ── V17: Morning Digest ───────────────────────────────────── */}
          <DigestPanelSection serverURL={serverURL} />

          {/* ── V18: Cloud Connectors ─────────────────────────────────── */}
          <ConnectorsPanelSection serverURL={serverURL} />

          {/* ── V20: Notes Indexer ────────────────────────────────────── */}
          <NotesPanelSection serverURL={serverURL} />

        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   V19 — Kokoro TTS Panel
   ═══════════════════════════════════════════════════════════════════════════ */
function KokoroPanelSection({ serverURL }) {
  const [status, setStatus] = useState(null);
  const [kokoroText, setKokoroText] = useState("");
  const [kokoroVoice, setKokoroVoice] = useState("bm_george");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    axios.get("/api/agent/voice/kokoro/status", { withCredentials: true, timeout: 5000 })
      .then(r => setStatus(r.data))
      .catch(() => setStatus(null));
  }, []);

  const speak = async () => {
    if (!kokoroText.trim()) return;
    setLoading(true); setMsg("");
    try {
      await axios.post("/api/agent/voice/kokoro/speak", { text: kokoroText, interrupt: true }, { withCredentials: true });
      setMsg("✓ Speaking with Kokoro neural voice");
      setKokoroText("");
    } catch (e) {
      setMsg("⚠ " + (e.response?.data?.detail || e.message));
    } finally { setLoading(false); }
  };

  const changeVoice = async (v) => {
    setKokoroVoice(v);
    try { await axios.post("/api/agent/voice/kokoro/voice", { voice: v }, { withCredentials: true }); }
    catch { /* silent */ }
  };

  const voicePresets = [
    { id: "bm_george", label: "George (British Male — JARVIS)" },
    { id: "af_sarah",  label: "Sarah (US Female)" },
    { id: "bf_emma",   label: "Emma (British Female)" },
    { id: "am_adam",   label: "Adam (US Male)" },
  ];

  const available = status?.available;

  return (
    <section className="bg-[#090d26]/80 border border-violet-800/40 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
      <h2 className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>🎙️</span> Kokoro Neural TTS — Local JARVIS Voice (V19)
        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${available ? "bg-emerald-900/60 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
          {available ? "✓ Active" : status?.kokoro_installed ? "Not started" : "Not installed"}
        </span>
      </h2>

      {!status?.kokoro_installed && (
        <div className="mb-3 text-[11px] bg-amber-950/40 border border-amber-800/50 rounded-lg p-2 text-amber-300">
          Install Kokoro: <code className="bg-black/40 px-1 rounded">pip install kokoro sounddevice</code>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        {voicePresets.map(v => (
          <button
            key={v.id}
            onClick={() => changeVoice(v.id)}
            className={`text-[11px] px-2 py-1.5 rounded-lg border text-left transition-all ${
              kokoroVoice === v.id
                ? "bg-violet-900/60 border-violet-600/60 text-violet-200"
                : "bg-slate-900/60 border-slate-700/60 text-slate-400 hover:border-violet-700/50"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={kokoroText}
          onChange={e => setKokoroText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && speak()}
          placeholder="Good morning, sir. All systems are operational."
          className="flex-1 bg-[#0e1335] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500"
        />
        <button
          onClick={speak}
          disabled={loading || !kokoroText.trim() || !available}
          className="px-3.5 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white text-xs font-semibold"
        >
          {loading ? "…" : "Speak"}
        </button>
      </div>
      {msg && <p className="text-[11px] mt-2 text-slate-400">{msg}</p>}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   V17 — Morning Digest Panel
   ═══════════════════════════════════════════════════════════════════════════ */
function DigestPanelSection({ serverURL }) {
  const [digestStatus, setDigestStatus] = useState(null);
  const [digestText, setDigestText] = useState("");
  const [scheduleTime, setScheduleTime] = useState("07:00");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    axios.get("/api/agent/digest/status", { withCredentials: true, timeout: 5000 })
      .then(r => { setDigestStatus(r.data); if (r.data.schedule_time) setScheduleTime(r.data.schedule_time); })
      .catch(() => {});
  }, []);

  const runDigest = async (textOnly) => {
    setLoading(true); setMsg(""); setDigestText("");
    try {
      const endpoint = textOnly ? "/api/agent/digest/text" : "/api/agent/digest/now";
      const r = await axios.post(endpoint, {}, { withCredentials: true, timeout: 90000 });
      setDigestText(r.data.text || "");
      setMsg(textOnly ? "✓ Digest built (text only)" : "✓ Digest built and spoken");
    } catch (e) {
      setMsg("⚠ " + (e.response?.data?.message || e.message));
    } finally { setLoading(false); }
  };

  const setSchedule = async () => {
    try {
      await axios.post("/api/agent/digest/schedule", { time: scheduleTime }, { withCredentials: true });
      setMsg(`✓ Scheduled daily digest at ${scheduleTime}`);
      setDigestStatus(prev => ({ ...prev, scheduled: true, schedule_time: scheduleTime }));
    } catch (e) { setMsg("⚠ " + (e.response?.data?.message || e.message)); }
  };

  const cancelSchedule = async () => {
    try {
      await axios.delete("/api/agent/digest/schedule", { withCredentials: true });
      setMsg("✓ Schedule cancelled");
      setDigestStatus(prev => ({ ...prev, scheduled: false, schedule_time: null }));
    } catch (e) { setMsg("⚠ " + e.message); }
  };

  return (
    <section className="bg-[#090d26]/80 border border-amber-800/40 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
      <h2 className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>🌅</span> Morning Digest Agent (V17)
        {digestStatus?.scheduled && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-400">
            ⏰ Scheduled {digestStatus.schedule_time}
          </span>
        )}
      </h2>

      <div className="flex gap-2 mb-3 flex-wrap">
        <button onClick={() => runDigest(false)} disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1">
          {loading ? "⏳ Building..." : "▶ Build & Speak Now"}
        </button>
        <button onClick={() => runDigest(true)} disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-semibold border border-slate-700">
          📄 Text Only
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <label className="text-[11px] text-slate-400 whitespace-nowrap">Daily at:</label>
        <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
          className="bg-[#0e1335] border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-100 w-28" />
        <button onClick={setSchedule} className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700">
          Schedule
        </button>
        {digestStatus?.scheduled && (
          <button onClick={cancelSchedule} className="px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-300 text-xs font-semibold border border-rose-800/60">
            Cancel
          </button>
        )}
      </div>

      {msg && <p className="text-[11px] text-slate-400 mb-2">{msg}</p>}

      {digestText && (
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {digestText}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   V18 — Cloud Connectors Panel
   ═══════════════════════════════════════════════════════════════════════════ */
function ConnectorsPanelSection({ serverURL }) {
  const [connected, setConnected] = useState([]);
  const [emails, setEmails] = useState([]);
  const [events, setEvents] = useState([]);
  const [loadingConnect, setLoadingConnect] = useState("");
  const [loadingData, setLoadingData] = useState("");
  const [msg, setMsg] = useState("");

  const refreshConnected = useCallback(async () => {
    try {
      const r = await axios.get("/api/agent/connectors/list", { withCredentials: true, timeout: 5000 });
      setConnected(r.data.connected || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { refreshConnected(); }, [refreshConnected]);

  const connect = async (service) => {
    setLoadingConnect(service); setMsg("");
    try {
      const r = await axios.post("/api/agent/connectors/connect", { service }, { withCredentials: true, timeout: 130000 });
      setMsg(r.data.ok ? `✓ Connected to ${service}` : `⚠ ${r.data.error}`);
      refreshConnected();
    } catch (e) { setMsg("⚠ " + (e.response?.data?.message || e.message)); }
    finally { setLoadingConnect(""); }
  };

  const loadGmail = async () => {
    setLoadingData("gmail"); setMsg("");
    try {
      const r = await axios.get("/api/agent/connectors/gmail/unread?max_results=10", { withCredentials: true, timeout: 20000 });
      setEmails(r.data.emails || []);
      setMsg(`✓ ${r.data.count} unread emails`);
    } catch (e) { setMsg("⚠ " + (e.response?.data?.message || e.message)); }
    finally { setLoadingData(""); }
  };

  const loadCalendar = async () => {
    setLoadingData("calendar"); setMsg("");
    try {
      const r = await axios.get("/api/agent/connectors/calendar/today", { withCredentials: true, timeout: 15000 });
      setEvents(r.data.events || []);
      setMsg(`✓ ${r.data.count} events today`);
    } catch (e) { setMsg("⚠ " + (e.response?.data?.message || e.message)); }
    finally { setLoadingData(""); }
  };

  const isConnected = (svc) => connected.some(c => c.service === svc || c.service === "gdrive");
  const services = [
    { id: "gdrive", label: "Google (Gmail + Calendar + Drive)", icon: "📧" },
    { id: "slack",  label: "Slack",  icon: "💬" },
    { id: "notion", label: "Notion", icon: "📝" },
  ];

  return (
    <section className="bg-[#090d26]/80 border border-sky-800/40 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
      <h2 className="text-xs font-semibold text-sky-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>🔌</span> Cloud Connectors (V18)
      </h2>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {services.map(svc => (
          <button key={svc.id} onClick={() => connect(svc.id)} disabled={!!loadingConnect}
            className={`text-[11px] px-2 py-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
              isConnected(svc.id)
                ? "bg-emerald-900/40 border-emerald-700/60 text-emerald-300"
                : "bg-slate-900/60 border-slate-700/60 text-slate-400 hover:border-sky-700/50"
            }`}>
            <span className="text-base">{svc.icon}</span>
            <span>{isConnected(svc.id) ? "✓ " : ""}{svc.id === "gdrive" ? "Google" : svc.label}</span>
            {loadingConnect === svc.id && <span className="text-[10px] text-sky-400">Connecting…</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <button onClick={loadGmail} disabled={!!loadingData}
          className="px-3 py-1.5 rounded-lg bg-sky-900/60 hover:bg-sky-800 border border-sky-700/60 text-sky-200 text-xs font-semibold disabled:opacity-40">
          {loadingData === "gmail" ? "Loading…" : "📬 Unread Emails"}
        </button>
        <button onClick={loadCalendar} disabled={!!loadingData}
          className="px-3 py-1.5 rounded-lg bg-sky-900/60 hover:bg-sky-800 border border-sky-700/60 text-sky-200 text-xs font-semibold disabled:opacity-40">
          {loadingData === "calendar" ? "Loading…" : "📅 Today's Events"}
        </button>
      </div>

      {msg && <p className="text-[11px] text-slate-400 mb-2">{msg}</p>}

      {emails.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {emails.filter(e => !e.error).map((email, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-700/40 rounded-lg px-2.5 py-1.5">
              <div className="text-[11px] font-semibold text-slate-200 truncate">{email.subject}</div>
              <div className="text-[10px] text-slate-400 truncate">{email.from}</div>
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto mt-2">
          {events.filter(e => !e.error).map((ev, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-700/40 rounded-lg px-2.5 py-1.5 flex justify-between items-center">
              <span className="text-[11px] text-slate-200">{ev.summary}</span>
              <span className="text-[10px] text-slate-400 ml-2 whitespace-nowrap">
                {ev.start?.split("T")[1]?.slice(0,5) || ev.start}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   V20 — Notes Memory Indexer Panel
   ═══════════════════════════════════════════════════════════════════════════ */
function NotesPanelSection({ serverURL }) {
  const [folderPath, setFolderPath] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [sources, setSources] = useState([]);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState("");

  const loadSources = useCallback(async () => {
    try {
      const r = await axios.get("/api/agent/memory/notes/sources", { withCredentials: true, timeout: 5000 });
      setSources(r.data.sources || []);
    } catch { /* silent */ }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const r = await axios.get("/api/agent/memory/notes/stats", { withCredentials: true, timeout: 5000 });
      setStats(r.data.stats);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadSources(); loadStats(); }, [loadSources, loadStats]);

  const indexFolder = async () => {
    if (!folderPath.trim()) return;
    setLoading("index"); setMsg("");
    try {
      const r = await axios.post("/api/agent/memory/notes/index", { path: folderPath.trim(), overwrite: true }, { withCredentials: true, timeout: 310000 });
      setMsg(r.data.ok
        ? `✓ Indexed ${r.data.files_indexed} files, ${r.data.chunks_created} chunks in ${r.data.time_sec}s`
        : `⚠ ${r.data.error}`);
      loadSources(); loadStats();
      setFolderPath("");
    } catch (e) { setMsg("⚠ " + (e.response?.data?.message || e.message)); }
    finally { setLoading(""); }
  };

  const searchNotes = async () => {
    if (!searchQ.trim()) return;
    setLoading("search"); setMsg(""); setResults([]);
    try {
      const r = await axios.post("/api/agent/memory/notes/search", { query: searchQ.trim(), top_k: 5 }, { withCredentials: true, timeout: 30000 });
      setResults(r.data.results || []);
      setMsg(`✓ ${r.data.results?.length || 0} results for "${searchQ}"`);
    } catch (e) { setMsg("⚠ " + (e.response?.data?.message || e.message)); }
    finally { setLoading(""); }
  };

  const removeSource = async (path) => {
    try {
      await axios.delete("/api/agent/memory/notes/source", { data: { path }, withCredentials: true });
      loadSources(); loadStats();
      setMsg("✓ Source removed");
    } catch (e) { setMsg("⚠ " + e.message); }
  };

  return (
    <section className="bg-[#090d26]/80 border border-teal-800/40 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
      <h2 className="text-xs font-semibold text-teal-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>📚</span> Notes Memory Indexer (V20)
        {stats && (
          <span className="ml-auto text-[10px] text-slate-400">
            {stats.files_total} files · {stats.chunks_total} chunks
          </span>
        )}
      </h2>

      {/* Index a folder */}
      <div className="flex gap-2 mb-3">
        <input type="text" value={folderPath} onChange={e => setFolderPath(e.target.value)}
          onKeyDown={e => e.key === "Enter" && indexFolder()}
          placeholder="C:/Users/You/Documents/Notes"
          className="flex-1 bg-[#0e1335] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500" />
        <button onClick={indexFolder} disabled={!folderPath.trim() || loading === "index"}
          className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap">
          {loading === "index" ? "Indexing…" : "Index Folder"}
        </button>
      </div>

      {/* Semantic search */}
      <div className="flex gap-2 mb-3">
        <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && searchNotes()}
          placeholder="Search your notes semantically…"
          className="flex-1 bg-[#0e1335] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500" />
        <button onClick={searchNotes} disabled={!searchQ.trim() || loading === "search"}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-semibold border border-slate-700">
          {loading === "search" ? "…" : "Search"}
        </button>
      </div>

      {msg && <p className="text-[11px] text-slate-400 mb-2">{msg}</p>}

      {/* Search results */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
          {results.map((r, i) => (
            <div key={i} className="bg-slate-900/50 border border-teal-800/30 rounded-lg px-2.5 py-2">
              <div className="text-[10px] text-teal-400 truncate mb-0.5">
                📄 {r.source?.split(/[\\/]/).pop()} · score: {(r.score * 100).toFixed(0)}%
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">{r.snippet}</p>
            </div>
          ))}
        </div>
      )}

      {/* Indexed sources */}
      {sources.length > 0 && (
        <div className="border-t border-slate-800/60 pt-3">
          <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">Indexed Folders</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {sources.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-900/40 rounded-lg px-2.5 py-1.5">
                <div>
                  <div className="text-[11px] text-slate-300 truncate max-w-xs">{s.path?.split(/[\\/]/).slice(-2).join("/")}</div>
                  <div className="text-[10px] text-slate-500">{s.files} files · {s.chunks} chunks</div>
                </div>
                <button onClick={() => removeSource(s.path)}
                  className="text-[10px] text-rose-400 hover:text-rose-300 ml-2">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

