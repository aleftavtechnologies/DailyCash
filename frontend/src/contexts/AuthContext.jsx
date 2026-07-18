import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setAuthToken, getStoredToken } from "../api/client";
import { connectSocket, disconnectSocket } from "../api/socket";

const REALTIME_MODE = import.meta.env.VITE_REALTIME_MODE || "socket";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const STORED_USER_KEY = "dailycash_user";
const STORED_TENANT_KEY = "dailycash_tenant";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenantId, setTenantId] = useState(localStorage.getItem(STORED_TENANT_KEY) || "");
  const [ready, setReady] = useState(false);

  // Restore session on reload — token + user are cached locally; the
  // token itself is what the backend actually trusts on every request.
  useEffect(() => {
    const token = getStoredToken();
    const cachedUser = localStorage.getItem(STORED_USER_KEY);
    if (token && cachedUser) {
      setAuthToken(token);
      setUser(JSON.parse(cachedUser));
      if (REALTIME_MODE === "socket") connectSocket(token);
    }
    setReady(true);
  }, []);

  const login = useCallback(async (tid, phone, password) => {
    const { token, user: u } = await api.login(tid, phone, password);
    setAuthToken(token);
    localStorage.setItem(STORED_USER_KEY, JSON.stringify(u));
    localStorage.setItem(STORED_TENANT_KEY, tid);
    setTenantId(tid);
    setUser(u);
    if (REALTIME_MODE === "socket") connectSocket(token);
    return u;
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem(STORED_USER_KEY);
    disconnectSocket();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, tenantId, setTenantId, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}
