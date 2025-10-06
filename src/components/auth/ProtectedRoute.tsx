import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";

type ProtectedRouteProps = {
  redirectTo?: string;
  allowedRoles?: UserRole[];
};

const ProtectedRoute = ({ redirectTo = "/login", allowedRoles }: ProtectedRouteProps) => {
  const { user, loading, userRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 border-4 border-crm/40 border-t-crm rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Validando sesión…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (allowedRoles && (!userRole || !allowedRoles.includes(userRole))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
