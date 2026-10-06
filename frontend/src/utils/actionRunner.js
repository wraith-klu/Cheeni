import axios from "axios";

/**
 * Cheeni Agentic Action Execution Engine
 * Executes commands on the user's laptop/browser when triggered by Cheeni.
 * Connects to both the Express backend agent bridge and the local Python desktop agent.
 */

export const executeAgenticAction = async (action, serverURL = "http://localhost:2025") => {
  if (!action || !action.type) {
    return { executed: false };
  }

  try {
    switch (action.type) {
      case "launch_app": {
        const appName = action.app || action.label || "calculator";
        let launched = false;

        // 1. Try Backend Agent Bridge
        try {
          const res = await axios.post(
            `${serverURL}/api/agent/launch`,
            { app: appName },
            { withCredentials: true, timeout: 3500 }
          );
          if (res.data?.success) {
            launched = true;
          }
        } catch (bridgeErr) {
          console.warn("[Cheeni Action] Backend bridge launch failed, trying direct agent:", bridgeErr.message);
        }

        // 2. Try direct call to Python Desktop Agent (127.0.0.1:2026)
        if (!launched) {
          try {
            const directRes = await fetch("http://127.0.0.1:2026/api/launch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ app: appName }),
            });
            const directData = await directRes.json();
            if (directData.success) {
              launched = true;
            }
          } catch (directErr) {
            console.warn("[Cheeni Action] Direct desktop agent launch failed:", directErr.message);
          }
        }

        // 3. Fallback: Known Windows URI schemes for browser invocation
        if (!launched) {
          const q = appName.toLowerCase();
          if (q.includes("calc")) {
            window.location.href = "calculator:";
            launched = true;
          } else if (q.includes("setting")) {
            window.location.href = "ms-settings:";
            launched = true;
          }
        }

        return {
          executed: true,
          type: "launch_app",
          app: appName,
          label: action.label || `Launched ${appName}`,
          success: launched,
        };
      }

      case "open_url":
      case "play_music":
      case "search_web": {
        const targetUrl = action.url;
        let openedAtOS = false;

        // 1. First priority: Open natively at the OS level via Desktop Agent
        // This bypasses browser popup blockers completely in Brave, Chrome, and Edge!
        if (targetUrl) {
          try {
            const res = await axios.post(
              `${serverURL}/api/agent/open`,
              { url: targetUrl },
              { withCredentials: true, timeout: 3500 }
            );
            if (res.data?.success) {
              openedAtOS = true;
            }
          } catch {
            // Direct agent fallback
            try {
              const directRes = await fetch("http://127.0.0.1:2026/api/open", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: targetUrl }),
              });
              const directData = await directRes.json();
              if (directData.success) {
                openedAtOS = true;
              }
            } catch {
              // agent offline
            }
          }
        }

        // 2. Browser popup open attempt (if agent was offline or as secondary fallback)
        let tab = null;
        if (!openedAtOS && targetUrl) {
          try {
            tab = window.open(targetUrl, "_blank", "noopener,noreferrer");
          } catch (wErr) {
            console.warn("[Cheeni Action] window.open blocked:", wErr);
          }
        }

        return {
          executed: true,
          type: action.type,
          label: action.label || action.query || "Opened webpage",
          url: targetUrl,
          success: openedAtOS || !!tab,
          openedAtOS,
          blocked: !openedAtOS && !tab,
        };
      }

      case "system_status": {
        let batteryInfo = null;

        if (action.subType === "battery" || !action.subType) {
          if (navigator && "getBattery" in navigator) {
            try {
              const battery = await navigator.getBattery();
              const level = Math.round(battery.level * 100);
              const charging = battery.charging ? "Charging" : "Not Charging";
              batteryInfo = { level, charging };
            } catch (bErr) {
              console.warn("Battery API unavailable:", bErr);
            }
          }
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const dateStr = now.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        return {
          executed: true,
          type: "system_status",
          time: timeStr,
          date: dateStr,
          battery: batteryInfo,
          label: batteryInfo
            ? `Battery: ${batteryInfo.level}% (${batteryInfo.charging}) | ${timeStr}`
            : `System Time: ${timeStr}, ${dateStr}`,
        };
      }

      case "copy_text": {
        if (action.text && navigator.clipboard) {
          await navigator.clipboard.writeText(action.text);
          return {
            executed: true,
            type: "copy_text",
            label: "Copied text to clipboard",
          };
        }
        break;
      }

      case "window_control": {
        const actionName = action.subType || "minimize"; // minimize, maximize, restore, close, snap, desktop, virtual_desktop
        const target = action.target;
        
        try {
          const endpoint = `/api/agent/windows/${actionName}`;
          let payload = { target };
          if (actionName === "snap") payload.position = action.position || "left";
          if (actionName === "virtual_desktop") payload.direction = action.direction || "next";

          const res = await axios.post(
            `${serverURL}${endpoint}`,
            payload,
            { withCredentials: true, timeout: 3500 }
          );
          
          return {
            executed: true,
            type: "window_control",
            label: action.label || `Window Action: ${actionName}`,
            success: res.data?.success,
            data: res.data,
          };
        } catch (err) {
          console.warn("[Cheeni Action] Window control failed:", err.message);
          return { executed: false, error: err.message };
        }
      }

      case "list_windows": {
        try {
          const res = await axios.get(`${serverURL}/api/agent/windows`, {
            withCredentials: true,
            timeout: 3500
          });
          return {
            executed: true,
            type: "list_windows",
            label: "Listed Open Windows",
            success: res.data?.success,
            data: res.data?.windows,
          };
        } catch (err) {
          console.warn("[Cheeni Action] List windows failed:", err.message);
          return { executed: false, error: err.message };
        }
      }

      case "file_control": {
        const actionName = action.subType || "search";
        const endpoint = `/api/agent/files/${actionName}`;
        try {
          const res = await axios.post(
            `${serverURL}${endpoint}`,
            action.payload || {},
            { withCredentials: true, timeout: 5000 }
          );
          
          return {
            executed: true,
            type: "file_control",
            label: action.label || `File Action: ${actionName}`,
            success: res.data?.success,
            data: res.data,
          };
        } catch (err) {
          console.warn("[Cheeni Action] File control failed:", err.message);
          return { executed: false, error: err.message };
        }
      }

      case "web_intelligence": {
        const actionName = action.subType || "search"; // search, news, scrape
        const endpoint = `/api/agent/web/${actionName}`;
        try {
          const res = await axios.post(
            `${serverURL}${endpoint}`,
            action.payload || {},
            { withCredentials: true, timeout: 10000 }
          );
          
          return {
            executed: true,
            type: "web_intelligence",
            label: action.label || `Web Intel: ${actionName}`,
            success: res.data?.success,
            data: res.data,
          };
        } catch (err) {
          console.warn("[Cheeni Action] Web intelligence failed:", err.message);
          return { executed: false, error: err.message };
        }
      }

      default:
        console.warn("Unknown agentic action type:", action.type);
        return { executed: false, error: "Unknown action" };
    }
  } catch (err) {
    console.error("Failed to execute agentic action:", err);
    return { executed: false, error: err.message };
  }

  return { executed: false };
};

export default executeAgenticAction;
