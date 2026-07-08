import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { login } from "../api/api.js";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { loginSuccess } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await login(email, password);
      if (data.role !== "admin") {
        throw new Error("This account is not an admin. Use the candidate site instead.");
      }
      loginSuccess(data.access_token);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div className="brand-bar">
          <div className="logo-badge">🛡️</div>
          <div>
            <div className="brand">Admin Portal</div>
            <div className="tagline">InterviewIQ management dashboard</div>
          </div>
        </div>

        <div className="glass-card">
          <h4 style={{ marginTop: 0, textAlign: "center" }}>Admin Login</h4>
          <form onSubmit={handleLogin}>
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" autoComplete="username" />
            <label className="form-label">Password</label>
            <input type="password" className="form-control" value={password}
                   onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button className="btn btn-brand" style={{ width: "100%", marginTop: 22 }} disabled={submitting} type="submit">
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>
          {error && <p className="form-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
