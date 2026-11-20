import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/AdminDashboard";
import AdminHistoryPage from "./pages/AdminHistoryPage";
import AuthPage from "./pages/AuthPage";
import GuardDashboard from "./pages/GuardDashboard";
import LandingPage from "./pages/LandingPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import { isNativeApp } from "./utils/nativeApp";

export default function App() {
  const nativeApp = isNativeApp();

  return (
    <Routes>
      <Route path="/" element={nativeApp ? <Navigate to="/auth" replace /> : <LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={["guard"]}>
            <GuardDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute roles={["super_admin"]}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/history"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
