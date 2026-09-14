import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import { deleteService } from "../api/services";
import { AlertHistory } from "../components/alerts/AlertHistory";
import { HealthCheckTable } from "../components/services/HealthCheckTable";
import { ResponseTimeChart } from "../components/services/ResponseTimeChart";
import { ServiceDetailSkeleton } from "../components/services/ServiceDetailSkeleton";
import { ErrorState } from "../components/ui/ErrorState";
import {
  ArrowLeftIcon,
  EditIcon,
  ExternalLinkIcon,
  RefreshIcon,
  TrashIcon,
} from "../components/ui/Icons";
import { StatusBadge } from "../components/ui/StatusBadge";
import { authenticatedMonitoringReadSource as monitoringReadSource } from "../data/monitoringReadSource";
import type { Alert, HealthCheck, Service, ServiceSummary } from "../types/api";
import {
  formatDateTime,
  formatMilliseconds,
  formatPercentage,
} from "../utils/formatters";
import { serviceEditPath, servicePath, serviceSlug } from "../utils/serviceRoutes";

export function ServiceDetailPage() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [service, setService] = useState<Service | null>(null);
  const [summary, setSummary] = useState<ServiceSummary | null>(null);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [checksError, setChecksError] = useState("");
  const [alertsError, setAlertsError] = useState("");
  const requestVersion = useRef(0);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLElement>(null);
  const deletingRef = useRef(false);
  const routeFeedback = location.state as { created?: boolean; updated?: boolean } | null;
  const [successMessage] = useState(
    routeFeedback?.created
      ? "Service added. Its first health check will run shortly."
      : routeFeedback?.updated
        ? "Settings updated. Status will refresh after the next check."
        : "",
  );

  const loadService = useCallback(async (silent = false) => {
    if (!id) return;
    const currentRequest = ++requestVersion.current;
    if (silent) {
      setRefreshing(true);
      setRefreshError("");
    } else {
      setLoading(true);
      setError("");
    }
    setSummaryError("");
    setChecksError("");
    setAlertsError("");

    try {
      const [serviceResult, summaryResult, checksResult, alertsResult] =
        await Promise.allSettled([
          monitoringReadSource.getService(id),
          monitoringReadSource.getServiceSummary(id),
          // The table shows 25 by default and lets the user reveal the rest.
          monitoringReadSource.getHealthChecks(id, 100),
          monitoringReadSource.getServiceAlerts(id, 8),
        ]);
      if (currentRequest !== requestVersion.current) return;

      const refreshIssues: string[] = [];

      if (serviceResult.status === "fulfilled") {
        setService(serviceResult.value.service);
      } else {
        const message = getApiErrorMessage(
          serviceResult.reason,
          "Unable to load this service.",
        );
        refreshIssues.push("Service details could not be updated.");
        if (!silent) setError(message);
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value.summary);
      } else {
        setSummaryError(
          getApiErrorMessage(
            summaryResult.reason,
            "Service statistics are temporarily unavailable.",
          ),
        );
        refreshIssues.push("Statistics could not be updated.");
      }

      if (checksResult.status === "fulfilled") {
        setHealthChecks(checksResult.value.health_checks);
      } else {
        setChecksError(
          getApiErrorMessage(
            checksResult.reason,
            "Health-check history is temporarily unavailable.",
          ),
        );
        refreshIssues.push("Health-check history could not be updated.");
      }

      if (alertsResult.status === "fulfilled") {
        setAlerts(alertsResult.value.alerts);
      } else {
        setAlertsError(
          getApiErrorMessage(
            alertsResult.reason,
            "Alert history is temporarily unavailable.",
          ),
        );
        refreshIssues.push("Alert history could not be updated.");
      }

      if (silent && refreshIssues.length > 0) {
        setRefreshError(refreshIssues.join(" "));
      }
    } catch (requestError) {
      if (currentRequest !== requestVersion.current) return;
      const message = getApiErrorMessage(requestError, "Unable to load this service.");
      if (silent) setRefreshError(message);
      else setError(message);
    } finally {
      if (currentRequest === requestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [id]);

  useEffect(() => {
    void loadService();
    const interval = window.setInterval(() => void loadService(true), 30_000);
    return () => {
      window.clearInterval(interval);
      requestVersion.current += 1;
    };
  }, [loadService]);

  useEffect(() => {
    if (!service || !id) return;

    // Only canonicalise when the loaded service belongs to the current route.
    if (String(service.id) !== id) return;

    const canonicalPath = servicePath(service.id, service.name);
    // Keep readable service URLs canonical after legacy or stale-slug visits.
    if (!slug || slug !== serviceSlug(service.name)) {
      navigate(canonicalPath, { replace: true, state: location.state });
    }
  }, [id, location.state, navigate, service, slug]);

  useEffect(() => {
    if (!routeFeedback?.created && !routeFeedback?.updated) return;
    if (!service || !id || String(service.id) !== id) return;
    if (!slug || slug !== serviceSlug(service.name)) return;
    navigate(location.pathname, { replace: true, state: null });
  }, [id, location.pathname, navigate, routeFeedback?.created, routeFeedback?.updated, service, slug]);

  useEffect(() => {
    deletingRef.current = deleting;
    if (deleting && deleteDialogOpen) deleteDialogRef.current?.focus();
  }, [deleteDialogOpen, deleting]);

  useEffect(() => {
    if (!deleteDialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    const deleteTrigger = deleteTriggerRef.current;
    document.body.style.overflow = "hidden";
    deleteCancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletingRef.current) {
        setDeleteDialogOpen(false);
        return;
      }

      if (event.key !== "Tab" || !deleteDialogRef.current) return;
      const focusable = Array.from(
        deleteDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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
      deleteTrigger?.focus();
    };
  }, [deleteDialogOpen]);

  const handleDelete = async () => {
    if (!id || !service) return;
    setDeleting(true);
    try {
      await deleteService(id);
      navigate("/dashboard", {
        replace: true,
        state: { deleted: true, deletedName: service.name },
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to delete the service."));
      setDeleteDialogOpen(false);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <ServiceDetailSkeleton />
      </div>
    );
  }

  if (error && !service) {
    return <div className="mx-auto max-w-4xl px-4 py-9 sm:px-6"><ErrorState message={error} onRetry={() => void loadService()} /></div>;
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-9 sm:px-6">
        <ErrorState
          message={error || "This service could not be found."}
          onRetry={() => void loadService()}
        />
      </div>
    );
  }

  const summaryMetrics = [
    [
      "Uptime",
      summary
        ? summary.total_checks > 0
          ? formatPercentage(summary.uptime_percentage)
          : "No data"
        : "Unavailable",
    ],
    [
      "Average response",
      summary
        ? summary.total_checks > 0
          ? formatMilliseconds(summary.average_response_time_ms)
          : "No data"
        : "Unavailable",
    ],
    ["Total checks", summary ? summary.total_checks.toLocaleString() : "Unavailable"],
    ["Failed checks", summary ? summary.failed_checks.toLocaleString() : "Unavailable"],
    [
      "Last downtime",
      summary
        ? summary.last_down_at
          ? formatDateTime(summary.last_down_at)
          : "None recorded"
        : "Unavailable",
    ],
  ];
  const chartHealthChecks = healthChecks.slice(0, 25);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to dashboard
      </Link>

      {successMessage && (
        <div role="status" className="notice-enter mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}
      {error && (
        <div role="alert" className="notice-enter mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {refreshError && (
        <div
          role="status"
          aria-live="polite"
          className="notice-enter mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-semibold">Refresh unsuccessful.</span>{" "}
            Showing the most recent service data. {refreshError}
          </p>
          <button
            type="button"
            onClick={() => void loadService(true)}
            className="shrink-0 self-start rounded-lg border border-amber-300 bg-white/70 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-white sm:self-auto"
          >
            Try again
          </button>
        </div>
      )}

      <header
        className="detail-hero mt-5 flex flex-col gap-6 rounded-[1.75rem] p-6 text-white lg:flex-row lg:items-center lg:justify-between lg:p-8"
        aria-busy={refreshing}
      >
        <div className="relative z-10 min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={service.current_status} live />
            <span className="text-xs text-slate-400">Checking every {service.check_interval_seconds}s</span>
          </div>
          <h1 className="break-words text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{service.name}</h1>
          <a href={service.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-2 truncate text-sm text-cyan-300 transition hover:text-cyan-200">
            <span className="truncate">{service.url}</span>
            <ExternalLinkIcon className="h-4 w-4 shrink-0" />
          </a>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadService(true)}
            disabled={refreshing}
            aria-label={refreshing ? "Refreshing service details" : "Refresh service details"}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <Link to={serviceEditPath(service.id, service.name)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition hover:bg-white/10">
            <EditIcon className="h-4 w-4" />
            Edit
          </Link>
          <button
            ref={deleteTriggerRef}
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3.5 py-2.5 text-sm font-semibold text-rose-200 backdrop-blur-sm transition hover:bg-rose-400/15 disabled:opacity-60"
          >
            <TrashIcon className="h-4 w-4" />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </header>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryMetrics.map(([label, value], index) => (
          <article
            key={label}
            className={`detail-metric premium-surface rounded-2xl border border-slate-200/80 bg-white p-5 ${
              index === summaryMetrics.length - 1 ? "sm:col-span-2 xl:col-span-1" : ""
            }`}
            style={{ animationDelay: `${index * 55}ms` }}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="metric-tabular mt-2 break-words text-lg font-semibold text-slate-900">{value}</p>
          </article>
        ))}
      </section>

      {summaryError && !summary && (
        <div role="alert" className="notice-enter mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Statistics unavailable.</span> {summaryError}
        </div>
      )}

      <section className="premium-panel mt-5 rounded-3xl p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Response time</h2>
            <p className="mt-1 text-sm text-slate-500">Most recent {chartHealthChecks.length} checks, shown chronologically.</p>
          </div>
          <p className="text-xs text-slate-500">Last checked {formatDateTime(summary?.last_checked_at)}</p>
        </div>
        {checksError && healthChecks.length === 0 ? (
          <ErrorState
            title="Response history unavailable"
            message={checksError}
            onRetry={() => void loadService(true)}
          />
        ) : (
          <ResponseTimeChart healthChecks={chartHealthChecks} slowThresholdMs={service.slow_threshold_ms} />
        )}
      </section>

      <section className="premium-panel mt-5 rounded-3xl p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Recent alerts</h2>
            <p className="mt-1 text-sm text-slate-500">
              Important downtime transitions recorded separately from routine checks.
            </p>
          </div>
          <Link
            to="/alerts"
            className="mt-2 text-sm font-semibold text-cyan-700 transition hover:text-cyan-900 sm:mt-0"
          >
            View all alerts
          </Link>
        </div>
        {alertsError && alerts.length === 0 ? (
          <ErrorState
            title="Alert history unavailable"
            message={alertsError}
            onRetry={() => void loadService(true)}
          />
        ) : (
          <AlertHistory
            alerts={alerts}
            showService={false}
            emptyTitle="No alerts for this service"
            emptyMessage="No downtime transitions have been recorded for this service."
          />
        )}
      </section>

      <section className="premium-panel mt-5 rounded-3xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">Recent health checks</h2>
          <p className="mt-1 text-sm text-slate-500">HTTP results, timing, and failure details from the monitoring worker.</p>
        </div>
        {checksError && healthChecks.length === 0 ? (
          <ErrorState
            title="Health-check history unavailable"
            message={checksError}
            onRetry={() => void loadService(true)}
          />
        ) : (
          <HealthCheckTable healthChecks={healthChecks} />
        )}
      </section>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close delete confirmation"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => {
              if (!deleting) setDeleteDialogOpen(false);
            }}
          />
          <section
            ref={deleteDialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-busy={deleting}
            aria-labelledby="delete-service-title"
            aria-describedby="delete-service-description"
            className="notice-enter relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none sm:p-7"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <TrashIcon className="h-6 w-6" />
            </div>
            <h2 id="delete-service-title" className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
              Delete {service.name}?
            </h2>
            <p id="delete-service-description" className="mt-2 text-sm leading-6 text-slate-600">
              This permanently removes the service, its complete health-check
              history, and its alert history. This action cannot be undone.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={deleteCancelRef}
                type="button"
                disabled={deleting}
                onClick={() => setDeleteDialogOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-60"
              >
                Keep service
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete()}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete service"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
