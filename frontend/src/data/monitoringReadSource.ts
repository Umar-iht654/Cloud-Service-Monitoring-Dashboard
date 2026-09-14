import * as alertsApi from "../api/alerts";
import * as dashboardApi from "../api/dashboard";
import * as reportsApi from "../api/reports";
import * as servicesApi from "../api/services";
import type {
  AlertsResponse,
  DashboardResponse,
  HealthChecksResponse,
  OverviewReportResponse,
  ReportRange,
  ServiceAlertsResponse,
  ServiceResponse,
  ServicesResponse,
  ServiceSummaryResponse,
} from "../types/api";

export interface MonitoringReadSource {
  getDashboardSummary: () => Promise<DashboardResponse>;
  getServices: () => Promise<ServicesResponse>;
  getService: (id: string | number) => Promise<ServiceResponse>;
  getServiceSummary: (id: string | number) => Promise<ServiceSummaryResponse>;
  getHealthChecks: (
    id: string | number,
    limit?: number,
  ) => Promise<HealthChecksResponse>;
  getAlerts: (limit?: number) => Promise<AlertsResponse>;
  getServiceAlerts: (
    id: string | number,
    limit?: number,
  ) => Promise<ServiceAlertsResponse>;
  getOverviewReport: (range: ReportRange) => Promise<OverviewReportResponse>;
}

// Authenticated reads retain the existing API behavior through the established modules.
export const authenticatedMonitoringReadSource: MonitoringReadSource = {
  async getDashboardSummary() {
    const { data } = await dashboardApi.getDashboardSummary();
    return data;
  },
  async getServices() {
    const { data } = await servicesApi.getServices();
    return data;
  },
  async getService(id) {
    const { data } = await servicesApi.getService(id);
    return data;
  },
  async getServiceSummary(id) {
    const { data } = await servicesApi.getServiceSummary(id);
    return data;
  },
  async getHealthChecks(id, limit) {
    const { data } = await servicesApi.getHealthChecks(id, limit);
    return data;
  },
  async getAlerts(limit) {
    const { data } = await alertsApi.getAlerts(limit);
    return data;
  },
  async getServiceAlerts(id, limit) {
    const { data } = await alertsApi.getServiceAlerts(id, limit);
    return data;
  },
  async getOverviewReport(range) {
    const { data } = await reportsApi.getOverviewReport(range);
    return data;
  },
};
