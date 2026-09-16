import { api } from "./client";
import type {
  ApiMessage,
  CurrentUserResponse,
  LoginResponse,
  RegisterResponse,
  ResendVerificationResponse,
  VerificationSessionStatusResponse,
} from "../types/api";

export const VERIFICATION_SESSION_TOKEN_STORAGE_KEY = "cloud_monitor_verification_session_token";
export const VERIFICATION_SESSION_EXPIRES_AT_STORAGE_KEY = "cloud_monitor_verification_session_expires_at";

export function login(email: string, password: string) {
  return api.post<LoginResponse>("/api/auth/login", { email, password });
}

export function register(name: string, email: string, password: string) {
  return api.post<RegisterResponse>("/api/auth/register", {
    name,
    email,
    password,
  });
}

export function verifyEmail(token: string) {
  return api.get<ApiMessage>("/api/auth/verify-email", {
    params: { token },
  });
}

export function resendVerificationEmail(email: string) {
  return api.post<ResendVerificationResponse>("/api/auth/resend-verification", { email });
}

export function checkVerificationSessionStatus(token: string) {
  return api.post<VerificationSessionStatusResponse>("/api/auth/verification-session/status", { token });
}

export function getCurrentUser(signal?: AbortSignal) {
  return api.get<CurrentUserResponse>("/api/auth/me", { signal });
}
