import { useState, useEffect } from "react";
import axios from "axios";

/**
 * Custom hook to monitor Desktop Agent connectivity, live hardware telemetry,
 * and handle system controls (volume, quick actions).
 *
 * @param {string} serverURL - Base URL for the Cheeni backend server.
 * @returns {object} Telemetry data, connection status, and action handlers.
 */
export function useAgentTelemetry(serverURL) {
  const [isAgentConnected, setIsAgentConnected] = useState(null); // null = checking, true/false
  const [telemetry, setTelemetry] = useState({
    cpu: null,
    ram: null,
    battery: null,
    volume: null,
    isMuted: false,
  });
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(true);

  // Ping Desktop Agent & poll telemetry
  useEffect(() => {
    let ws = null;
    let pollTimer = null;

    const checkAgent = async () => {
      try {
        const res = await axios.get(`${serverURL}/api/agent/ping`, {
          withCredentials: true,
          timeout: 3000,
        });
        const connected = res.data?.connected === true;
        setIsAgentConnected(connected);

        if (connected) {
          try {
            const statusRes = await axios.get(`${serverURL}/api/agent/status`, {
              withCredentials: true,
              timeout: 3000,
            });
            if (statusRes.data?.cpu) {
              setTelemetry({
                cpu: statusRes.data.cpu?.usage_percent ?? 0,
                ram: statusRes.data.ram?.usage_percent ?? 0,
                battery: statusRes.data.battery?.level ?? null,
                volume: statusRes.data.volume?.volume ?? 50,
                isMuted: statusRes.data.volume?.muted ?? false,
              });
            }
          } catch {
            // silent ignore
          }
        }
      } catch {
        setIsAgentConnected(false);
      }
    };

    checkAgent();
    pollTimer = setInterval(checkAgent, 8000);

    // Try WebSocket connection for live telemetry stream
    try {
      ws = new WebSocket("ws://127.0.0.1:2026/ws");
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === "telemetry" || payload.event === "connected") {
            setTelemetry((prev) => ({
              ...prev,
              cpu: payload.cpu?.usage_percent ?? prev.cpu,
              ram: payload.ram?.usage_percent ?? prev.ram,
              battery: payload.battery?.level ?? prev.battery,
              volume: payload.volume?.volume ?? prev.volume,
              isMuted: payload.volume?.muted ?? prev.isMuted,
            }));
          }
        } catch {
          // ignore parse errors
        }
      };
      ws.onerror = () => {};
    } catch {
      // ignore
    }

    return () => {
      clearInterval(pollTimer);
      if (ws) ws.close();
    };
  }, [serverURL]);

  // Handle master volume change via Agent
  const handleVolumeChange = async (newVol) => {
    setTelemetry((prev) => ({ ...prev, volume: newVol }));
    try {
      await axios.post(
        `${serverURL}/api/agent/volume`,
        { level: Number(newVol) },
        { withCredentials: true }
      );
    } catch (err) {
      console.warn("Could not set agent volume:", err);
    }
  };

  // Handle Quick Actions
  const handleQuickAction = async (endpoint, payload = {}) => {
    try {
      await axios.post(`${serverURL}${endpoint}`, payload, { withCredentials: true });
    } catch (err) {
      console.error(`Quick action failed for ${endpoint}:`, err);
    }
  };

  return {
    isAgentConnected,
    telemetry,
    isTelemetryOpen,
    setIsTelemetryOpen,
    handleVolumeChange,
    handleQuickAction,
  };
}
