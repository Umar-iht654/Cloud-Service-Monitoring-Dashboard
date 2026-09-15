import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import { AuthRequiredLink } from "../components/auth/AuthRequiredLink";
import { SummaryCard } from "../components/dashboard/SummaryCard";
import { LightRays } from "../components/effects/LightRays";
import { ReportsPageSkeleton } from "../components/reports/ReportsPageSkeleton";
import { ReportTrendChart } from "../components/reports/ReportTrendChart";
import { ServiceReliabilityTable } from "../components/reports/ServiceReliabilityTable";
import { ErrorState } from "../components/ui/ErrorState";
import {
  ActivityIcon,
  AlertIcon,
  CheckIcon,
  ClockIcon,
  GlobeIcon,
  RefreshIcon,
} from "../components/ui/Icons";
import { useMonitoringReadSource } from "../hooks/useMonitoringReadSource";
import type { OverviewReport, OverviewServiceReport, ReportRange } from "../types/api";
import { formatDateTime, formatMilliseconds, formatPercentage } from "../utils/formatters";
import { servicePath } from "../utils/serviceRoutes";

const reportRanges: Array<{ value: Extract<ReportRange, "7d" | "30d">; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const rangeLabel = (range: ReportRange) =>
  reportRanges.find((option) => option.value === range)?.label ?? range;

const reportDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatReportPeriod(report: OverviewReport) {
  const start = reportDateFormatter.format(new Date(report.period_start));
  const end = reportDateFormatter.format(new Date(report.period_end));
  return `${start} - ${end}`;
}

function ReliabilityHighlight({
  label,
  service,
  emphasis,
}: {
  label: string;
  service: OverviewServiceReport;
  emphasis: "best" | "worst";
}) {
  const isBest = emphasis === "best";

  return (
    <article className="premium-surface rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <Link
            to={servicePath(service.service_id, service.service_name)}
            className="mt-2 block break-words text-lg font-semibold tracking-[-0.025em] text-slate-950 underline decoration-cyan-300/70 decoration-2 underline-offset-4 transition hover:text-cyan-700"
          >
            {service.service_name}
          </Link>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
            isBest
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : "bg-rose-50 text-rose-700 ring-rose-100"
          }`}
        >
          {isBest ? <CheckIcon className="h-5 w-5" /> : <AlertIcon className="h-5 w-5" />}
        </span>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Uptime</dt>
          <dd className={`metric-tabular mt-1 font-semibold ${isBest ? "text-emerald-700" : "text-rose-700"}`}>
            {formatPercentage(service.uptime_percentage)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Failed</dt>
          <dd className="metric-tabular mt-1 font-semibold text-slate-800">{service.failed_checks.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Avg. time</dt>
          <dd className="metric-tabular mt-1 font-semibold text-slate-800">{formatMilliseconds(service.average_response_time_ms)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function ReportsPage() {
  const monitoringReadSource = useMonitoringReadSource();
  const [range, setRange] = useState<Extract<ReportRange, "7d" | "30d">>("7d");
  const [report, setReport] = useState<OverviewReport | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const requestVersion = useRef(0);
  const reportRef = useRef<OverviewReport | null>(null);

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  const loadReport = useCallback(async (nextRange: ReportRange, preserveCurrent = false) => {
    const currentRequest = ++requestVersion.current;

    if (preserveCurrent) {
      setRefreshing(true);
      setRefreshError("");
    } else {
      setLoading(true);
      setError("");
    }

    try {
      const response = await monitoringReadSource.getOverviewReport(nextRange);
      if (currentRequest !== requestVersion.current) return;

      const nextReport = response;
      setReport({
        ...nextReport,
        services: nextReport.services ?? [],
        daily: nextReport.daily ?? [],
      });
      setLastUpdatedAt(new Date().toISOString());
    } catch (requestError) {
      if (currentRequest !== requestVersion.current) return;
      const message = getApiErrorMessage(requestError, "Unable to load monitoring reports.");
      if (preserveCurrent) setRefreshError(message);
      else setError(message);
    } finally {
      if (currentRequest === requestVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [monitoringReadSource]);

  useEffect(() => {
    void loadReport(range, reportRef.current !== null);
    return () => {
      requestVersion.current += 1;
    };
  }, [loadReport, range]);

  const rankedServices = useMemo(
    () =>
      [...(report?.services ?? [])].sort(
        (left, right) =>
          left.uptime_percentage - right.uptime_percentage ||
          right.failed_checks - left.failed_checks ||
          right.average_response_time_ms - left.average_response_time_ms ||
          left.service_name.localeCompare(right.service_name),
      ),
    [report?.services],
  );
  const worstService = rankedServices[0];
  const bestService = rankedServices.at(-1);
  const hasNoSummaryData =
    report !== null &&
    report.total_checks === 0 &&
    report.services.length === 0 &&
    report.daily.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <header className="dashboard-hero mb-7 rounded-[1.75rem] px-5 py-6 text-white sm:px-7 sm:py-7 lg:px-9">
        <LightRays
          className="dashboard-light-rays"
          origin="top-right"
          speed={0.45}
          spread={0.7}
          length={1.9}
          mouseInfluence={0.05}
        />
        <div className="relative z-10 flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.75)]" />
              Reliability intelligence
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-[2.8rem]">
              Monitoring reports
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              Availability, latency, and failure trends built from your available monitoring data.
            </p>
            {report && (
              <p className="mt-4 text-xs font-medium text-slate-400">
                Report period: {formatReportPeriod(report)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="inline-flex rounded-xl border border-white/10 bg-white/[0.06] p-1 backdrop-blur-sm"
              role="group"
              aria-label="Report range"
            >
              {reportRanges.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  aria-pressed={range === option.value}
                  disabled={refreshing && range === option.value}
                  className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 disabled:cursor-wait disabled:opacity-70 ${
                    range === option.value
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void loadReport(range, reportRef.current !== null)}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing reports" : "Refresh reports"}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <ReportsPageSkeleton />
      ) : error ? (
        <ErrorState
          title="Reports are unavailable"
          message={error}
          onRetry={() => void loadReport(range)}
        />
      ) : report ? (
        <div aria-busy={refreshing}>
          {refreshError && (
            <div
              role="status"
              aria-live="polite"
              className="notice-enter mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
            >
              <p>
                <span className="font-semibold">Refresh unsuccessful.</span>{" "}
                Showing the most recent {rangeLabel(report.range).toLowerCase()} report. {refreshError}
              </p>
              <button
                type="button"
                onClick={() => void loadReport(range, true)}
                className="shrink-0 self-start rounded-lg border border-amber-300 bg-white/70 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-white sm:self-auto"
              >
                Try again
              </button>
            </div>
          )}

          {hasNoSummaryData ? (
            <section className="premium-surface rounded-3xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:px-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                <ActivityIcon className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-slate-950">No monitoring data yet</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Reports will appear after your service completes its first health check.
              </p>
              <AuthRequiredLink
                to="/services/new"
                intent="add-service"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-cyan-500/20"
              >
                <GlobeIcon className="h-4 w-4" />
                Add a service
              </AuthRequiredLink>
            </section>
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Report summary">
                <SummaryCard
                  label="Overall uptime"
                  value={formatPercentage(report.uptime_percentage)}
                  helper={`${report.successful_checks.toLocaleString()} successful checks in the ${rangeLabel(report.range).toLowerCase()} lookback`}
                  icon={CheckIcon}
                  tone="emerald"
                  featured
                  delay={0}
                />
                <SummaryCard
                  label="Total checks"
                  value={report.total_checks.toLocaleString()}
                  helper={`${report.services.length.toLocaleString()} ${report.services.length === 1 ? "service" : "services"} with monitoring data`}
                  icon={ActivityIcon}
                  tone="cyan"
                  delay={50}
                />
                <SummaryCard
                  label="Failed checks"
                  value={report.failed_checks.toLocaleString()}
                  helper={`${formatPercentage(report.total_checks > 0 ? (report.failed_checks / report.total_checks) * 100 : 0)} of all checks`}
                  icon={AlertIcon}
                  tone="rose"
                  delay={100}
                />
                <SummaryCard
                  label="Average response"
                  value={formatMilliseconds(report.average_response_time_ms)}
                  helper={report.response_time_sample_count > 0 ? `${report.response_time_sample_count.toLocaleString()} response-time samples` : "No response-time samples"}
                  icon={ClockIcon}
                  tone="amber"
                  delay={150}
                />
              </section>

              {bestService && worstService && (
                <section className="mt-7" aria-labelledby="reliability-highlights-heading">
                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Service ranking</p>
                      <h2 id="reliability-highlights-heading" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">Reliability highlights</h2>
                    </div>
                    {lastUpdatedAt && <p className="text-xs text-slate-500">Updated {formatDateTime(lastUpdatedAt)}</p>}
                  </div>
                  {rankedServices.length === 1 ? (
                    <ReliabilityHighlight label="Reporting service" service={bestService} emphasis="best" />
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <ReliabilityHighlight label="Best-performing service" service={bestService} emphasis="best" />
                      <ReliabilityHighlight label="Needs the most attention" service={worstService} emphasis="worst" />
                    </div>
                  )}
                </section>
              )}

              <section className="mt-8" aria-labelledby="trend-heading">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Daily monitoring data</p>
                  <h2 id="trend-heading" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">Reliability trends</h2>
                  <p className="mt-1 text-sm text-slate-500">Daily values are aggregated across the services in your workspace.</p>
                </div>
                <div className="grid gap-5 xl:grid-cols-3">
                  <ReportTrendChart
                    title="Daily uptime"
                    description="Availability percentage for each reporting day."
                    data={report.daily}
                    metric="uptime"
                  />
                  <ReportTrendChart
                    title="Response time"
                    description="Average latency across measurements each day."
                    data={report.daily}
                    metric="responseTime"
                  />
                  <ReportTrendChart
                    title="Failed checks"
                    description="Checks marked down during each reporting day."
                    data={report.daily}
                    metric="failedChecks"
                  />
                </div>
              </section>

              <section className="mt-8" aria-labelledby="reliability-table-heading">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Service comparison</p>
                    <h2 id="reliability-table-heading" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">Service reliability</h2>
                    <p className="mt-1 text-sm text-slate-500">Ranked from the lowest reported uptime to the highest.</p>
                  </div>
                </div>
                <div className="premium-surface rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
                  <ServiceReliabilityTable services={rankedServices} />
                </div>
              </section>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
