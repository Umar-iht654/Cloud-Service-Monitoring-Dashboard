import type { MonitoringReadSource } from "./monitoringReadSource";
import type {
  Alert,
  DashboardSummary,
  HealthCheck,
  OverviewDailyReportPoint,
  OverviewReport,
  OverviewServiceReport,
  ReportRange,
  Service,
  ServiceStatus,
  ServiceSummary,
} from "../types/api";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const HISTORY_LENGTH = 100;
const REPORT_DAY_COUNT = 90;
const REPRESENTATIVE_OWNER_ID = 10_001;

// The relative clock is captured once so timestamps stay stable for the lifetime of the app.
const anchor = new Date();
anchor.setUTCSeconds(0, 0);
const DATA_ANCHOR_MS = anchor.getTime();
const CURRENT_DAY_START_MS = Date.UTC(
  anchor.getUTCFullYear(),
  anchor.getUTCMonth(),
  anchor.getUTCDate(),
);

const toIso = (timestamp: number) => new Date(timestamp).toISOString();
const createdAt = toIso(DATA_ANCHOR_MS - 95 * DAY_MS);

export const publicServiceIds = {
  customerPortal: 1_101,
  publicApiGateway: 1_102,
  authenticationService: 1_103,
  webhookDeliveryApi: 1_104,
  reportingApi: 1_105,
  documentationSite: 1_106,
} as const;

const publicServices: Service[] = [
  {
    id: publicServiceIds.customerPortal,
    user_id: REPRESENTATIVE_OWNER_ID,
    name: "Customer Portal",
    url: "https://portal.statuswatch.example",
    expected_status_code: 200,
    slow_threshold_ms: 400,
    check_interval_seconds: 300,
    current_status: "online",
    created_at: createdAt,
    updated_at: toIso(DATA_ANCHOR_MS - 70_000),
  },
  {
    id: publicServiceIds.publicApiGateway,
    user_id: REPRESENTATIVE_OWNER_ID,
    name: "Public API Gateway",
    url: "https://api.statuswatch.example/v1/health",
    expected_status_code: 200,
    slow_threshold_ms: 650,
    check_interval_seconds: 300,
    current_status: "online",
    created_at: createdAt,
    updated_at: toIso(DATA_ANCHOR_MS - 95_000),
  },
  {
    id: publicServiceIds.authenticationService,
    user_id: REPRESENTATIVE_OWNER_ID,
    name: "Authentication Service",
    url: "https://identity.statuswatch.example/health",
    expected_status_code: 200,
    slow_threshold_ms: 650,
    check_interval_seconds: 300,
    current_status: "slow",
    created_at: createdAt,
    updated_at: toIso(DATA_ANCHOR_MS - 50_000),
  },
  {
    id: publicServiceIds.webhookDeliveryApi,
    user_id: REPRESENTATIVE_OWNER_ID,
    name: "Webhook Delivery API",
    url: "https://webhooks.statuswatch.example/health",
    expected_status_code: 200,
    slow_threshold_ms: 900,
    check_interval_seconds: 600,
    current_status: "down",
    created_at: createdAt,
    updated_at: toIso(DATA_ANCHOR_MS - 80_000),
  },
  {
    id: publicServiceIds.reportingApi,
    user_id: REPRESENTATIVE_OWNER_ID,
    name: "Reporting API",
    url: "https://reports.statuswatch.example/health",
    expected_status_code: 200,
    slow_threshold_ms: 900,
    check_interval_seconds: 900,
    current_status: "online",
    created_at: createdAt,
    updated_at: toIso(DATA_ANCHOR_MS - 140_000),
  },
  {
    id: publicServiceIds.documentationSite,
    user_id: REPRESENTATIVE_OWNER_ID,
    name: "Documentation Site",
    url: "https://docs.statuswatch.example",
    expected_status_code: 200,
    slow_threshold_ms: 300,
    check_interval_seconds: 900,
    current_status: "online",
    created_at: createdAt,
    updated_at: toIso(DATA_ANCHOR_MS - 110_000),
  },
];

interface CheckReading {
  status: ServiceStatus;
  httpStatusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string;
}

const shortVariation = [0, 7, -5, 12, 3, -8, 5, -2, 9, -4] as const;
const wideVariation = [0, 42, -31, 86, -47, 24, 63, -18, 35, -56] as const;

function reachableReading(responseTimeMs: number, slowThresholdMs: number): CheckReading {
  return {
    status: responseTimeMs > slowThresholdMs ? "slow" : "online",
    httpStatusCode: 200,
    responseTimeMs,
    errorMessage: "",
  };
}

function httpFailure(responseTimeMs: number): CheckReading {
  return {
    status: "down",
    httpStatusCode: 502,
    responseTimeMs,
    errorMessage: "Expected HTTP status 200 but received 502",
  };
}

function timeoutFailure(): CheckReading {
  return {
    status: "down",
    httpStatusCode: null,
    responseTimeMs: null,
    errorMessage: "Request timed out after 15 seconds",
  };
}

function readingFor(service: Service, index: number): CheckReading {
  const shortOffset = shortVariation[index % shortVariation.length];
  const wideOffset = wideVariation[index % wideVariation.length];

  switch (service.id) {
    case publicServiceIds.customerPortal:
      if (index === 88) return httpFailure(312);
      return reachableReading(82 + shortOffset, service.slow_threshold_ms);

    case publicServiceIds.publicApiGateway:
      if (index === 12) return timeoutFailure();
      if (index === 21 || index === 22) return httpFailure(610 + index % 2 * 84);
      return reachableReading(238 + wideOffset, service.slow_threshold_ms);

    case publicServiceIds.authenticationService: {
      if (index === 84) return timeoutFailure();
      const responseTimeMs =
        index < 20
          ? 748 + (index % 5) * 28
          : index >= 45 && index <= 51
            ? 684 + (index % 4) * 34
            : 468 + wideOffset;
      return reachableReading(responseTimeMs, service.slow_threshold_ms);
    }

    case publicServiceIds.webhookDeliveryApi:
      if (index <= 8 || (index >= 55 && index <= 61)) {
        return index % 3 === 1 ? timeoutFailure() : httpFailure(870 + index % 5 * 91);
      }
      return reachableReading(318 + wideOffset, service.slow_threshold_ms);

    case publicServiceIds.reportingApi:
      if (index >= 20 && index <= 23) {
        return index % 2 === 0 ? timeoutFailure() : httpFailure(1_180 + index % 3 * 125);
      }
      if (index >= 10 && index <= 19) {
        return reachableReading(935 + index % 6 * 78, service.slow_threshold_ms);
      }
      return reachableReading(408 + wideOffset * 2, service.slow_threshold_ms);

    case publicServiceIds.documentationSite:
      return reachableReading(41 + Math.round(shortOffset / 2), service.slow_threshold_ms);
  }

  return reachableReading(0, service.slow_threshold_ms);
}

const latestCheckDelaySeconds: Record<number, number> = {
  [publicServiceIds.customerPortal]: 70,
  [publicServiceIds.publicApiGateway]: 95,
  [publicServiceIds.authenticationService]: 50,
  [publicServiceIds.webhookDeliveryApi]: 80,
  [publicServiceIds.reportingApi]: 140,
  [publicServiceIds.documentationSite]: 110,
};

function buildHealthCheckHistory(service: Service): HealthCheck[] {
  const latestDelayMs = latestCheckDelaySeconds[service.id] * 1_000;

  return Array.from({ length: HISTORY_LENGTH }, (_, index) => {
    const reading = readingFor(service, index);
    const checkedAt = toIso(
      DATA_ANCHOR_MS - latestDelayMs - index * service.check_interval_seconds * 1_000,
    );

    return {
      id: service.id * 1_000 + HISTORY_LENGTH - index,
      service_id: service.id,
      status: reading.status,
      http_status_code: reading.httpStatusCode,
      response_time_ms: reading.responseTimeMs,
      error_message: reading.errorMessage,
      checked_at: checkedAt,
      created_at: checkedAt,
    };
  });
}

const healthChecksByService = new Map<number, HealthCheck[]>(
  publicServices.map((service) => [service.id, buildHealthCheckHistory(service)]),
);

interface FailureDay {
  failedChecks: number;
  missingSamples: number;
}

interface DailyServiceProfile {
  checksPerDay: number;
  baseResponseTimeMs: number;
  responseTimeVariation: readonly number[];
  minResponseDeltaMs: number;
  maxResponseDeltaMs: number;
  incidentMaxExtraMs: number;
  failures: Readonly<Record<number, FailureDay>>;
  latencyAdjustments: Readonly<Record<number, number>>;
}

const dailyProfiles: Record<number, DailyServiceProfile> = {
  [publicServiceIds.customerPortal]: {
    checksPerDay: 288,
    baseResponseTimeMs: 84,
    responseTimeVariation: [-3, 1, 4, -2, 2, 0, 5],
    minResponseDeltaMs: 24,
    maxResponseDeltaMs: 46,
    incidentMaxExtraMs: 210,
    failures: {
      0: { failedChecks: 1, missingSamples: 0 },
      18: { failedChecks: 1, missingSamples: 0 },
      38: { failedChecks: 1, missingSamples: 0 },
      63: { failedChecks: 1, missingSamples: 0 },
    },
    latencyAdjustments: {},
  },
  [publicServiceIds.publicApiGateway]: {
    checksPerDay: 288,
    baseResponseTimeMs: 236,
    responseTimeVariation: [-18, 8, 31, -9, 14, 4, -25],
    minResponseDeltaMs: 92,
    maxResponseDeltaMs: 180,
    incidentMaxExtraMs: 520,
    failures: {
      0: { failedChecks: 3, missingSamples: 1 },
      3: { failedChecks: 2, missingSamples: 0 },
      12: { failedChecks: 3, missingSamples: 1 },
      23: { failedChecks: 2, missingSamples: 0 },
      53: { failedChecks: 2, missingSamples: 1 },
      75: { failedChecks: 3, missingSamples: 1 },
    },
    latencyAdjustments: {
      0: 58,
      3: 72,
      12: 49,
      23: 35,
    },
  },
  [publicServiceIds.authenticationService]: {
    checksPerDay: 288,
    baseResponseTimeMs: 492,
    responseTimeVariation: [-34, 11, 28, -16, 7, 39, -25],
    minResponseDeltaMs: 165,
    maxResponseDeltaMs: 260,
    incidentMaxExtraMs: 490,
    failures: {
      0: { failedChecks: 1, missingSamples: 1 },
      41: { failedChecks: 1, missingSamples: 1 },
      70: { failedChecks: 1, missingSamples: 1 },
    },
    latencyAdjustments: {
      0: 325,
      1: 276,
      2: 205,
      3: 128,
      4: 64,
      12: 92,
      13: 58,
    },
  },
  [publicServiceIds.webhookDeliveryApi]: {
    checksPerDay: 144,
    baseResponseTimeMs: 312,
    responseTimeVariation: [-27, 16, 45, -13, 28, 5, -36],
    minResponseDeltaMs: 128,
    maxResponseDeltaMs: 310,
    incidentMaxExtraMs: 1_120,
    failures: {
      0: { failedChecks: 18, missingSamples: 6 },
      6: { failedChecks: 26, missingSamples: 12 },
      11: { failedChecks: 14, missingSamples: 5 },
      22: { failedChecks: 9, missingSamples: 3 },
      43: { failedChecks: 10, missingSamples: 4 },
      58: { failedChecks: 12, missingSamples: 5 },
      80: { failedChecks: 8, missingSamples: 3 },
    },
    latencyAdjustments: {
      0: 408,
      1: 180,
      6: 286,
      7: 132,
      11: 214,
      22: 126,
      43: 118,
    },
  },
  [publicServiceIds.reportingApi]: {
    checksPerDay: 96,
    baseResponseTimeMs: 402,
    responseTimeVariation: [-104, 76, 158, -48, 31, 121, -82],
    minResponseDeltaMs: 205,
    maxResponseDeltaMs: 430,
    incidentMaxExtraMs: 920,
    failures: {
      0: { failedChecks: 4, missingSamples: 2 },
      5: { failedChecks: 7, missingSamples: 3 },
      14: { failedChecks: 5, missingSamples: 2 },
      29: { failedChecks: 6, missingSamples: 2 },
      48: { failedChecks: 4, missingSamples: 2 },
      72: { failedChecks: 5, missingSamples: 2 },
    },
    latencyAdjustments: {
      0: 192,
      5: 354,
      6: 188,
      14: 302,
      15: 146,
      29: 238,
      48: 190,
    },
  },
  [publicServiceIds.documentationSite]: {
    checksPerDay: 96,
    baseResponseTimeMs: 42,
    responseTimeVariation: [-3, 0, 2, -1, 1, 3, -2],
    minResponseDeltaMs: 15,
    maxResponseDeltaMs: 26,
    incidentMaxExtraMs: 0,
    failures: {},
    latencyAdjustments: {},
  },
};

type TelemetryTotals = Omit<
  OverviewDailyReportPoint,
  "period_start" | "period_end"
>;

interface DailyServiceTelemetry extends TelemetryTotals {
  service_id: number;
}

interface PublicMonitoringDay {
  periodStart: string;
  periodEnd: string;
  services: DailyServiceTelemetry[];
}

function roundPercentage(value: number) {
  return Math.round(value * 100) / 100;
}

function uptimePercentage(successfulChecks: number, totalChecks: number) {
  return totalChecks > 0
    ? roundPercentage(successfulChecks / totalChecks * 100)
    : 0;
}

function aggregateTelemetry(rows: readonly TelemetryTotals[]): TelemetryTotals {
  const totalChecks = rows.reduce((total, row) => total + row.total_checks, 0);
  const successfulChecks = rows.reduce(
    (total, row) => total + row.successful_checks,
    0,
  );
  const failedChecks = rows.reduce((total, row) => total + row.failed_checks, 0);
  const responseTimeSampleCount = rows.reduce(
    (total, row) => total + row.response_time_sample_count,
    0,
  );
  const weightedResponseTime = rows.reduce(
    (total, row) =>
      total + row.average_response_time_ms * row.response_time_sample_count,
    0,
  );
  const minimums = rows
    .map((row) => row.min_response_time_ms)
    .filter((value): value is number => value !== null);
  const maximums = rows
    .map((row) => row.max_response_time_ms)
    .filter((value): value is number => value !== null);

  return {
    total_checks: totalChecks,
    successful_checks: successfulChecks,
    failed_checks: failedChecks,
    response_time_sample_count: responseTimeSampleCount,
    average_response_time_ms:
      responseTimeSampleCount > 0
        ? Math.round(weightedResponseTime / responseTimeSampleCount)
        : 0,
    min_response_time_ms: minimums.length > 0 ? Math.min(...minimums) : null,
    max_response_time_ms: maximums.length > 0 ? Math.max(...maximums) : null,
    uptime_percentage: uptimePercentage(successfulChecks, totalChecks),
  };
}

function buildDailyServiceTelemetry(
  service: Service,
  daysAgo: number,
): DailyServiceTelemetry {
  const profile = dailyProfiles[service.id];
  const failure = profile.failures[daysAgo] ?? {
    failedChecks: 0,
    missingSamples: 0,
  };
  const chronologicalIndex = REPORT_DAY_COUNT - 1 - daysAgo;
  const responseVariation =
    profile.responseTimeVariation[
      chronologicalIndex % profile.responseTimeVariation.length
    ];
  const averageResponseTimeMs = Math.max(
    1,
    profile.baseResponseTimeMs +
      responseVariation +
      (profile.latencyAdjustments[daysAgo] ?? 0),
  );
  const successfulChecks = profile.checksPerDay - failure.failedChecks;
  const responseTimeSampleCount =
    profile.checksPerDay - failure.missingSamples;

  return {
    service_id: service.id,
    total_checks: profile.checksPerDay,
    successful_checks: successfulChecks,
    failed_checks: failure.failedChecks,
    response_time_sample_count: responseTimeSampleCount,
    average_response_time_ms: averageResponseTimeMs,
    min_response_time_ms: Math.max(
      1,
      averageResponseTimeMs - profile.minResponseDeltaMs,
    ),
    max_response_time_ms:
      averageResponseTimeMs +
      profile.maxResponseDeltaMs +
      (failure.failedChecks > 0 ? profile.incidentMaxExtraMs : 0),
    uptime_percentage: uptimePercentage(
      successfulChecks,
      profile.checksPerDay,
    ),
  };
}

const publicMonitoringDays: PublicMonitoringDay[] = Array.from(
  { length: REPORT_DAY_COUNT },
  (_, index) => {
    const daysAgo = REPORT_DAY_COUNT - 1 - index;
    const periodStartMs = CURRENT_DAY_START_MS - daysAgo * DAY_MS;
    const periodEndMs =
      daysAgo === 0 ? DATA_ANCHOR_MS : periodStartMs + DAY_MS;

    return {
      periodStart: toIso(periodStartMs),
      periodEnd: toIso(periodEndMs),
      services: publicServices.map((service) =>
        buildDailyServiceTelemetry(service, daysAgo),
      ),
    };
  },
);

const reportDays: Record<ReportRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function rowForService(day: PublicMonitoringDay, serviceId: number) {
  const row = day.services.find((candidate) => candidate.service_id === serviceId);

  if (!row) {
    throw new Error(`Missing public monitoring data for service ${serviceId}`);
  }

  return row;
}

function buildOverviewReport(range: ReportRange): OverviewReport {
  const selectedDays = publicMonitoringDays.slice(-reportDays[range]);
  const serviceReports: OverviewServiceReport[] = publicServices.map((service) => {
    const aggregate = aggregateTelemetry(
      selectedDays.map((day) => rowForService(day, service.id)),
    );

    return {
      service_id: service.id,
      service_name: service.name,
      ...aggregate,
    };
  });
  const daily: OverviewDailyReportPoint[] = selectedDays.map((day) => ({
    period_start: day.periodStart,
    period_end: day.periodEnd,
    ...aggregateTelemetry(day.services),
  }));
  const aggregate = aggregateTelemetry(selectedDays.flatMap((day) => day.services));

  return {
    range,
    period_start: selectedDays[0].periodStart,
    period_end: selectedDays[selectedDays.length - 1].periodEnd,
    ...aggregate,
    services: serviceReports,
    daily,
  };
}

const reportsByRange: Record<ReportRange, OverviewReport> = {
  "7d": buildOverviewReport("7d"),
  "30d": buildOverviewReport("30d"),
  "90d": buildOverviewReport("90d"),
};

const serviceSummaries = new Map<number, ServiceSummary>(
  reportsByRange["90d"].services.map((report) => {
    const service = publicServices.find(
      (candidate) => candidate.id === report.service_id,
    );
    const checks = healthChecksByService.get(report.service_id) ?? [];
    const latestCheck = checks[0];
    const lastDownCheck = checks.find((check) => check.status === "down");

    if (!service || !latestCheck) {
      throw new Error(`Incomplete public monitoring summary for service ${report.service_id}`);
    }

    return [
      report.service_id,
      {
        service_id: report.service_id,
        service_name: report.service_name,
        current_status: service.current_status,
        total_checks: report.total_checks,
        successful_checks: report.successful_checks,
        failed_checks: report.failed_checks,
        uptime_percentage: report.uptime_percentage,
        average_response_time_ms: report.average_response_time_ms,
        last_checked_at: latestCheck.checked_at,
        last_down_at: lastDownCheck?.checked_at ?? null,
      },
    ];
  }),
);

const allTimeReport = reportsByRange["90d"];
const dashboardSummary: DashboardSummary = {
  total_services: publicServices.length,
  online_services: publicServices.filter(
    (service) => service.current_status === "online",
  ).length,
  slow_services: publicServices.filter(
    (service) => service.current_status === "slow",
  ).length,
  down_services: publicServices.filter(
    (service) => service.current_status === "down",
  ).length,
  unknown_services: publicServices.filter(
    (service) => service.current_status === "unknown",
  ).length,
  total_checks: allTimeReport.total_checks,
  successful_checks: allTimeReport.successful_checks,
  failed_checks: allTimeReport.failed_checks,
  average_uptime_percentage: allTimeReport.uptime_percentage,
  average_response_time_ms: allTimeReport.average_response_time_ms,
  last_checked_at: Array.from(serviceSummaries.values())
    .map((summary) => summary.last_checked_at)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null,
};

interface PublicAlertIncident {
  id: number;
  serviceId: number;
  reason: string;
  healthCheckIndex?: number;
  daysAgo?: number;
  hourUtc?: number;
}

const alertIncidents: PublicAlertIncident[] = [
  { id: 9_001, serviceId: publicServiceIds.webhookDeliveryApi, healthCheckIndex: 8, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_002, serviceId: publicServiceIds.publicApiGateway, healthCheckIndex: 12, reason: "Request timed out after 15 seconds" },
  { id: 9_003, serviceId: publicServiceIds.publicApiGateway, healthCheckIndex: 22, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_004, serviceId: publicServiceIds.authenticationService, healthCheckIndex: 84, reason: "Request timed out after 15 seconds" },
  { id: 9_005, serviceId: publicServiceIds.customerPortal, healthCheckIndex: 88, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_006, serviceId: publicServiceIds.webhookDeliveryApi, healthCheckIndex: 61, reason: "Request timed out after 15 seconds" },
  { id: 9_007, serviceId: publicServiceIds.reportingApi, healthCheckIndex: 23, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_008, serviceId: publicServiceIds.publicApiGateway, daysAgo: 3, hourUtc: 14, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_009, serviceId: publicServiceIds.reportingApi, daysAgo: 5, hourUtc: 9, reason: "Request timed out after 15 seconds" },
  { id: 9_010, serviceId: publicServiceIds.webhookDeliveryApi, daysAgo: 6, hourUtc: 16, reason: "Request timed out after 15 seconds" },
  { id: 9_011, serviceId: publicServiceIds.webhookDeliveryApi, daysAgo: 11, hourUtc: 11, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_012, serviceId: publicServiceIds.publicApiGateway, daysAgo: 12, hourUtc: 8, reason: "Request timed out after 15 seconds" },
  { id: 9_013, serviceId: publicServiceIds.reportingApi, daysAgo: 14, hourUtc: 18, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_014, serviceId: publicServiceIds.customerPortal, daysAgo: 18, hourUtc: 7, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_015, serviceId: publicServiceIds.webhookDeliveryApi, daysAgo: 22, hourUtc: 20, reason: "Request timed out after 15 seconds" },
  { id: 9_016, serviceId: publicServiceIds.publicApiGateway, daysAgo: 23, hourUtc: 13, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_017, serviceId: publicServiceIds.reportingApi, daysAgo: 29, hourUtc: 10, reason: "Request timed out after 15 seconds" },
  { id: 9_018, serviceId: publicServiceIds.customerPortal, daysAgo: 38, hourUtc: 15, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_019, serviceId: publicServiceIds.authenticationService, daysAgo: 41, hourUtc: 6, reason: "Request timed out after 15 seconds" },
  { id: 9_020, serviceId: publicServiceIds.webhookDeliveryApi, daysAgo: 43, hourUtc: 19, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_021, serviceId: publicServiceIds.reportingApi, daysAgo: 48, hourUtc: 12, reason: "Request timed out after 15 seconds" },
  { id: 9_022, serviceId: publicServiceIds.publicApiGateway, daysAgo: 53, hourUtc: 17, reason: "Request timed out after 15 seconds" },
  { id: 9_023, serviceId: publicServiceIds.webhookDeliveryApi, daysAgo: 58, hourUtc: 5, reason: "Request timed out after 15 seconds" },
  { id: 9_024, serviceId: publicServiceIds.customerPortal, daysAgo: 63, hourUtc: 13, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_025, serviceId: publicServiceIds.authenticationService, daysAgo: 70, hourUtc: 21, reason: "Request timed out after 15 seconds" },
  { id: 9_026, serviceId: publicServiceIds.reportingApi, daysAgo: 72, hourUtc: 8, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_027, serviceId: publicServiceIds.publicApiGateway, daysAgo: 75, hourUtc: 10, reason: "Expected HTTP status 200 but received 502" },
  { id: 9_028, serviceId: publicServiceIds.webhookDeliveryApi, daysAgo: 80, hourUtc: 16, reason: "Request timed out after 15 seconds" },
];

function alertTimestamp(incident: PublicAlertIncident) {
  if (incident.healthCheckIndex !== undefined) {
    const check = healthChecksByService.get(incident.serviceId)?.[
      incident.healthCheckIndex
    ];

    if (!check) {
      throw new Error(`Missing health check for public alert ${incident.id}`);
    }

    return { timestamp: check.checked_at, healthCheckId: check.id };
  }

  const daysAgo = incident.daysAgo ?? 1;
  const hourUtc = incident.hourUtc ?? 12;
  return {
    timestamp: toIso(CURRENT_DAY_START_MS - daysAgo * DAY_MS + hourUtc * HOUR_MS),
    healthCheckId: incident.serviceId * 100_000 + incident.id,
  };
}

const publicAlerts: Alert[] = alertIncidents
  .map((incident) => {
    const service = publicServices.find(
      (candidate) => candidate.id === incident.serviceId,
    );

    if (!service) {
      throw new Error(`Missing service for public alert ${incident.id}`);
    }

    const { timestamp, healthCheckId } = alertTimestamp(incident);
    return {
      id: incident.id,
      user_id: REPRESENTATIVE_OWNER_ID,
      service_id: service.id,
      health_check_id: healthCheckId,
      type: "service_down",
      severity: "critical",
      title: `${service.name} is down`,
      message: `${service.name} is currently down. URL: ${service.url}. Reason: ${incident.reason}`,
      created_at: timestamp,
      service,
    };
  })
  .sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

function serviceIdFrom(value: string | number) {
  const serviceId = typeof value === "number" ? value : Number(value);
  return Number.isInteger(serviceId) ? serviceId : null;
}

function findPublicService(value: string | number) {
  const serviceId = serviceIdFrom(value);
  return serviceId === null
    ? undefined
    : publicServices.find((service) => service.id === serviceId);
}

function boundedLimit(limit: number | undefined, fallback: number, maximum: number) {
  return limit !== undefined && Number.isInteger(limit) && limit > 0
    ? Math.min(limit, maximum)
    : fallback;
}

function missingService<T>() {
  return Promise.reject<T>(new Error("Service not found"));
}

const cloneService = (service: Service): Service => ({ ...service });
const cloneHealthCheck = (check: HealthCheck): HealthCheck => ({ ...check });
const cloneAlert = (alert: Alert): Alert => ({
  ...alert,
  service: alert.service ? cloneService(alert.service) : undefined,
});
const cloneReport = (report: OverviewReport): OverviewReport => ({
  ...report,
  services: report.services.map((service) => ({ ...service })),
  daily: report.daily.map((day) => ({ ...day })),
});

// This source has the same read contract as the API source, without exposing mutations.
export const publicMonitoringReadSource: MonitoringReadSource = {
  getDashboardSummary() {
    return Promise.resolve({ summary: { ...dashboardSummary } });
  },
  getServices() {
    return Promise.resolve({ services: publicServices.map(cloneService) });
  },
  getService(id) {
    const service = findPublicService(id);
    return service
      ? Promise.resolve({ service: cloneService(service) })
      : missingService();
  },
  getServiceSummary(id) {
    const service = findPublicService(id);
    const summary = service ? serviceSummaries.get(service.id) : undefined;
    return summary
      ? Promise.resolve({ summary: { ...summary } })
      : missingService();
  },
  getHealthChecks(id, limit) {
    const service = findPublicService(id);
    const checks = service ? healthChecksByService.get(service.id) : undefined;

    if (!service || !checks) return missingService();

    const returnedChecks = checks
      .slice(0, boundedLimit(limit, 25, HISTORY_LENGTH))
      .map(cloneHealthCheck);
    return Promise.resolve({
      service_id: service.id,
      returned_count: returnedChecks.length,
      health_checks: returnedChecks,
    });
  },
  getAlerts(limit) {
    const alerts = publicAlerts
      .slice(0, boundedLimit(limit, 50, 100))
      .map(cloneAlert);
    return Promise.resolve({ alerts, returned_count: alerts.length });
  },
  getServiceAlerts(id, limit) {
    const service = findPublicService(id);
    if (!service) return missingService();

    const alerts = publicAlerts
      .filter((alert) => alert.service_id === service.id)
      .slice(0, boundedLimit(limit, 8, 100))
      .map(cloneAlert);
    return Promise.resolve({
      service_id: service.id,
      alerts,
      returned_count: alerts.length,
    });
  },
  getOverviewReport(range) {
    return Promise.resolve(cloneReport(reportsByRange[range]));
  },
};
