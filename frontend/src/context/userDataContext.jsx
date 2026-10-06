import { createContext, useState, useEffect } from "react";
import apiClient, { API_BASE_URL, setAccessToken, clearAccessToken } from "../utils/api.js";

export const UserDataContext = createContext();

export function UserDataProvider({ children }) {
  const serverURL = API_BASE_URL;

  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Image states (global)
  const [frontendImage, setFrontendImage] = useState(null); // File preview
  const [backendImage, setBackendImage] = useState(null);   // Actual file blob
  const [selectedImage, setSelectedImage] = useState(null); // Default image URL

  // Initialize session: attempt silent refresh on page load / hard refresh
  const initAuthSession = async () => {
    setAuthLoading(true);
    try {
      // 1. Attempt refresh using httpOnly refreshToken cookie
      const refreshRes = await apiClient.post("/api/auth/refresh");
      if (refreshRes.data?.accessToken) {
        setAccessToken(refreshRes.data.accessToken);
        if (refreshRes.data?.user) {
          setUserData(refreshRes.data.user);
          return;
        }
      }

      // 2. Fallback to /api/user/current if session cookie was active
      const userRes = await apiClient.get("/api/user/current");
      if (userRes.data?.user) {
        setUserData(userRes.data.user);
      }
    } catch {
      // User is not logged in or refresh token expired
      clearAccessToken();
      setUserData(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post("/api/auth/logout");
    } catch (e) {
      console.warn("Logout request note:", e);
    } finally {
      clearAccessToken();
      setUserData(null);
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
