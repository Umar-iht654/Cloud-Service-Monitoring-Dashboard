import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FullPageLoader } from "../ui/FullPageLoader";
import { useAuth } from "../../context/AuthContext";
import { useUnsavedChanges } from "../../context/UnsavedChangesContext";
import {
  ActivityIcon,
  AlertIcon,
  CloseIcon,
  GlobeIcon,
  GridIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  PulseIcon,
} from "../ui/Icons";

const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: GridIcon,
    isActive: (pathname: string) => pathname === "/dashboard",
  },
  {
    to: "/services",
    label: "Services",
    icon: GlobeIcon,
    isActive: (pathname: string) =>
      pathname === "/services" ||
      (pathname.startsWith("/services/") && pathname !== "/services/new"),
  },
  {
    to: "/alerts",
    label: "Alerts",
    icon: AlertIcon,
    isActive: (pathname: string) => pathname === "/alerts",
  },
  {
    to: "/reports",
    label: "Reports",
    icon: ActivityIcon,
    isActive: (pathname: string) => pathname === "/reports",
  },
  {
    to: "/services/new",
    label: "Add service",
    icon: PlusIcon,
    isActive: (pathname: string) => pathname === "/services/new",
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { confirmNavigation } = useUnsavedChanges();
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPathname =
    location.pathname.length > 1
      ? location.pathname.replace(/\/+$/, "")
      : location.pathname;
  const initials = user?.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    if (!confirmNavigation()) return;

    sessionStorage.setItem("auth_notice", "signed_out");
    logout();
    onNavigate?.();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/8 px-6">
        <div className="brand-pulse flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-[#07111f] shadow-lg shadow-cyan-400/20">
          <PulseIcon className="h-6 w-6" />
        </div>
        <div>
          <p className="font-semibold text-white">StatusWatch</p>
          <p className="text-xs text-slate-400">Service monitoring console</p>
        </div>
      </div>

      <div className="mx-4 mt-5 flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] px-3 py-2 text-xs font-medium text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]" />
        Monitoring workspace
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-7" aria-label="Main navigation">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Workspace
        </p>
        {navItems.map(({ to, label, icon: Icon, isActive }) => {
          const active = isActive(normalizedPathname);

          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`nav-item group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f] ${
                active
                  ? "nav-item-active bg-cyan-400/12 text-cyan-300 ring-1 ring-inset ring-cyan-300/10"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
              {active && <span className="sr-only">(current page)</span>}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/8 p-4">
        {isAuthenticated ? (
          <>
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-white">
                {initials || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
            >
              <LogOutIcon className="h-5 w-5" />
              Sign out
            </button>
          </>
        ) : (
          <div className="space-y-2">
            <Link
              to="/login"
              onClick={onNavigate}
              className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              onClick={onNavigate}
              className="flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/10 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isLoading, requiresAuthentication } = useAuth();
  const location = useLocation();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMobileMenuOpen(false);
    const animationFrame = window.requestAnimationFrame(() => mainRef.current?.focus());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [location.pathname]);

  useEffect(() => {
    const desktopBreakpoint = window.matchMedia("(min-width: 1024px)");
    const closeDrawerOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setMobileMenuOpen(false);
    };

    closeDrawerOnDesktop(desktopBreakpoint);
    desktopBreakpoint.addEventListener("change", closeDrawerOnDesktop);
    return () => desktopBreakpoint.removeEventListener("change", closeDrawerOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [mobileMenuOpen]);

  if (isLoading) {
    return <FullPageLoader label="Restoring your session" />;
  }

  if (requiresAuthentication) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
      />
    );
  }

  return (
    <div className="app-shell min-h-screen text-slate-900">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[70] -translate-y-24 rounded-xl bg-[#07111f] px-4 py-3 text-sm font-semibold text-white shadow-xl transition-transform focus:translate-y-0 focus:outline-none focus:ring-4 focus:ring-cyan-300/40"
      >
        Skip to main content
      </a>

      <aside className="sidebar-panel fixed inset-y-0 left-0 z-30 hidden w-64 overflow-hidden border-r border-white/5 lg:block">
        <SidebarContent />
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            tabIndex={-1}
            className="mobile-backdrop absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            ref={drawerRef}
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="sidebar-panel mobile-drawer relative h-full w-[min(82vw,20rem)] overflow-hidden shadow-2xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute right-3 top-5 z-10 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div
        className="relative z-10 min-w-0 lg:pl-64"
        aria-hidden={mobileMenuOpen ? true : undefined}
        inert={mobileMenuOpen ? true : undefined}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200/70 bg-white/80 px-4 shadow-[0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl sm:px-6 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/20 active:scale-[0.98]"
            aria-label="Open navigation"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="ml-3 flex min-w-0 items-center gap-2">
            <div className="brand-pulse flex h-8 w-8 items-center justify-center rounded-lg bg-[#07111f] text-cyan-300">
              <PulseIcon className="h-5 w-5" />
            </div>
            <span className="truncate font-semibold">StatusWatch</span>
          </div>
        </header>

        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="min-h-screen min-w-0 scroll-mt-20 focus:outline-none"
        >
          <div key={location.pathname} className="route-stage">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
