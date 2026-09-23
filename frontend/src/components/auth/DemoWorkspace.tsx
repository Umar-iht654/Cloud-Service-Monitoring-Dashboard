import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ActivityIcon, AnnouncementIcon } from "../ui/Icons";

function DemoAuthLinks({
  sidebar = false,
  onNavigate,
}: {
  sidebar?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className={sidebar ? "mt-5 grid gap-3" : "grid shrink-0 gap-2 sm:flex"}>
      <Link
        to="/register"
        onClick={onNavigate}
        className="primary-action inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/15 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-500"
      >
        Create account
      </Link>
      <Link
        to="/login"
        onClick={onNavigate}
        className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border px-5 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-500 ${
          sidebar
            ? "border-slate-600 bg-white/5 text-white hover:bg-white/10"
            : "border-blue-400 bg-white/30 text-blue-700 hover:bg-white/70"
        }`}
      >
        Sign in
      </Link>
    </div>
  );
}

export function DemoBanner() {
  const { isAnonymous } = useAuth();
  if (!isAnonymous) return null;

  return (
    <section
      aria-label="Demo workspace"
      className="mb-4 flex flex-col gap-4 rounded-2xl border border-violet-300/70 bg-linear-to-r from-violet-200/90 to-blue-100/90 p-4 shadow-sm shadow-violet-200/30 sm:p-5 xl:flex-row xl:items-center xl:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3 xl:items-center">
        <AnnouncementIcon className="mt-0.5 h-6 w-6 shrink-0 text-violet-700 xl:mt-0" />
        <p className="text-sm leading-6 text-indigo-950">
          <strong className="font-semibold text-violet-800">Demo workspace</strong>
          {" — You're viewing sample monitoring data. Sign in or create an account to monitor your own services."}
        </p>
      </div>
      <DemoAuthLinks />
    </section>
  );
}

export function DemoAccountCTA({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="rounded-2xl border border-cyan-200/15 bg-white/[0.025] px-4 py-5 text-center shadow-lg shadow-black/10">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-200/10 text-cyan-300">
        <ActivityIcon className="h-6 w-6" />
      </div>
      <p className="text-base font-semibold leading-6 text-white">Ready to monitor your own services?</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        Create an account to add your services and get real monitoring data.
      </p>
      <DemoAuthLinks sidebar onNavigate={onNavigate} />
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="shrink-0 rounded-full border border-violet-300/30 bg-violet-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm shadow-violet-500/20">
      DEMO
    </span>
  );
}

export function SampleDataBadge({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${
      onDark
        ? "border-indigo-300/25 bg-indigo-400/25 text-indigo-100"
        : "border-indigo-200 bg-indigo-100 text-indigo-700"
    }`}>
      Sample data
    </span>
  );
}
