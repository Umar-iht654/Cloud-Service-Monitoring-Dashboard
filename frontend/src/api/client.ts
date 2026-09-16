import axios, { AxiosError } from "axios";

export const TOKEN_STORAGE_KEY = "cloud_monitor_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isAuthRequest =
      error.config?.url?.includes("/api/auth/login") ||
      error.config?.url?.includes("/api/auth/register");
    const isCurrentUserRequest = error.config?.url?.includes("/api/auth/me");
    const sessionIsInvalid =
      (error.response?.status === 401 && !isAuthRequest) ||
      (error.response?.status === 404 && isCurrentUserRequest);

    // A response from an earlier session must not expire a newer login or an anonymous visit.
    const currentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const belongsToCurrentSession =
      currentToken !== null &&
      error.config?.headers.Authorization === `Bearer ${currentToken}`;

    if (sessionIsInvalid && belongsToCurrentSession) {
      sessionStorage.setItem("auth_notice", "session_expired");
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.dispatchEvent(new Event("auth:unauthorized"));
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;

    if (message) return message;
    if (error.code === "ECONNABORTED") return "The request took too long. Please try again.";
    if (!error.response) return "Unable to reach the server. Check that the backend is running.";
  }

  return fallback;
}
