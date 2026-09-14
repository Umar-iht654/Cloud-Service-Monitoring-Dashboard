import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../api/client";
import { AlertHistory } from "../components/alerts/AlertHistory";
import { AlertsPageSkeleton } from "../components/alerts/AlertsPageSkeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { ActivityIcon, AlertIcon, RefreshIcon } from "../components/ui/Icons";
import { useMonitoringReadSource } from "../hooks/useMonitoringReadSource";
import type { Alert } from "../types/api";
import { formatDateTime } from "../utils/formatters";

export function AlertsPage() {
  const monitoringReadSource = useMonitoringReadSource();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [returnedCount, setReturnedCount] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const requestVersion = useRef(0);

  const loadAlerts = useCallback(async (silent = false) => {
    const currentRequest = ++requestVersion.current;
    if (silent) {
      setRefreshing(true);
      setRefreshError("");
    } else {
      setLoading(true);
      setError("");
    }

    try {
      const response = await monitoringReadSource.getAlerts(50);
      if (currentRequest !== requestVersion.current) return;
      setAlerts(response.alerts);
      setReturnedCount(response.returned_count);
      setLastUpdatedAt(new Date().toISOString());
      setError("");
    } catch (requestError) {
      if (currentRequest !== requestVersion.current) return;
      const message = getApiErrorMessage(
        requestError,
        "Unable to load alert history.",
      );
      if (silent) setRefreshError(message);
      else setError(message);
    } finally {
      if (currentRequest === requestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [monitoringReadSource]);

  useEffect(() => {
    void loadAlerts();
    const interval = window.setInterval(() => void loadAlerts(true), 30_000);
    return () => {
      window.clearInterval(interval);
      requestVersion.current += 1;
    };
  }, [loadAlerts]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <AlertsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-9 sm:px-6">
        <ErrorState
          title="Alert history unavailable"
          message={error}
          onRetry={() => void loadAlerts()}
        />
      </div>
    );
  }

  const criticalCount = alerts.filter(
    (alert) => alert.severity.toLowerCase() === "critical",
  ).length;
  const affectedServices = new Set(alerts.map((alert) => alert.service_id)).size;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <header
        className="dashboard-hero rounded-[1.75rem] px-5 py-6 text-white sm:px-7 sm:py-7 lg:px-9"
        aria-busy={refreshing}
      >
        <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-300 shadow-[0_0_10px_rgba(253,164,175,0.75)]" />
              Incident timeline
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-[2.8rem]">
              Alert history
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              Important downtime transitions across the services in your monitoring workspace.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-sm">
              <ActivityIcon className="h-4 w-4 text-cyan-300" />
              Refreshes automatically every 30 seconds
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadAlerts(true)}
            disabled={refreshing}
            aria-label={refreshing ? "Refreshing alert history" : "Refresh alert history"}
            className="inline-flex self-start items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition hover:bg-white/10 disabled:opacity-60 lg:self-auto"
          >
            <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {refreshError && (
        <div
          role="status"
          aria-live="polite"
          className="notice-enter mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-semibold">Refresh unsuccessful.</span>{" "}
            Showing the most recent alert data. {refreshError}
          </p>
          <button
            type="button"
            onClick={() => void loadAlerts(true)}
            className="shrink-0 self-start rounded-lg border border-amber-300 bg-white/70 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-white sm:self-auto"
          >
            Try again
          </button>
        </div>
      )}

      <section className="mt-5 grid gap-4 sm:grid-cols-3" aria-label="Alert summary">
        <article className="premium-surface rounded-2xl border border-slate-200/80 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Loaded alerts
          </p>
          <p className="metric-tabular mt-2 text-2xl font-semibold text-slate-950">
            {returnedCount.toLocaleString()}
          </p>
        </article>
        <article className="premium-surface rounded-2xl border border-slate-200/80 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Critical in view
          </p>
          <p className="metric-tabular mt-2 text-2xl font-semibold text-rose-700">
            {criticalCount.toLocaleString()}
          </p>
        </article>
        <article className="premium-surface rounded-2xl border border-slate-200/80 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Services in view
          </p>
          <p className="metric-tabular mt-2 text-2xl font-semibold text-slate-950">
            {affectedServices.toLocaleString()}
          </p>
        </article>
      </section>

      <section className="premium-panel mt-5 rounded-3xl p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <AlertIcon className="h-5 w-5 text-rose-600" />
              <h2 className="text-lg font-semibold text-slate-950">Recent events</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Newest downtime alerts appear first. Repeated failed checks are not duplicated.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Last updated {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "Not yet"}
          </p>
        </div>
        <AlertHistory alerts={alerts} />
      </section>
    </div>
  );
}
