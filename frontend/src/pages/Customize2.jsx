import React, { useState, useContext, useEffect } from "react";
import { UserDataContext } from "../context/userDataContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/api";
import { 
  LuArrowLeft, 
  LuVolume2, 
  LuVolumeX, 
  LuSparkles, 
  LuCheck, 
  LuBot, 
  LuArrowRight,
  LuLoader 
} from "react-icons/lu";
import defaultAvatar from "../assets/image1.jpg";

function Customize2() {
  const {
    userData,
    setUserData,
    frontendImage,
    backendImage,
    selectedImage,
  } = useContext(UserDataContext);

  const navigate = useNavigate();

  const [assistantName, setAssistantName] = useState("Cheeni");
  const [voicePersona, setVoicePersona] = useState("cute_girl"); // 'cute_girl' | 'male_jarvis'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Avatar to display
  const currentAvatar = frontendImage || selectedImage || userData?.assistantImage || defaultAvatar;

  // Name suggestions with persona mapping
  const nameSuggestions = [
    { name: "Cheeni", persona: "cute_girl" },
    { name: "Jarvis", persona: "male_jarvis" },
    { name: "Aura", persona: "cute_girl" },
    { name: "Alfred", persona: "male_jarvis" },
    { name: "Maya", persona: "cute_girl" },
    { name: "Nova", persona: "male_jarvis" },
  ];

  // Auto-detect voice persona when assistant name changes
  const handleNameChange = (newName) => {
    setAssistantName(newName);
    if (/jarvis|alfred|friday|edith|titan|iron|bruce/i.test(newName)) {
      setVoicePersona("male_jarvis");
    } else if (/cheeni|maya|aura|anya|siri|lily|rose|chloe/i.test(newName)) {
      setVoicePersona("cute_girl");
    }
  };

  // Voice Preview Engine (Dynamic Cute Girl vs. British Male JARVIS)
  const handleVoicePreview = () => {
    if (!("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    const name = assistantName.trim() || (voicePersona === "male_jarvis" ? "JARVIS" : "Cheeni");
    const userName = userData?.name ? userData.name.split(" ")[0] : "friend";
    
    const isMale = voicePersona === "male_jarvis";
    const text = isMale
      ? `Greetings ${userName}! I am ${name}, your personal operating intelligence. All laptop systems are standing by for your command, Sir.`
      : `Hello ${userName}! I am ${name}, your sweet personal assistant. I'm ready to help you with your laptop, studies, and anything you need!`;

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    if (isMale) {
      const maleVoice = voices.find(
        (v) =>
          /ryan|george|daniel|guy|david|oliver|male/i.test(v.name) &&
          v.lang.startsWith("en")
      ) || voices.find((v) => v.lang.startsWith("en"));
      if (maleVoice) utterance.voice = maleVoice;
      utterance.pitch = 0.88;
      utterance.rate = 1.02;
    } else {
      const sweetVoice = voices.find(
        (v) =>
          /zira|samantha|karen|victoria|natural|female|jenny|ana/i.test(v.name) &&
          v.lang.startsWith("en")
      ) || voices.find((v) => v.lang.startsWith("en"));
      if (sweetVoice) utterance.voice = sweetVoice;
      utterance.pitch = 1.18;
      utterance.rate = 0.98;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle Assistant Finalization
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!assistantName.trim()) {
      setError("Please provide a name for your assistant.");
      return;
    }

    setError("");
    setLoading(true);

    const avatarToSave = selectedImage || currentAvatar || defaultAvatar;
    const trimmedName = assistantName.trim();

    // ── Optimistic update: set userData BEFORE the API call ──────────────────
    // This ensures App.jsx route guard sees assistantName immediately,
    // so navigation to /app never bounces back to /customize even if the
    // agent backend is temporarily offline.
    setUserData((prev) => ({
      ...(prev || {}),
      assistantName: trimmedName,
      assistantImage: avatarToSave,
    }));

    // Persist locally for immediate offline / next-boot usage
    localStorage.setItem("cheeni_voice_persona", voicePersona);
    localStorage.setItem("cheeni_assistant_name", trimmedName);

    try {
      const formData = new FormData();
      formData.append("assistantName", trimmedName);
      formData.append("voicePersona", voicePersona);

      if (backendImage) {
        formData.append("assistantImage", backendImage);
      } else {
        formData.append("imageUrl", avatarToSave);
        formData.append("assistantImage", avatarToSave);
      }

      const res = await apiClient.post(`/api/user/update`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Sync with whatever the backend saved (may differ for uploaded images)
      if (res.data?.user) {
        setUserData((prev) => ({
          ...prev,
          ...res.data.user,
          assistantName: res.data.user.assistantName || trimmedName,
          assistantImage: res.data.user.assistantImage || avatarToSave,
        }));
      }
    } catch (err) {
      // Non-fatal: local state already updated — still navigate to /app.
      // Show a soft warning but don't block the user.
      console.warn("Agent offline — assistant saved locally only:", err.message);
    } finally {
      setLoading(false);
      navigate("/app");
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#050713] text-slate-100 flex flex-col items-center px-4 py-8 relative overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      {/* Ambient background glows */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-10 right-10 w-[450px] h-[450px] bg-cyan-600/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8 relative z-10">
        <button
          onClick={() => navigate("/customize")}
          className="flex items-center gap-2 px-4 py-2 rounded-full glass-pill text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <LuArrowLeft className="w-4 h-4" /> Change Avatar
        </button>

        <span className="text-xs uppercase tracking-widest text-cyan-400 font-semibold glass-pill px-3 py-1 font-mono">
          Step 2 of 2
        </span>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-xl flex flex-col items-center relative z-10">
        {/* Title */}
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-center mb-2 text-white tracking-tight">
          Name Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">AI Assistant</span>
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm text-center max-w-md mb-8">
          Personalize Cheeni's identity and audition her speech before waking her up on your laptop.
        </p>

        {/* Error Alert */}
        {error && (
          <div className="w-full mb-6 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        {/* Centerpiece Avatar & Voice Preview */}
        <div className="relative group mb-8 flex flex-col items-center">
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full p-2 neo-convex shadow-[0_0_40px_rgba(6,182,212,0.35)]">
            <div className="w-full h-full rounded-full overflow-hidden neo-inset p-1">
              <img
                src={currentAvatar}
                alt="Assistant Avatar"
                className="w-full h-full object-cover rounded-full select-none"
              />
            </div>
            {isSpeaking && (
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-60 pointer-events-none" />
            )}
          </div>

          {/* Voice Preview Button */}
          <button
            type="button"
            onClick={handleVoicePreview}
            className={`mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm transition-all duration-300 cursor-pointer shadow-lg ${
              isSpeaking
                ? "bg-emerald-500 text-slate-950 shadow-emerald-500/50 animate-pulse"
                : "neo-button text-cyan-300 hover:text-white"
            }`}
          >
            {isSpeaking ? (
              <>
                <LuVolumeX className="w-4 h-4" /> Auditioning Sample... (Tap to stop)
              </>
            ) : (
              <>
                <LuVolume2 className="w-4 h-4 text-cyan-400" /> Audition Cheeni's Voice
              </>
            )}
          </button>
        </div>

        {/* Name Form Card */}
        <form onSubmit={handleSave} className="w-full glass-panel rounded-3xl p-6 sm:p-8 flex flex-col gap-6 border border-white/10 shadow-2xl">
          {/* Input Box */}
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-2 font-heading">
              <LuBot className="w-4 h-4 text-cyan-400" /> Assistant Name
            </label>
            <div className="flex items-center neo-inset rounded-2xl px-4 py-3 focus-within:border-cyan-500/50 transition-colors relative">
              <input
                type="text"
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                placeholder="e.g. Cheeni"
                maxLength={30}
                required
                className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none text-base sm:text-lg font-medium pr-12"
              />
              <span className="absolute right-4 text-xs text-slate-500 font-mono">
                {assistantName.length}/30
              </span>
            </div>
          </div>

          {/* Quick Name Chips */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-400 font-medium">Suggested Names:</span>
            <div className="flex flex-wrap gap-2">
              {nameSuggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => { setAssistantName(s.name); setVoicePersona(s.persona); }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    assistantName === s.name
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                      : "glass-pill text-slate-400 hover:text-white"
                  }`}
                >
                  {assistantName === s.name && <LuCheck className="w-3.5 h-3.5 text-cyan-400" />}
                  {s.name === "Cheeni" ? `🌟 ${s.name} (Recommended)` : s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Finalize Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500 hover:opacity-95 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] disabled:opacity-40"
          >
            {loading ? (
              <>
                <LuLoader className="w-5 h-5 animate-spin" /> Awakening {assistantName}...
              </>
            ) : (
              <>
                Awaken My Assistant <LuArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Customize2;