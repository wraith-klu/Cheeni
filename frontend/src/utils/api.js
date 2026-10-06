import axios from "axios";

export const API_BASE_URL = "http://localhost:2025";

// In-memory access token storage (XSS safe - never kept in localStorage)
let inMemoryAccessToken = null;

export const setAccessToken = (token) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = () => inMemoryAccessToken;

export const clearAccessToken = () => {
  inMemoryAccessToken = null;
};

// Create a dedicated Axios client
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor: attach in-memory access token as Bearer token if present
apiClient.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 429 and token_expired 401 with automatic silent refresh queue
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is a 401 with token_expired and hasn't been retried yet
    const isTokenExpired =
      error.response?.status === 401 &&
      (error.response?.data?.error === "token_expired" ||
        error.response?.data?.message?.includes("expired")) &&
      !originalRequest._retry;

    if (isTokenExpired) {
      if (isRefreshing) {
        // Queue concurrent requests while refresh is in flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint (httpOnly cookie automatically sent with withCredentials: true)
        const refreshRes = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshRes.data?.accessToken;
        if (newAccessToken) {
          setAccessToken(newAccessToken);
          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        } else {
          throw new Error("No access token returned from refresh");
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAccessToken();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

/**
 * streamAsk — native fetch SSE client for POST /api/assistant/ask/stream
 *
 * Uses fetch + ReadableStream instead of Axios because Axios buffers responses,
 * which defeats the purpose of streaming. Handles auth token attachment and
 * a single silent refresh on 401 (token_expired) the same way the Axios
 * interceptor does.
 *
 * @param {string} prompt       - The user's message
 * @param {object} callbacks    - { onMeta, onChunk, onDone, onError }
 * @returns {Promise<void>}
 */
export const streamAsk = async (prompt, { onMeta, onChunk, onDone, onError } = {}) => {
  const url = `${API_BASE_URL}/api/assistant/ask/stream`;

  const doFetch = async (token) => {
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    return fetch(url, {
      method: "POST",
      credentials: "include",          // send httpOnly refresh-token cookie
      headers,
      body: JSON.stringify({ prompt }),
    });
  };

  let res = await doFetch(inMemoryAccessToken);

  // Attempt silent token refresh on token_expired 401
  if (res.status === 401) {
    try {
      const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newToken = refreshData?.accessToken;
        if (newToken) {
          setAccessToken(newToken);
          res = await doFetch(newToken);
        }
      }
    } catch {
      // refresh failed — proceed with the original 401 response
    }
    if (!res.ok) {
      onError?.("Authentication failed. Please log in again.");
      clearAccessToken();
      return;
    }
  }

  if (!res.ok) {
    onError?.(`Request failed (${res.status}). Please try again.`);
    return;
  }

  // Read SSE stream line-by-line
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // retain incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(trimmed.slice(6));
          switch (event.type) {
            case "meta":
              onMeta?.(event);
              break;
            case "chunk":
              onChunk?.(event.text);
              break;
            case "done":
              onDone?.(event);
              break;
            case "error":
              onError?.(event.message || "An error occurred.");
              break;
            default:
              break;
          }
        } catch {
          // malformed SSE line — skip silently
        }
      }
    }
  } catch (fetchErr) {
    // Network error mid-stream (e.g. offline, timeout)
    onError?.("Connection lost. Please check your internet and try again.");
  } finally {
    reader.releaseLock();
  }
};
