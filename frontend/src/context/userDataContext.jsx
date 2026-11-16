import { createContext, useState, useEffect } from "react";
import apiClient, { API_BASE_URL, setAccessToken, clearAccessToken } from "../utils/api.js";

export const UserDataContext = createContext();

// ── Local session persistence keys ───────────────────────────────────────────
const LOCAL_USER_KEY = "cheeni_local_user";

function saveLocalSession(user) {
  if (user) {
    try { localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user)); } catch {}
  }
}

function loadLocalSession() {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function UserDataProvider({ children }) {
  const serverURL = API_BASE_URL;

  const [userData, setUserDataState] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Image states (global)
  const [frontendImage, setFrontendImage] = useState(null); // File preview
  const [backendImage, setBackendImage] = useState(null);   // Actual file blob
  const [selectedImage, setSelectedImage] = useState(null); // Default image URL

  // Wrap setUserData so we always persist locally too
  const setUserData = (userOrUpdater) => {
    setUserDataState((prev) => {
      const next = typeof userOrUpdater === "function" ? userOrUpdater(prev) : userOrUpdater;
      if (next) saveLocalSession(next);
      else { try { localStorage.removeItem(LOCAL_USER_KEY); } catch {} }
      return next;
    });
  };

  // Initialize session: attempt silent refresh on page load / hard refresh
  const initAuthSession = async () => {
    setAuthLoading(true);

    // ── 1. Try to restore from agent backend ────────────────────────────────
    try {
      const refreshRes = await apiClient.post("/api/auth/refresh", {}, { timeout: 4000 });
      if (refreshRes.data?.accessToken) {
        setAccessToken(refreshRes.data.accessToken);
        if (refreshRes.data?.user) {
          setUserData(refreshRes.data.user);
          setAuthLoading(false);
          return;
        }
      }
      // Fallback to /api/user/current if session cookie was active
      const userRes = await apiClient.get("/api/user/current", { timeout: 4000 });
      if (userRes.data?.user) {
        setUserData(userRes.data.user);
        setAuthLoading(false);
        return;
      }
    } catch {
      // Agent offline — fall through to local session
    }

    // ── 2. Agent offline: restore from localStorage ──────────────────────────
    const localUser = loadLocalSession();
    if (localUser) {
      setAccessToken("cheeni-local-session-token");
      setUserDataState(localUser); // Don't re-save (no change)
      setAuthLoading(false);
      return;
    }

    // ── 3. No session at all ─────────────────────────────────────────────────
    clearAccessToken();
    setUserDataState(null);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    try {
      await apiClient.post("/api/auth/logout");
    } catch (e) {
      console.warn("Logout request note:", e);
    } finally {
      clearAccessToken();
      try { localStorage.removeItem(LOCAL_USER_KEY); } catch {}
      setUserDataState(null);
    }
  };

  useEffect(() => {
    initAuthSession();
  }, []);

  const value = {
    serverURL,
    userData,
    setUserData,
    authLoading,
    handleLogout,
    frontendImage, setFrontendImage,
    backendImage, setBackendImage,
    selectedImage, setSelectedImage,
  };

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
}
