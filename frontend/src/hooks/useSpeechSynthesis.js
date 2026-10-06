import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useSpeechSynthesis Hook
 * Calibrated specifically for Cheeni's sweet female voice persona.
 * Provides speech playback, voice filtering, volume/pitch/rate controls, and mute state.
 */
export function useSpeechSynthesis({ defaultPitch = 1.0, defaultRate = 1.02 } = {}) {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [pitch, setPitch] = useState(defaultPitch);
  const [rate, setRate] = useState(defaultRate);

  const utteranceRef = useRef(null);
  const isMutedRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Find the most natural, human-sounding voice available (like Siri, Google Assistant, or a news anchor)
  const pickSweetestFemaleVoice = useCallback((voiceList) => {
    if (!voiceList || voiceList.length === 0) return null;

    // Preferred natural, human, modern neural voices
    const preferredNames = [
      /natural.*female/i,
      /jenny.*natural/i,
      /aria.*natural/i,
      /jenny/i,
      /aria/i,
      /samantha/i,           // Siri / Apple Samantha
      /sonia.*natural/i,
      /sonia/i,
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

    // Fallback: any English voice
    const anyEnglish = voiceList.find((v) => v.lang.startsWith("en"));
    if (anyEnglish) return anyEnglish;

    // Final fallback
    return voiceList[0] || null;
  }, []);

  // Populate voices
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      if (!selectedVoice && availableVoices.length > 0) {
        const best = pickSweetestFemaleVoice(availableVoices);
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
  }, [pickSweetestFemaleVoice, selectedVoice]);

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

        let activeVoice = selectedVoice;
        if (!activeVoice && "speechSynthesis" in window) {
          const avail = window.speechSynthesis.getVoices();
          if (avail && avail.length > 0) {
            activeVoice = pickSweetestFemaleVoice(avail);
          }
        }
        if (activeVoice) {
          utterance.voice = activeVoice;
        }

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
  };
}

export default useSpeechSynthesis;
