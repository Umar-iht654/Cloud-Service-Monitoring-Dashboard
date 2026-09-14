import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { FullPageLoader } from "./components/ui/FullPageLoader";
import { AuthProvider } from "./context/AuthContext";
import { UnsavedChangesProvider } from "./context/UnsavedChangesContext";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const AddServicePage = lazy(() =>
  import("./pages/AddServicePage").then((module) => ({ default: module.AddServicePage })),
);
const EditServicePage = lazy(() =>
  import("./pages/EditServicePage").then((module) => ({ default: module.EditServicePage })),
);
const ServiceDetailPage = lazy(() =>
  import("./pages/ServiceDetailPage").then((module) => ({ default: module.ServiceDetailPage })),
);
const AlertsPage = lazy(() =>
  import("./pages/AlertsPage").then((module) => ({ default: module.AlertsPage })),
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })),
);

function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPathname =
      pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    const pageTitle =
      normalizedPathname === "/login"
        ? "Sign in"
        : normalizedPathname === "/register"
          ? "Create account"
          : normalizedPathname === "/verify-email"
            ? "Verify email"
          : normalizedPathname === "/dashboard" || normalizedPathname === "/"
            ? "Service health"
            : normalizedPathname === "/services"
              ? "Monitored services"
            : normalizedPathname === "/services/new"
              ? "Add service"
              : normalizedPathname === "/alerts"
                ? "Alert history"
                : normalizedPathname === "/reports"
                  ? "Monitoring reports"
                : /^\/services\/[^/]+(?:\/[^/]+)?\/edit$/.test(normalizedPathname)
                ? "Edit service"
                : /^\/services\/[^/]+(?:\/[^/]+)?$/.test(normalizedPathname)
                  ? "Service details"
                  : "Page not found";

    document.title = `${pageTitle} | StatusWatch`;
  }, [pathname]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <UnsavedChangesProvider>
        <RouteMetadata />
        <Suspense fallback={<FullPageLoader label="Loading page" />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/services" element={<DashboardPage />} />
              <Route path="/services/:id/:slug" element={<ServiceDetailPage />} />
              <Route path="/services/:id" element={<ServiceDetailPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/services/new" element={<AddServicePage />} />
                <Route path="/services/:id/:slug/edit" element={<EditServicePage />} />
                <Route path="/services/:id/edit" element={<EditServicePage />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </UnsavedChangesProvider>
    </AuthProvider>
  );
}

export default App;
