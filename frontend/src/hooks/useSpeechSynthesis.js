import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useSpeechSynthesis Hook
 * Calibrated specifically for Cheeni's sweet female voice persona.
 * Provides speech playback, voice filtering, volume/pitch/rate controls, and mute state.
 */
export function useSpeechSynthesis({ defaultPitch = 1.0, defaultRate = 1.02, defaultPersona = "cute_girl" } = {}) {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [pitch, setPitch] = useState(defaultPitch);
  const [rate, setRate] = useState(defaultRate);
  const [persona, setPersonaState] = useState(defaultPersona);

  const utteranceRef = useRef(null);
  const isMutedRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Find the most natural, human-sounding female voice available (Sweet & Cute)
  const pickSweetestFemaleVoice = useCallback((voiceList) => {
    if (!voiceList || voiceList.length === 0) return null;

    const preferredNames = [
      /natural.*female/i,
      /jenny.*natural/i,
      /aria.*natural/i,
      /ana.*natural/i,
      /jenny/i,
      /aria/i,
      /samantha/i,           // Siri / Apple Samantha
      /sonia.*natural/i,
      /sonia/i,
      /ana/i,
      /google.*us.*english/i,
      /google.*uk.*female/i,
      /google.*female/i,
      /google.*english/i,
      /karen/i,
      /victoria/i,
      /female/i,
      /zira/i,               // Legacy SAPI fallback
    ];

    for (const pattern of preferredNames) {
      const match = voiceList.find(
        (v) => pattern.test(v.name) && (v.lang.startsWith("en") || !v.lang)
      );
      if (match) return match;
    }

    const anyEnglish = voiceList.find((v) => v.lang.startsWith("en"));
    if (anyEnglish) return anyEnglish;

    return voiceList[0] || null;
  }, []);

  // Find the most natural, executive British/US male voice available (JARVIS Style)
  const pickJarvisMaleVoice = useCallback((voiceList) => {
    if (!voiceList || voiceList.length === 0) return null;

    const preferredMale = [
      /ryan.*natural/i,
      /george.*natural/i,
      /daniel.*natural/i,
      /ryan/i,
      /george/i,
      /daniel/i,
      /guy/i,
      /david/i,
      /oliver/i,
      /google.*uk.*male/i,
      /google.*male/i,
      /male/i,
    ];

    for (const pattern of preferredMale) {
      const match = voiceList.find(
        (v) => pattern.test(v.name) && (v.lang.startsWith("en") || !v.lang)
      );
      if (match) return match;
    }

    return voiceList.find((v) => v.lang.startsWith("en")) || voiceList[0] || null;
  }, []);

  const pickVoiceForPersona = useCallback((p, voiceList) => {
    return p === "male_jarvis"
      ? pickJarvisMaleVoice(voiceList)
      : pickSweetestFemaleVoice(voiceList);
  }, [pickJarvisMaleVoice, pickSweetestFemaleVoice]);

  // Set persona with calibrated pitch and rate
  const setPersona = useCallback((newPersona) => {
    setPersonaState(newPersona);
    if (newPersona === "male_jarvis") {
      setPitch(0.88);
      setRate(1.02);
      if (voices.length > 0) {
        setSelectedVoice(pickJarvisMaleVoice(voices));
      }
    } else {
      setPitch(1.15);
      setRate(0.98);
      if (voices.length > 0) {
        setSelectedVoice(pickSweetestFemaleVoice(voices));
      }
    }
  }, [voices, pickJarvisMaleVoice, pickSweetestFemaleVoice]);

  // Populate voices
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      if (!selectedVoice && availableVoices.length > 0) {
        const best = pickVoiceForPersona(persona, availableVoices);
        setSelectedVoice(best);
      }
    };

    updateVoices();

    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [pickVoiceForPersona, persona, selectedVoice]);

  // Stop speaking
  const stop = useCallback(() => {
    if (activeQueueRef.current) {
      activeQueueRef.current.cancelled = true;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const activeQueueRef = useRef(null);

  // Speak text with seamless sentence chunking for full long-form narration
  const speak = useCallback(
    (text, { onStart, onEnd, onError } = {}) => {
      if (!("speechSynthesis" in window)) {
        console.warn("Speech synthesis not supported in this browser.");
        return;
      }

      if (isMutedRef.current) {
        return;
      }

      if (!text || !text.trim()) return;

      // Cancel any ongoing speech
      stop();

      // If text contains a raw JSON object string, extract speechText
      let rawToClean = text;
      if (rawToClean.trim().startsWith("{") && (rawToClean.includes("speechText") || rawToClean.includes("textResponse"))) {
        try {
          const p = JSON.parse(rawToClean);
          rawToClean = p.speechText || p.textResponse || rawToClean;
        } catch {
          const m = rawToClean.match(/"speechText"\s*:\s*"([^"]+)"/);
          if (m && m[1]) rawToClean = m[1];
        }
      }

      // Clean text of JSON, backslashes, markdown, and code blocks
      const cleanText = rawToClean
        .replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/gi, "")
        // Strip escaped backslash characters so it NEVER speaks "back slash n"
        .replace(/\\n/g, " ")
        .replace(/\\r/g, " ")
        .replace(/\\t/g, " ")
        .replace(/\\"/g, '"')
        .replace(/```[\s\S]*?```/g, "Code implementation is provided on your screen.")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/https?:\/\/\S+/g, "link")
        // Convert numbered list items
        .replace(/^\s*\d+\.\s+/gm, "")
        // Convert bullet list items
        .replace(/^\s*[-*]\s+/gm, "")
        // Convert markdown headings to readable text
        .replace(/#{1,6}\s+/g, "")
        // Strip bold/italic/table markers
        .replace(/[*_~>|]/g, "")
        // Strip any residual single backslashes
        .replace(/\\/g, "")
        // Replace multiple newlines with a period-space to create sentence breaks
        .replace(/\r?\n{2,}/g, ". ")
        // Replace single newlines with a space
        .replace(/\r?\n/g, " ")
        // Clean up multiple periods and whitespace
        .replace(/\.{2,}/g, ".")
        .replace(/\s{2,}/g, " ")
        .trim();

      // Split into manageable sentence chunks to prevent browser speech cutoff
      const chunks = cleanText
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (chunks.length === 0) return;

      const queueState = { cancelled: false, index: 0 };
      activeQueueRef.current = queueState;

      setIsSpeaking(true);
      if (onStart) onStart();

      const speakNextChunk = () => {
        if (queueState.cancelled) return;

        if (queueState.index >= chunks.length) {
          setIsSpeaking(false);
          if (onEnd) onEnd();
          return;
        }

        const chunkText = chunks[queueState.index];
        const utterance = new SpeechSynthesisUtterance(chunkText);
        const isHindiText = /[\u0900-\u097F]/.test(chunkText);
        const languagePrefix = isHindiText ? "hi" : "en";
        const availableVoices = window.speechSynthesis.getVoices();

        let activeVoice = selectedVoice?.lang?.toLowerCase().startsWith(languagePrefix) ? selectedVoice : null;
        activeVoice ||= availableVoices.find((voice) => voice.lang?.toLowerCase().startsWith(languagePrefix));
        if (!activeVoice && !isHindiText) {
          activeVoice = pickSweetestFemaleVoice(availableVoices) || selectedVoice;
        }
        if (activeVoice) {
          utterance.voice = activeVoice;
        }
        utterance.lang = isHindiText ? "hi-IN" : (activeVoice?.lang || "en-IN");

        utterance.pitch = pitch;
        utterance.rate = rate;

        utterance.onend = () => {
          if (!queueState.cancelled) {
            queueState.index++;
            speakNextChunk();
          }
        };

        utterance.onerror = (e) => {
          if (!queueState.cancelled) {
            queueState.index++;
            if (queueState.index < chunks.length) {
              speakNextChunk();
            } else {
              setIsSpeaking(false);
              if (onError) onError(e);
            }
          }
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      };

      // Unpause speech synthesis if frozen by Chromium
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        // ignore
      }

      speakNextChunk();
    },
    [selectedVoice, pitch, rate, stop, pickSweetestFemaleVoice]
  );

  // Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  return {
    speak,
    stop,
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
    persona,
    setPersona,
    pickSweetestFemaleVoice,
    pickJarvisMaleVoice,
  };
}

export default useSpeechSynthesis;
