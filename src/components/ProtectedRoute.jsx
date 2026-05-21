import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "./LoadingScreen";

export default function ProtectedRoute({ children, roles }) {
  const { authReady, user } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    const fallbackRoute = user.role === "admin" ? "/admin" : "/dashboard";
    return <Navigate to={fallbackRoute} replace />;
  }

  return children;
}
