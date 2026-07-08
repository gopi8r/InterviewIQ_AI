import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { registerCandidate, login } from "../api/api.js";

export default function LoginRegisterPage() {
  const navigate = useNavigate();
  const { loginSuccess } = useAuth();

  const [tab, setTab] = useState("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Separate field state per form so switching tabs never carries over
  // stale values from a previous session (part of the session-hygiene fix).
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regExperience, setRegExperience] = useState("");
  const [regSkills, setRegSkills] = useState("");

  function switchTab(next) {
    setTab(next);
    setError("");
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!loginEmail || !loginPassword) {
      setError("Please enter email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await login(loginEmail, loginPassword);
      if (data.role !== "candidate") {
        throw new Error("This is an admin account. Please use the admin portal instead.");
      }
      loginSuccess(data.access_token, data.name);
      navigate("/home");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    const experience_years = parseInt(regExperience, 10);
    const skills = regSkills.split(",").map((s) => s.trim()).filter(Boolean);

    if (!regName || !regEmail || !regPassword || isNaN(experience_years) || skills.length === 0) {
      setError("Please fill all fields, including at least one skill.");
      return;
    }

    setSubmitting(true);
    try {
      await registerCandidate({ name: regName, email: regEmail, password: regPassword, experience_years, skills });
      const data = await login(regEmail, regPassword);
      loginSuccess(data.access_token, data.name);
      navigate("/home");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <div style={{ maxWidth: 540, width: "100%" }}>
        <div className="brand-bar">
          <div className="logo-badge">🧑‍💻</div>
          <div>
            <div className="brand">InterviewIQ</div>
            <div className="tagline">Voice-based technical screening, tailored to you</div>
          </div>
        </div>

        <div className="glass-card">
          <div className="pill-tabs">
            <button className={tab === "login" ? "active" : ""} onClick={() => switchTab("login")}>Login</button>
            <button className={tab === "register" ? "active" : ""} onClick={() => switchTab("register")}>Register</button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin}>
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={loginEmail}
                     onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" />
              <label className="form-label">Password</label>
              <input type="password" className="form-control" value={loginPassword}
                     onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" />
              <button className="btn btn-brand" style={{ width: "100%", marginTop: 22 }} disabled={submitting} type="submit">
                {submitting ? "Logging in..." : "Login"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <label className="form-label">Full Name</label>
              <input type="text" className="form-control" value={regName}
                     onChange={(e) => setRegName(e.target.value)} placeholder="Priya Sharma" />
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={regEmail}
                     onChange={(e) => setRegEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" />
              <label className="form-label">Password</label>
              <input type="password" className="form-control" value={regPassword}
                     onChange={(e) => setRegPassword(e.target.value)} autoComplete="new-password" />
              <label className="form-label">Years of Experience</label>
              <input type="number" min="0" max="50" className="form-control" value={regExperience}
                     onChange={(e) => setRegExperience(e.target.value)} placeholder="e.g. 2" />
              <label className="form-label">Skills (comma separated)</label>
              <input type="text" className="form-control" value={regSkills}
                     onChange={(e) => setRegSkills(e.target.value)} placeholder="e.g. Java, Spring Boot, MySQL" />
              <div className="form-hint">Your interview questions will be generated based on these skills.</div>
              <button className="btn btn-brand" style={{ width: "100%", marginTop: 22 }} disabled={submitting} type="submit">
                {submitting ? "Creating account..." : "Create Account"}
              </button>
            </form>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
