import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("aptitude_token")));

  useEffect(() => {
    if (!localStorage.getItem("aptitude_token")) {
      setLoading(false);
      return;
    }
    api.get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => {
        localStorage.removeItem("aptitude_token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback((payload) => {
    localStorage.setItem("aptitude_token", payload.access_token);
    setUser(payload.user);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("aptitude_token");
    setUser(null);
  }, []);

  const replaceUser = useCallback((value) => setUser(value), []);
  const value = useMemo(() => ({ user, loading, authenticate, signOut, replaceUser }), [user, loading, authenticate, signOut, replaceUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
