import { Navigate, Outlet, useLocation } from "react-router-dom";
import { FullPageLoader } from "../components/ui/FullPageLoader";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader label="Restoring your session" />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          // Only creation is safe to resume: an edit URL may refer to a public record.
          from: /^\/services\/new\/*$/i.test(location.pathname)
            ? {
                pathname: "/services/new",
                search: location.search,
                hash: location.hash,
              }
            : { pathname: "/dashboard" },
        }}
      />
    );
  }

  return <Outlet />;
}
