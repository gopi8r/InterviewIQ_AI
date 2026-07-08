import { createContext, useContext, useState } from "react";

const STORAGE_KEY = "admin_auth_token";
const TOKEN_TTL_MS = 5 * 60 * 1000;

function readStoredToken() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.expiresAt) return null;

    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed.token;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persistToken(accessToken) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: accessToken, expiresAt }));
}

/**
 * Admin auth state, kept separate from candidate auth. The admin session is
 * remembered across page refreshes for up to 5 minutes so a quick reload does
 * not force a new login.
 */
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken());

  function loginSuccess(accessToken) {
    persistToken(accessToken);
    setToken(accessToken);
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }

  return (
    <AdminAuthContext.Provider value={{ token, loginSuccess, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
