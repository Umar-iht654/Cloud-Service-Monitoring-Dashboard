import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { CloseIcon, PlusIcon } from "../components/ui/Icons";
import { useAuth } from "./AuthContext";

export type AuthPromptIntent = "add-service" | "manage-service";

interface AuthPromptContextValue {
  openAuthPrompt: (intent: AuthPromptIntent, trigger?: HTMLElement | null) => void;
}

const AuthPromptContext = createContext<AuthPromptContextValue | undefined>(undefined);

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, requiresAuthentication } = useAuth();
  const navigate = useNavigate();
  const [intent, setIntent] = useState<AuthPromptIntent | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const createAccountRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);
  const titleId = useId();
  const descriptionId = useId();
  const isOpen =
    intent !== null && !isLoading && !isAuthenticated && !requiresAuthentication;

  const closeAuthPrompt = useCallback(() => {
    restoreFocusRef.current = true;
    setIntent(null);
  }, []);

  const openAuthPrompt = useCallback(
    (nextIntent: AuthPromptIntent, trigger?: HTMLElement | null) => {
      if (isLoading || isAuthenticated || requiresAuthentication) return;

      triggerRef.current =
        trigger ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      restoreFocusRef.current = true;
      setIntent(nextIntent);
    },
    [isAuthenticated, isLoading, requiresAuthentication],
  );

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      createAccountRef.current?.focus();
    });
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAuthPrompt();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (restoreFocusRef.current) {
        const trigger = triggerRef.current;
        if (trigger?.isConnected) {
          trigger.focus();
        } else {
          document
            .querySelector<HTMLElement>('button[aria-label="Open navigation"]')
            ?.focus();
        }
      }

      triggerRef.current = null;
      restoreFocusRef.current = true;
    };
  }, [closeAuthPrompt, isOpen]);

  const navigateToAuthentication = (destination: "login" | "register") => {
    restoreFocusRef.current = false;
    setIntent(null);

    if (destination === "login") {
      navigate("/login", {
        state:
          intent === "add-service"
            ? { from: { pathname: "/services/new" } }
            : undefined,
      });
      return;
    }

    navigate("/register");
  };

  const value = useMemo(() => ({ openAuthPrompt }), [openAuthPrompt]);

  return (
    <AuthPromptContext.Provider value={value}>
      <div
        aria-hidden={isOpen ? true : undefined}
        inert={isOpen ? true : undefined}
      >
        {children}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close authentication prompt"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={closeAuthPrompt}
          />
          <section
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="notice-enter relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl focus:outline-none sm:p-7"
          >
            <button
              type="button"
              aria-label="Close authentication prompt"
              onClick={closeAuthPrompt}
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
              <PlusIcon className="h-6 w-6" />
            </div>
            <h2
              id={titleId}
              className="mt-5 pr-10 text-2xl font-semibold tracking-[-0.03em] text-slate-950"
            >
              Monitor your own services
            </h2>
            <p id={descriptionId} className="mt-3 text-sm leading-6 text-slate-600">
              Sign in or create a free account to add and manage your own websites and APIs
              with StatusWatch.
            </p>

            <div className="mt-7 space-y-3">
              <button
                ref={createAccountRef}
                type="button"
                onClick={() => navigateToAuthentication("register")}
                className="primary-action flex w-full items-center justify-center rounded-xl bg-[#07111f] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 focus:outline-none focus:ring-4 focus:ring-cyan-500/20"
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => navigateToAuthentication("login")}
                className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={closeAuthPrompt}
                className="flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
              >
                Continue browsing
              </button>
            </div>
          </section>
        </div>
      )}
    </AuthPromptContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components -- colocating the hook keeps the prompt API cohesive.
export function useAuthPrompt() {
  const context = useContext(AuthPromptContext);

  if (!context) {
    throw new Error("useAuthPrompt must be used inside AuthPromptProvider");
  }

  return context;
}
