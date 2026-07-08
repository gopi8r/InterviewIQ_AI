import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function PolicyHomePage() {
  const navigate = useNavigate();
  const { name, setHasAgreedToPolicy, logout } = useAuth();
  const [agreed, setAgreed] = useState(false);

  function handleStart() {
    setHasAgreedToPolicy(true);
    navigate("/test");
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="page-shell">
      <div style={{ maxWidth: 720, width: "100%" }}>
        <div className="brand-bar">
          <div className="logo-badge">🧑‍💻</div>
          <div>
            <div className="brand">InterviewIQ</div>
            <div className="tagline">Before you begin</div>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ marginTop: 0 }}>Welcome, {name} 👋</h3>
          <p style={{ color: "#555" }}>
            Please read the interview rules and guidelines below before starting your assessment.
          </p>

          <div className="policy-box">
            <h5>✅ Do's</h5>
            <ul>
              <li>Find a quiet space with a stable internet connection.</li>
              <li>Use Google Chrome for the best microphone and voice support.</li>
              <li>Speak clearly and at a natural pace when answering.</li>
              <li>Allow microphone access when your browser prompts you.</li>
              <li>Answer within the time limit shown for each question.</li>
            </ul>

            <h5>🚫 Don'ts</h5>
            <ul>
              <li>Do not refresh or close the browser tab during the test - your progress may be lost.</li>
              <li>Do not use another device, website, or person to help answer questions.</li>
              <li>Do not read answers from prepared notes - answer in your own words.</li>
              <li>Do not switch tabs or minimize the window during the assessment.</li>
            </ul>

            <h5>📋 Evaluation Policy</h5>
            <p>
              Your spoken answers will be transcribed and evaluated for both technical accuracy and
              communication clarity. Scores and detailed results are reviewed by our hiring team only -
              you will not see your score at the end of this session. By proceeding, you consent to
              your responses being recorded, transcribed, and evaluated as part of this screening process.
            </p>
          </div>

          <div className="agree-row">
            <input type="checkbox" id="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <label htmlFor="agree">I have read and agree to the rules and evaluation policy above.</label>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
            <button className="btn btn-brand" disabled={!agreed} onClick={handleStart}>
              Start Test
            </button>
            <button className="btn btn-link" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </div>
    </div>
  );
}
