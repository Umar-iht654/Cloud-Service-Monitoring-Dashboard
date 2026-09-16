import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import * as authApi from "../api/auth";
import { TOKEN_STORAGE_KEY } from "../api/client";
import type { LoginResponse, RegisterResponse, User } from "../types/api";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresAuthentication: boolean;
  restorationFailed: boolean;
  retryRestoration: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<RegisterResponse>;
  completeLogin: (data: LoginResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresAuthentication, setRequiresAuthentication] = useState(false);
  const [restorationFailed, setRestorationFailed] = useState(false);
  const [restorationAttempt, setRestorationAttempt] = useState(0);

  const retryRestoration = useCallback(() => {
    setIsLoading(true);
    setRestorationFailed(false);
    setRestorationAttempt((attempt) => attempt + 1);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setRequiresAuthentication(false);
    setRestorationFailed(false);
  }, []);

  const expireSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setRequiresAuthentication(true);
    setRestorationFailed(false);
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!token) {
      setIsLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    authApi
      .getCurrentUser(controller.signal)
      .then(({ data }) => {
        if (!active || localStorage.getItem(TOKEN_STORAGE_KEY) !== token) return;
        setRestorationFailed(false);
        setUser(data.user);
        setRequiresAuthentication(false);
      })
      .catch((error: unknown) => {
        if (!active || axios.isCancel(error)) return;
        if (localStorage.getItem(TOKEN_STORAGE_KEY) !== token) return;
        if (
          axios.isAxiosError(error) &&
          (error.response?.status === 401 || error.response?.status === 404)
        ) {
          expireSession();
          return;
        }

        // A stored session that could not be restored is not a resolved anonymous visit.
        setRequiresAuthentication(true);
        setRestorationFailed(true);
        setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [expireSession, restorationAttempt]);

  useEffect(() => {
    window.addEventListener("auth:unauthorized", expireSession);
    return () => window.removeEventListener("auth:unauthorized", expireSession);
  }, [expireSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(data.user);
    setRequiresAuthentication(false);
    setRestorationFailed(false);
  }, []);

  const completeLogin = useCallback((data: LoginResponse) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(data.user);
    setRequiresAuthentication(false);
    setRestorationFailed(false);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { data } = await authApi.register(name, email, password);
      return data;
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      requiresAuthentication,
      restorationFailed,
      retryRestoration,
      login,
      register,
      completeLogin,
      logout,
    }),
    [user, isLoading, requiresAuthentication, restorationFailed, retryRestoration, login, register, completeLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- colocating the hook keeps the auth API cohesive.
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
