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

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setRequiresAuthentication(false);
  }, []);

  const expireSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setRequiresAuthentication(true);
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!token) {
      setIsLoading(false);
      return;
    }

    authApi
      .getCurrentUser()
      .then(({ data }) => {
        setUser(data.user);
        setRequiresAuthentication(false);
      })
      .catch((error: unknown) => {
        if (
          axios.isAxiosError(error) &&
          (error.response?.status === 401 || error.response?.status === 404)
        ) {
          expireSession();
          return;
        }

        // A stored session that could not be restored is not a resolved anonymous visit.
        setRequiresAuthentication(true);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [expireSession]);

  useEffect(() => {
    window.addEventListener("auth:unauthorized", expireSession);
    return () => window.removeEventListener("auth:unauthorized", expireSession);
  }, [expireSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(data.user);
    setRequiresAuthentication(false);
  }, []);

  const completeLogin = useCallback((data: LoginResponse) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(data.user);
    setRequiresAuthentication(false);
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
      login,
      register,
      completeLogin,
      logout,
    }),
    [user, isLoading, requiresAuthentication, login, register, completeLogin, logout],
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
