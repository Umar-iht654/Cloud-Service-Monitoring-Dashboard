import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { EmptyServices } from "../components/dashboard/EmptyServices";
import { SummaryCard } from "../components/dashboard/SummaryCard";
import { LightRays } from "../components/effects/LightRays";
import { ServiceCard } from "../components/services/ServiceCard";
import { ErrorState } from "../components/ui/ErrorState";
import {
  ActivityIcon,
  AlertIcon,
  CheckIcon,
  ClockIcon,
  GlobeIcon,
  PlusIcon,
  RefreshIcon,
} from "../components/ui/Icons";
import { useMonitoringReadSource } from "../hooks/useMonitoringReadSource";
import type { DashboardSummary, Service, ServiceSummary } from "../types/api";
import { formatDateTime, formatMilliseconds, formatPercentage } from "../utils/formatters";

export function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const monitoringReadSource = useMonitoringReadSource();
  const isServicesRoute = location.pathname.replace(/\/+$/, "") === "/services";
  const routeFeedback = location.state as {
    deleted?: boolean;
    deletedName?: string;
  } | null;
  const [successMessage] = useState(
    routeFeedback?.deleted
      ? `${routeFeedback.deletedName || "Service"} was deleted successfully.`
      : "",
  );
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSummaries, setServiceSummaries] = useState<Record<number, ServiceSummary>>({});
  const [serviceSummaryErrors, setServiceSummaryErrors] = useState<Record<number, true>>({});
  const [serviceSummaryLoading, setServiceSummaryLoading] = useState<Record<number, true>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const requestVersion = useRef(0);

  const loadDashboard = useCallback(async (silent = false) => {
    const currentRequest = ++requestVersion.current;
    if (silent) {
      setRefreshing(true);
      setRefreshError("");
    } else {
      setLoading(true);
      setError("");
    }

    try {
      const [summaryResponse, servicesResponse] = await Promise.all([
        monitoringReadSource.getDashboardSummary(),
        monitoringReadSource.getServices(),
      ]);

      const nextServices = servicesResponse.services;
      if (currentRequest !== requestVersion.current) return;

      setSummary(summaryResponse.summary);
      setServices(nextServices);
      setServiceSummaryErrors({});
      setServiceSummaryLoading(
        Object.fromEntries(nextServices.map((service) => [service.id, true])),
      );
      if (!silent) setLoading(false);

      const detailResults = await Promise.allSettled(
        nextServices.map((service) =>
          monitoringReadSource.getServiceSummary(service.id),
        ),
      );
      const summaries: Record<number, ServiceSummary> = {};
      const summaryErrors: Record<number, true> = {};
      detailResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          summaries[nextServices[index].id] = result.value.summary;
        } else {
          summaryErrors[nextServices[index].id] = true;
        }
      });

      if (currentRequest !== requestVersion.current) return;
      setServiceSummaries(summaries);
      setServiceSummaryErrors(summaryErrors);
      setServiceSummaryLoading({});
    } catch (requestError) {
      if (currentRequest !== requestVersion.current) return;
      const message = getApiErrorMessage(requestError, "Unable to load dashboard data.");
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
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(true), 30_000);
    return () => {
      window.clearInterval(interval);
      requestVersion.current += 1;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!routeFeedback?.deleted) return;
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate, routeFeedback?.deleted]);

  useEffect(() => {
    if (!isServicesRoute || loading || error) return;

    const animationFrame = window.requestAnimationFrame(() => {
      document.getElementById("monitored-services")?.scrollIntoView({
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [error, isServicesRoute, loading]);

  const healthMessage = loading
    ? "Syncing the latest telemetry"
    : (summary?.down_services ?? 0) > 0
      ? `${summary?.down_services} ${summary?.down_services === 1 ? "service needs" : "services need"} attention`
      : (summary?.slow_services ?? 0) > 0
        ? "All services available, with some degradation"
        : (summary?.total_services ?? 0) > 0
          ? "All monitored services are stable"
          : "Ready for your first endpoint";

  const signalBars = [28, 48, 38, 72, 51, 84, 57, 66, 43, 78, 48, 62, 34, 54, 30];

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <header className="dashboard-hero mb-7 rounded-[1.75rem] px-5 py-6 text-white sm:px-7 sm:py-7 lg:px-9">
        <LightRays
          className="dashboard-light-rays"
          origin="top-right"
          speed={0.5}
          spread={0.7}
          length={1.9}
          mouseInfluence={0.06}
        />
        <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.75)]" />
              Operations overview
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-[2.8rem]">
              Service health
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              Availability, latency, and reliability signals across every endpoint in your workspace.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-sm">
              <ActivityIcon className="h-4 w-4 text-cyan-300" />
              {healthMessage}
            </div>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="hidden items-end gap-4 border-r border-white/10 pr-6 xl:flex" aria-hidden="true">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Signal</p>
                <p className="mt-1 text-xs font-medium text-slate-300">30s refresh</p>
              </div>
              <div className="hero-signal">
                {signalBars.map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    style={{ height: `${height}%`, animationDelay: `${index * -120}ms` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
                aria-label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition hover:bg-white/10 disabled:opacity-60"
              >
                <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <Link
                to="/services/new"
                className="primary-action inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/15 focus:outline-none focus:ring-4 focus:ring-cyan-300/20"
              >
                <PlusIcon className="h-4 w-4" />
                Add service
              </Link>
            </div>
          </div>
        </div>
      </header>

      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="notice-enter mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {successMessage}
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadDashboard()} />
      ) : (
        <div aria-busy={refreshing}>
          {refreshError && (
            <div
              role="status"
              aria-live="polite"
              className="notice-enter mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
            >
              <p>
                <span className="font-semibold">Refresh unsuccessful.</span>{" "}
                Showing the most recent dashboard data. {refreshError}
              </p>
              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                className="shrink-0 self-start rounded-lg border border-amber-300 bg-white/70 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-white sm:self-auto"
              >
                Try again
              </button>
            </div>
          )}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12" aria-label="Dashboard summary">
            <SummaryCard className="xl:col-span-3" featured delay={0} label="Total services" value={summary?.total_services ?? 0} helper={`${summary?.unknown_services ?? 0} awaiting first check`} icon={GlobeIcon} tone="cyan" />
            <SummaryCard className="xl:col-span-2" delay={60} label="Online" value={summary?.online_services ?? 0} helper="Within threshold" icon={CheckIcon} tone="emerald" />
            <SummaryCard className="xl:col-span-2" delay={120} label="Slow" value={summary?.slow_services ?? 0} helper="Available, degraded" icon={ClockIcon} tone="amber" />
            <SummaryCard className="xl:col-span-2" delay={180} label="Down" value={summary?.down_services ?? 0} helper={`${summary?.failed_checks ?? 0} failed checks`} icon={AlertIcon} tone="rose" />
            <SummaryCard
              className="sm:col-span-2 xl:col-span-3"
              featured
              delay={240}
              label="Overall uptime"
              value={summary && summary.total_checks > 0 ? formatPercentage(summary.average_uptime_percentage) : "No data"}
              helper={`${summary?.total_checks.toLocaleString() ?? 0} checks completed`}
              icon={ActivityIcon}
              tone="slate"
            />
          </section>

          <section className="telemetry-strip mt-5 grid overflow-hidden rounded-2xl md:grid-cols-2">
            <div className="px-5 py-4 md:border-r md:border-slate-200/80">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Average response time</p>
              <p className="metric-tabular mt-1 text-lg font-semibold text-slate-900">
                {summary && summary.total_checks > 0 ? formatMilliseconds(summary.average_response_time_ms) : "No data yet"}
              </p>
            </div>
            <div className="border-t border-slate-200/80 px-5 py-4 md:border-t-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last monitoring activity</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatDateTime(summary?.last_checked_at)}</p>
            </div>
          </section>

          <section id="monitored-services" className="mt-9 scroll-mt-20">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Monitored services</h2>
                <p className="mt-1 text-sm text-slate-500">Automatically refreshed every 30 seconds.</p>
              </div>
              <span className="self-start rounded-full bg-slate-200/60 px-3 py-1 text-xs font-semibold text-slate-600 sm:self-auto">
                {services.length} {services.length === 1 ? "service" : "services"}
              </span>
            </div>

            {services.length === 0 ? (
              <EmptyServices />
            ) : (
              <div className="service-grid grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {services.map((service, index) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    summary={serviceSummaries[service.id]}
                    summaryError={serviceSummaryErrors[service.id]}
                    summaryLoading={serviceSummaryLoading[service.id]}
                    index={index}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
