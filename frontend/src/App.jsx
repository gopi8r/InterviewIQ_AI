import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext.jsx";

import LoginRegisterPage from "./pages/LoginRegisterPage.jsx";
import PolicyHomePage from "./pages/PolicyHomePage.jsx";
import TestPage from "./pages/TestPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";

// ---------------- Candidate route guards ----------------
function RequireCandidateAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  return children;
}
function RequirePolicyAgreement({ children }) {
  const { token, hasAgreedToPolicy } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  if (!hasAgreedToPolicy) return <Navigate to="/home" replace />;
  return children;
}

// ---------------- Admin route guard ----------------
function RequireAdminAuth({ children }) {
  const { token } = useAdminAuth();
  if (!token) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminAuthProvider>
          <Routes>
            {/* Candidate flow: Login/Register -> Policy/Rules Home -> Test */}
            <Route path="/" element={<LoginRegisterPage />} />
            <Route
              path="/home"
              element={
                <RequireCandidateAuth>
                  <PolicyHomePage />
                </RequireCandidateAuth>
              }
            />
            <Route
              path="/test"
              element={
                <RequirePolicyAgreement>
                  <TestPage />
                </RequirePolicyAgreement>
              }
            />

            {/* Admin flow - completely separate URL, never linked from candidate pages */}
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route
              path="/admin/dashboard"
              element={
                <RequireAdminAuth>
                  <AdminDashboardPage />
                </RequireAdminAuth>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
