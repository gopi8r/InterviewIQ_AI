import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import {
  adminGetSettings, adminUpdateSettings, adminListCandidates,
  adminGetCandidateDetail, adminDownloadReport, adminDownloadBulkReports,
} from "../api/api.js";

// Always coerce to a number and default to 0 - this is what prevents the
// earlier bug where a single unevaluated interview caused a raw error popup
// (calling .toFixed on null/undefined) instead of just showing "0".
const num = (v) => (typeof v === "number" && !isNaN(v) ? v : 0);

function verdictClass(verdict) {
  switch (verdict) {
    case "Strong Hire": return "verdict-strong-hire";
    case "Hire": return "verdict-hire";
    case "Borderline": return "verdict-borderline";
    case "No Hire": return "verdict-no-hire";
    default: return "verdict-pending";
  }
}

function formatIstDateTime(value) {
  if (!value) return "—";

  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    const hasTimeZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed);
    const normalized = hasTimeZone ? trimmed : trimmed.replace(" ", "T");
    date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      date = new Date(`${normalized}+05:30`);
    }
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { token, logout } = useAdminAuth();

  const [questionLimit, setQuestionLimit] = useState(5);
  const [savedMsg, setSavedMsg] = useState(false);

  const [candidates, setCandidates] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const [bulkStart, setBulkStart] = useState("");
  const [bulkEnd, setBulkEnd] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCandidates(1, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSettings() {
    try {
      const data = await adminGetSettings(token);
      setQuestionLimit(data.question_limit);
    } catch (err) {
      console.error(err);
    }
  }

  async function saveSettings() {
    const value = parseInt(questionLimit, 10);
    if (isNaN(value) || value < 1 || value > 20) {
      alert("Please enter a question limit between 1 and 20.");
      return;
    }
    try {
      await adminUpdateSettings(token, value);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadCandidates(pageNum, searchTerm) {
    setLoadError("");
    setSelectedSessionId(null);
    setDetail(null);
    setDetailLoading(false);
    try {
      const data = await adminListCandidates(token, { page: pageNum, pageSize, search: searchTerm });
      setCandidates(data.items);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.total_pages);
    } catch (err) {
      // Defensive: show an inline message, never a raw alert popup for a
      // simple "no data" or fetch hiccup.
      setLoadError(err.message || "Could not load candidates.");
      setCandidates([]);
      setTotal(0);
      setTotalPages(1);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadCandidates(1, search);
  }

  function goToPage(p) {
    if (p < 1 || p > totalPages) return;
    loadCandidates(p, search);
  }

  async function viewDetail(sessionId) {
    if (selectedSessionId === sessionId && detail) {
      setSelectedSessionId(null);
      setDetail(null);
      return;
    }

    setSelectedSessionId(sessionId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await adminGetCandidateDetail(token, sessionId);
      setDetail(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleCloseDetail() {
    setSelectedSessionId(null);
    setDetail(null);
    setDetailLoading(false);
  }

  async function handleDownloadOne(sessionId, candidateName) {
    try {
      await adminDownloadReport(token, sessionId, `interview-report-${candidateName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleBulkDownload() {
    setBulkError("");
    if (!bulkStart || !bulkEnd) {
      setBulkError("Please select both a start and end date.");
      return;
    }
    if (bulkEnd < bulkStart) {
      setBulkError("End date must be on or after the start date.");
      return;
    }
    setBulkLoading(true);
    try {
      await adminDownloadBulkReports(token, bulkStart, bulkEnd);
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/admin");
  }

  const scoredCandidates = candidates.filter((c) => c.verdict !== "Pending");
  const avgScoreDisplay = scoredCandidates.length
    ? (scoredCandidates.reduce((sum, c) => sum + num(c.overall_score), 0) / scoredCandidates.length).toFixed(1)
    : "0.0";
  const hiresCount = candidates.filter((c) => c.verdict === "Hire" || c.verdict === "Strong Hire").length;

  return (
    <div className="page-shell">
      <div style={{ maxWidth: 1040, width: "100%" }}>
        <div className="brand-bar">
          <div className="logo-badge">🛡️</div>
          <div>
            <div className="brand">Admin Dashboard</div>
            <div className="tagline">Review candidate results & configure interviews</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h4 style={{ color: "#fff", margin: 0 }}>Candidate Results</h4>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-value">{total}</div>
            <div className="stat-label">Total Interviews (this page's data)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{avgScoreDisplay}</div>
            <div className="stat-label">Avg Overall Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{hiresCount}</div>
            <div className="stat-label">Hire / Strong Hire (this page)</div>
          </div>
        </div>

        {/* Settings */}
        <div className="detail-panel" style={{ marginBottom: 24 }}>
          <h6 style={{ marginTop: 0 }}>⚙️ Interview Settings</h6>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <div>
              <label className="form-label">Number of Questions per Interview</label>
              <input type="number" min="1" max="20" className="form-control" style={{ width: 120 }}
                     value={questionLimit} onChange={(e) => setQuestionLimit(e.target.value)} />
            </div>
            <button className="btn btn-brand btn-sm" onClick={saveSettings}>Save</button>
            {savedMsg && <span style={{ color: "#2ecc71", fontSize: 13 }}>✓ Saved</span>}
          </div>
          <p style={{ color: "#888", fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
            Applies to future interviews only.
          </p>
        </div>

        {/* Bulk PDF export by date range */}
        <div className="detail-panel" style={{ marginBottom: 24 }}>
          <h6 style={{ marginTop: 0 }}>📦 Bulk Export (PDF, by date range)</h6>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div>
              <label className="form-label">From</label>
              <input type="date" className="form-control" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} />
            </div>
            <div>
              <label className="form-label">To</label>
              <input type="date" className="form-control" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} />
            </div>
            <button className="btn btn-brand btn-sm" onClick={handleBulkDownload} disabled={bulkLoading}>
              {bulkLoading ? "Preparing ZIP..." : "⬇ Download All as ZIP"}
            </button>
          </div>
          {bulkError && <p className="form-error" style={{ marginTop: 10 }}>{bulkError}</p>}
          <p style={{ color: "#888", fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
            Downloads a ZIP containing one PDF per completed interview within the selected dates (based on completion date).
          </p>
        </div>

        {/* Search */}
        <form className="search-bar" onSubmit={handleSearchSubmit}>
          <input type="text" className="form-control" placeholder="Search by candidate name or email..."
                 value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-outline btn-sm" type="submit">Search</button>
        </form>

        {/* Candidates table */}
        <div className="candidate-table">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Experience</th>
                <th>Skills</th>
                <th>Overall</th>
                <th>Verdict</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const isPending = c.verdict === "Pending" || !c.completed_at;
                const isSelected = selectedSessionId === c.session_id;
                const dateLabel = c.completed_at
                  ? formatIstDateTime(c.completed_at)
                  : `${formatIstDateTime(c.started_at)} (in progress)`;
                return (
                  <>
                    <tr key={c.session_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.candidate_name}</div>
                        <div style={{ color: "#888", fontSize: 12 }}>{c.candidate_email}</div>
                      </td>
                      <td>{num(c.experience_years)} yrs</td>
                      <td>
                        {(c.skills || []).map((s) => (
                          <span key={s} className="skills-chip">{s}</span>
                        ))}
                      </td>
                      <td style={{ fontWeight: 600 }}>{num(c.overall_score).toFixed(1)}</td>
                      <td><span className={`verdict-badge ${verdictClass(c.verdict)}`}>{c.verdict || "Pending"}</span></td>
                      <td style={{ color: "#888", fontSize: 12.5 }}>{dateLabel}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" disabled={isPending} onClick={() => viewDetail(c.session_id)}>
                          {isSelected && detailLoading ? "Loading..." : "View"}
                        </button>
                      </td>
                    </tr>
                    {isSelected && (
                      <tr key={`${c.session_id}-detail`}>
                        <td colSpan={7}>
                          {detailLoading ? (
                            <div className="detail-panel" style={{ margin: "8px 0", textAlign: "center" }}>
                              <div className="spinner" />
                            </div>
                          ) : detail ? (
                            <div className="detail-panel" style={{ margin: "8px 0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                <div>
                                  <h5 style={{ margin: 0 }}>{detail.candidate_name}</h5>
                                  <div style={{ color: "#888", fontSize: 13 }}>{detail.candidate_email}</div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button className="btn btn-outline btn-sm" onClick={handleCloseDetail}>Close</button>
                                  <button className="btn btn-brand btn-sm" onClick={() => handleDownloadOne(detail.session_id, detail.candidate_name)}>
                                    ⬇ Download PDF
                                  </button>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
                                <div><strong>Overall:</strong> {num(detail.overall_score).toFixed(1)}/10</div>
                                <div><strong>Technical:</strong> {num(detail.avg_technical_score).toFixed(1)}/10</div>
                                <div><strong>Communication:</strong> {num(detail.avg_communication_score).toFixed(1)}/10</div>
                              </div>
                              {detail.answers.map((a, idx) => (
                                <div key={idx} className="qa-block">
                                  <div style={{ fontWeight: 600 }}>Q{idx + 1}. {a.question_text}</div>
                                  <div className="qa-scores">
                                    Technical: {num(a.technical_score).toFixed(1)}/10 · Communication: {num(a.communication_score).toFixed(1)}/10
                                    · {num(a.words_per_minute)} wpm · {num(a.time_taken_seconds)}s
                                  </div>
                                  <div>{a.feedback}</div>
                                  {a.missed_concepts.length > 0 && (
                                    <div className="qa-missed">Missed: {a.missed_concepts.join("; ")}</div>
                                  )}
                                  <div style={{ color: "#888", fontSize: 12.5, marginTop: 8 }}>
                                    <i>Transcript:</i> "{a.transcript}"
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {loadError && <p className="form-error" style={{ color: "#fff" }}>{loadError}</p>}
        {!loadError && candidates.length === 0 && (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", marginTop: 24 }}>No interviews found.</p>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>← Prev</button>
            <span className="page-info">Page {page} of {totalPages} ({total} total)</span>
            <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>Next →</button>
          </div>
        )}

      </div>
    </div>
  );
}
