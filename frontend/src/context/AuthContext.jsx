import { createContext, useContext, useState } from "react";

/**
 * Candidate auth state lives ONLY in React memory (useState), never in
 * localStorage/sessionStorage. This is deliberate: it fixes the earlier bug
 * where reopening the site (or even just refreshing) silently logged the
 * previous candidate back in with stale data. Now, closing the tab or
 * refreshing always requires a fresh login - exactly like a real screening
 * portal should behave.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [name, setName] = useState("");
  const [hasAgreedToPolicy, setHasAgreedToPolicy] = useState(false);

  function loginSuccess(accessToken, candidateName) {
    setToken(accessToken);
    setName(candidateName);
    setHasAgreedToPolicy(false); // must re-agree every fresh session
  }

  function logout() {
    setToken(null);
    setName("");
    setHasAgreedToPolicy(false);
  }

  return (
    <AuthContext.Provider value={{ token, name, hasAgreedToPolicy, setHasAgreedToPolicy, loginSuccess, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
