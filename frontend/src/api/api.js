// Central place for the backend URL - change this if FastAPI runs elsewhere.
export const API_BASE = "http://127.0.0.1:8000";

/**
 * Generic JSON request helper. Throws an Error with a readable message on
 * any non-2xx response, so callers can just try/catch.
 */
async function request(path, { method = "GET", token, body, isForm = false } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res; // caller handles blobs (PDF/ZIP downloads) themselves
}

async function readErrorDetail(res) {
  const contentType = res.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const errJson = await res.json();
      if (typeof errJson?.detail === "string") return errJson.detail;
      if (typeof errJson?.detail === "object" && errJson.detail !== null) {
        return JSON.stringify(errJson.detail);
      }
      if (typeof errJson?.message === "string") return errJson.message;
      if (typeof errJson?.error === "string") return errJson.error;
      return JSON.stringify(errJson);
    }

    const text = await res.text();
    return text || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

// ---------------- Auth ----------------
export function registerCandidate({ name, email, password, experience_years, skills }) {
  return request("/api/auth/register", {
    method: "POST",
    body: { name, email, password, experience_years, skills },
  });
}

export function login(email, password) {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);
  return request("/api/auth/login", { method: "POST", body, isForm: true });
}

// ---------------- Candidate interview flow ----------------
export function startSession(token) {
  return request("/api/interview/session/start", { method: "POST", token });
}

export function submitAnswer(token, sessionId, { questionIndex, timeTakenSeconds, audioBlob }) {
  const formData = new FormData();
  formData.append("question_index", questionIndex);
  formData.append("time_taken_seconds", timeTakenSeconds);
  formData.append("audio", audioBlob, "answer.webm");
  return request(`/api/interview/session/${sessionId}/answer`, {
    method: "POST", token, body: formData, isForm: true,
  });
}

export function skipQuestion(token, sessionId, questionIndex) {
  return request(`/api/interview/session/${sessionId}/answer/skip`, {
    method: "POST", token, body: { question_index: questionIndex },
  });
}

export function evaluateSession(token, sessionId) {
  return request(`/api/interview/session/${sessionId}/evaluate`, { method: "POST", token });
}

// ---------------- Admin ----------------
export function adminGetSettings(token) {
  return request("/api/admin/settings", { token });
}
export function adminUpdateSettings(token, questionLimit) {
  return request("/api/admin/settings", { method: "PUT", token, body: { question_limit: questionLimit } });
}
export function adminListCandidates(token, { page = 1, pageSize = 10, search = "" } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize, search });
  return request(`/api/admin/candidates?${params.toString()}`, { token });
}
export function adminGetCandidateDetail(token, sessionId) {
  return request(`/api/admin/candidates/${sessionId}`, { token });
}
export async function adminDownloadReport(token, sessionId, filename) {
  const res = await request(`/api/admin/candidates/${sessionId}/report`, { token });
  await triggerBlobDownload(res, filename);
}
export async function adminDownloadBulkReports(token, startDate, endDate) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  const res = await request(`/api/admin/candidates/bulk-report?${params.toString()}`, { token });
  await triggerBlobDownload(res, `interview-reports_${startDate}_to_${endDate}.zip`);
}

async function triggerBlobDownload(res, filename) {
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
