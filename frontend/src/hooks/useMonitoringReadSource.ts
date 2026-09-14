import { useAuth } from "../context/AuthContext";
import { authenticatedMonitoringReadSource } from "../data/monitoringReadSource";
import { publicMonitoringReadSource } from "../data/publicMonitoringReadSource";

export function useMonitoringReadSource() {
  const { isAuthenticated, isLoading, requiresAuthentication } = useAuth();

  // AppLayout holds product routes during restoration and redirects interrupted sessions.
  // Falling back to the authenticated source here prevents fixture data during either state.
  if (isLoading || requiresAuthentication || isAuthenticated) {
    return authenticatedMonitoringReadSource;
  }

  return publicMonitoringReadSource;
}
