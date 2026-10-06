import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

/**
 * useConnectionStatus
 * Tracks network and backend connectivity status: 'online' | 'reconnecting' | 'offline'.
 *
 * Detection signals:
 *   1. Browser online/offline events (navigator.onLine).
 *   2. Backend reachability via GET /health with exponential backoff on failure.
 *   3. markNetworkError() — callable by API layers when a *network* error (not 4xx/5xx) occurs.
 *
 * Backoff schedule: 2s → 4s → 8s → 16s → 30s (capped).
 * After a successful ping, resets to 2s and fires onReconnect callback.
 *
 * @param {string} serverURL  - Backend base URL (e.g. "http://localhost:2025").
 * @param {object} [options]
 * @param {Function} [options.onReconnect] - Fired when status transitions back to 'online'.
 * @returns {{ status, isOnline, isReconnecting, isOffline, triggerRetry, markNetworkError }}
 */
export function useConnectionStatus(serverURL = "http://localhost:2025", { onReconnect } = {}) {
  const [status, setStatus] = useState(() => (navigator.onLine ? "online" : "offline"));

  // Use refs for the retry loop so the callback always sees current state
  // without stale closure issues from useCallback dependency arrays.
  const retryTimerRef    = useRef(null);
  const backoffRef       = useRef(2000);          // current delay in ms
  const isPingingRef     = useRef(false);
  const isLoopActiveRef  = useRef(false);          // prevents multiple concurrent loops
  const onReconnectRef   = useRef(onReconnect);
  const serverURLRef     = useRef(serverURL);
  const statusRef        = useRef(status);

  // Keep refs in sync with latest prop/state values without re-creating callbacks
  useEffect(() => { onReconnectRef.current = onReconnect; }, [onReconnect]);
  useEffect(() => { serverURLRef.current = serverURL; }, [serverURL]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // ── Health ping ──────────────────────────────────────────────────────────────
  const pingHealth = useCallback(async () => {
    if (isPingingRef.current) return false;
    isPingingRef.current = true;
    try {
      const res = await axios.get(`${serverURLRef.current}/health`, {
        timeout: 4000,
        headers: { "Cache-Control": "no-cache" },
      });
      isPingingRef.current = false;
      return res.status === 200;
    } catch {
      isPingingRef.current = false;
      return false;
    }
  }, []); // stable — uses ref internally

  // ── Exponential backoff retry loop ───────────────────────────────────────────
  // Uses a ref-based loop to avoid stale-closure recursion issues with useCallback.
  const startRetryLoop = useCallback(() => {
    if (isLoopActiveRef.current) return; // already running
    isLoopActiveRef.current = true;

    const attempt = async () => {
      if (!isLoopActiveRef.current) return; // loop was cancelled

      const reachable = await pingHealth();

      if (reachable) {
        isLoopActiveRef.current = false;
        backoffRef.current = 2000; // reset backoff
        setStatus("online");
        onReconnectRef.current?.();
      } else {
        // Escalate to 'offline' only once we've hit the max cap (30s) repeatedly,
        // otherwise stay 'reconnecting' to show the banner without blocking interaction.
        setStatus((prev) => (prev === "online" ? "reconnecting" : prev));

        // Double the delay, cap at 30s
        backoffRef.current = Math.min(30000, backoffRef.current * 2);
        retryTimerRef.current = setTimeout(attempt, backoffRef.current);
      }
    };

    // Start first attempt after initial delay
    retryTimerRef.current = setTimeout(attempt, backoffRef.current);
  }, [pingHealth]);

  const stopRetryLoop = useCallback(() => {
    isLoopActiveRef.current = false;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // ── Manual immediate retry (e.g. from OfflineToast button) ──────────────────
  const triggerRetry = useCallback(async () => {
    stopRetryLoop();
    setStatus("reconnecting");

    const reachable = await pingHealth();
    if (reachable) {
      backoffRef.current = 2000;
      setStatus("online");
      onReconnectRef.current?.();
      return true;
    }
    // Resume backoff loop from current (reset) delay
    backoffRef.current = 2000;
    startRetryLoop();
    return false;
  }, [pingHealth, startRetryLoop, stopRetryLoop]);

  // ── Called by API layers on *network* errors (not 4xx/5xx) ──────────────────
  const markNetworkError = useCallback(() => {
    setStatus((prev) => {
      if (prev !== "online") return prev; // already handling it
      startRetryLoop();
      return "reconnecting";
    });
  }, [startRetryLoop]);

  // ── Browser online / offline events ─────────────────────────────────────────
  useEffect(() => {
    const handleOnline = async () => {
      // Browser reports online — verify backend is actually reachable
      stopRetryLoop();
      setStatus("reconnecting");
      const reachable = await pingHealth();
      if (reachable) {
        backoffRef.current = 2000;
        setStatus("online");
        onReconnectRef.current?.();
      } else {
        startRetryLoop();
      }
    };

    const handleOffline = () => {
      stopRetryLoop();
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      stopRetryLoop();
    };
  }, [pingHealth, startRetryLoop, stopRetryLoop]);

  return {
    status,
    isOnline:       status === "online",
    isReconnecting: status === "reconnecting",
    isOffline:      status === "offline",
    triggerRetry,
    markNetworkError,
  };
}

export default useConnectionStatus;
