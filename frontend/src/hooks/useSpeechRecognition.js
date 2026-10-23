import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useSpeechRecognition Hook
 * Handles browser-based speech-to-text using Web Speech API
 * Supports real-time interim transcription, auto-stop on silence, and error handling.
 */
export function useSpeechRecognition({
  onResult,
  onEnd,
  lang = "en-US",
  autoStopDelay = 1800,
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isListeningRef = useRef(false);
  const latestTranscriptRef = useRef("");
  const shouldReviewOnEndRef = useRef(false);

  // Keep mutable references to callbacks so closures are never stale
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
  }, [onResult, onEnd]);

  // Check browser support
  const hasSupport =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Clear silence timer
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // Initialize SpeechRecognition instance
  useEffect(() => {
    if (!hasSupport) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      shouldReviewOnEndRef.current = false;
      setError(null);
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          final += `${result[0].transcript} `;
        } else {
          interim += `${result[0].transcript} `;
        }
      }

      const currentText = (final || interim).replace(/\s+/g, " ").trim();
      if (currentText) {
        setTranscript(currentText);
        latestTranscriptRef.current = currentText;
        shouldReviewOnEndRef.current = true;

        if (onResultRef.current) {
          onResultRef.current(currentText);
        }

        // Auto-stop after silence delay
        clearSilenceTimer();
        if (autoStopDelay > 0) {
          silenceTimerRef.current = setTimeout(() => {
            if (isListeningRef.current) {
              stopListening();
            }
          }, autoStopDelay);
        }
      }
    };

    recognition.onerror = (event) => {
      shouldReviewOnEndRef.current = false;
      if (event.error === "no-speech") {
        setError("No speech was detected. Please try again.");
        setIsListening(false);
        isListeningRef.current = false;
        clearSilenceTimer();
        return;
      }
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission blocked. Please grant microphone access to communicate.");
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
      isListeningRef.current = false;
      clearSilenceTimer();
    };

    recognition.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      clearSilenceTimer();

      if (shouldReviewOnEndRef.current && onEndRef.current && latestTranscriptRef.current) {
        const textToSend = latestTranscriptRef.current;
        shouldReviewOnEndRef.current = false;
        onEndRef.current(textToSend);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      shouldReviewOnEndRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore already stopped errors
        }
      }
    };
  }, [hasSupport, lang, autoStopDelay]);

  // Request microphone permission explicitly via getUserMedia to awaken device
  const requestMicPermission = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Close audio track immediately after verification
        stream.getTracks().forEach((track) => track.stop());
        setError(null);
        return true;
      } catch (err) {
        console.warn("getUserMedia error:", err);
        setError("Microphone access was denied. Please allow microphone permissions.");
        return false;
      }
    }
    return true;
  }, []);

  // Start listening handler
  const startListening = useCallback(async () => {
    if (!hasSupport) {
      setError(
        "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Brave."
      );
      return;
    }

    if (isListeningRef.current) return;

    setError(null);
    setTranscript("");
    latestTranscriptRef.current = "";
    shouldReviewOnEndRef.current = false;

    // Test microphone permission if blocked earlier
    if (error && error.includes("denied")) {
      const allowed = await requestMicPermission();
      if (!allowed) return;
    }

    try {
      recognitionRef.current.start();
    } catch (err) {
      // If already started, ignore error
      if (err.name !== "InvalidStateError") {
        console.error("Failed to start speech recognition:", err);
        // Attempt getUserMedia fallback
        requestMicPermission().then((ok) => {
          if (ok && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch {
              // ignore
            }
          }
        });
      }
    }
  }, [hasSupport, error, requestMicPermission]);

  // Stop listening handler
  const stopListening = useCallback((options = {}) => {
    clearSilenceTimer();
    if (options?.discard) {
      shouldReviewOnEndRef.current = false;
      latestTranscriptRef.current = "";
      setTranscript("");
    }
    if (!recognitionRef.current || !isListeningRef.current) return;

    try {
      if (options?.discard) {
        recognitionRef.current.abort();
      } else {
        recognitionRef.current.stop();
      }
    } catch {
      // ignore
    }
    setIsListening(false);
    isListeningRef.current = false;
  }, []);

  // Toggle listening handler
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Reset transcript handler
  const resetTranscript = useCallback(() => {
    setTranscript("");
    latestTranscriptRef.current = "";
    shouldReviewOnEndRef.current = false;
  }, []);

  return {
    isListening,
    transcript,
    error,
    hasSupport,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    requestMicPermission,
  };
}

export default useSpeechRecognition;
