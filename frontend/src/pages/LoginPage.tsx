import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import { AuthLayout } from "../components/layout/AuthLayout";
import { ArrowRightIcon } from "../components/ui/Icons";
import { FormField } from "../components/ui/FormField";
import { FullPageLoader } from "../components/ui/FullPageLoader";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login, logout, isAuthenticated, isLoading, restorationFailed, retryRestoration } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = location.state as {
    verificationSuccess?: boolean;
    signedOut?: boolean;
    email?: string;
    from?: { pathname?: string; search?: string; hash?: string };
  } | null;
  const [email, setEmail] = useState(navigationState?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [authNotice] = useState(() => sessionStorage.getItem("auth_notice"));
  const verificationSuccess = Boolean(navigationState?.verificationSuccess);
  const signedOut = authNotice === "signed_out" || Boolean(navigationState?.signedOut);
  const sessionExpired = authNotice === "session_expired";
  const requestedPath = navigationState?.from?.pathname;
  const safeRequestedPath =
    typeof requestedPath === "string" &&
    requestedPath.startsWith("/") &&
    !requestedPath.startsWith("//") &&
    !/\/edit\/*$/i.test(requestedPath) &&
    !/[\\%?#]/.test(requestedPath) &&
    !Array.from(requestedPath).some((character) => character.charCodeAt(0) <= 32) &&
    !["/login", "/register", "/verify-email"].includes(requestedPath.replace(/\/+$/, "").toLowerCase())
      ? `${requestedPath}${typeof navigationState?.from?.search === "string" && navigationState.from.search.startsWith("?") ? navigationState.from.search : ""}${typeof navigationState?.from?.hash === "string" && navigationState.from.hash.startsWith("#") ? navigationState.from.hash : ""}`
      : "/dashboard";

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (authNotice) sessionStorage.removeItem("auth_notice");
  }, [authNotice]);

  if (isLoading) {
    return <FullPageLoader label="Restoring your session" />;
  }

  if (isAuthenticated) {
    return <Navigate to={safeRequestedPath} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: { email?: string; password?: string } = {};
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      nextErrors.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) nextErrors.password = "Enter your password.";

    setFieldErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    setSubmitting(true);

    try {
      await login(normalizedEmail, password);
      navigate(safeRequestedPath, { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to sign in."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold text-cyan-600">Welcome back</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Sign in to your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Continue monitoring your services and reliability history.
        </p>
      </div>

      {restorationFailed && (
        <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>We couldn’t restore your session. Your saved sign-in is still available. Try again when your connection returns, or sign in below.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={retryRestoration} className="rounded font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600">
              Try again
            </button>
            <button type="button" onClick={() => { logout(); navigate("/dashboard", { replace: true }); }} className="rounded underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600">
              Sign out and continue browsing
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="notice-enter mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 focus:outline-none"
        >
          {error}
        </div>
      )}

      {verificationSuccess && !error && !sessionExpired && (
        <div
          role="status"
          aria-live="polite"
          className="notice-enter mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          Email verified successfully. Sign in to start monitoring.
        </div>
      )}

      {signedOut && !verificationSuccess && !sessionExpired && !error && (
        <div
          role="status"
          aria-live="polite"
          className="notice-enter mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          You have signed out successfully.
        </div>
      )}

      {sessionExpired && !error && (
        <div
          role="status"
          aria-live="polite"
          className="notice-enter mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Your session expired. Sign in again to continue where you left off.
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        aria-busy={submitting}
        className="space-y-5"
      >
        <FormField
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          autoFocus
          disabled={submitting}
          error={fieldErrors.email}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldErrors((current) => ({ ...current, email: undefined }));
            setError("");
          }}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          disabled={submitting}
          error={fieldErrors.password}
          passwordToggle
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, password: undefined }));
            setError("");
          }}
        />

        <button
          type="submit"
          disabled={submitting}
          className="primary-action group flex w-full items-center justify-center gap-2 rounded-xl bg-[#07111f] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting && <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        New to the dashboard?{" "}
        <Link
          to="/register"
          className="rounded font-semibold text-cyan-700 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
        >
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-slate-500">
        Waiting for a verification email?{" "}
        <Link
          to="/verify-email"
          className="rounded font-semibold text-cyan-700 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
        >
          Request another link
        </Link>
      </p>
    </AuthLayout>
  );
}
