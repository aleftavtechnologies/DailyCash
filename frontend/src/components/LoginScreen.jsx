import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  const { login, tenantId: storedTenantId } = useAuth();
  const [tenantId, setTenantId] = useState(storedTenantId || "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await login(tenantId.trim(), phone.trim(), password);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dc">
      <div className="login-wrap">
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div className="logo-chip mono">Rs</div>
              <span className="font-display" style={{ fontSize: 26, fontWeight: 600, color: "#F5F3ED" }}>DailyCash</span>
            </div>
            <p style={{ color: "#9BB0A5", fontSize: 13.5 }}>Micro-credit operations, built for the daily round</p>
          </div>
          <form className="login-card" onSubmit={submit}>
            <label className="field-label" style={{ color: "#9BB0A5" }}>Company ID (tenant ID)</label>
            <input className="input" style={{ marginTop: 6, marginBottom: 16, background: "#0F2019", borderColor: "rgba(255,255,255,.12)", color: "#F5F3ED" }}
              value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="From your admin / seed output" required />

            <label className="field-label" style={{ color: "#9BB0A5" }}>Phone</label>
            <input className="input" style={{ marginTop: 6, marginBottom: 16, background: "#0F2019", borderColor: "rgba(255,255,255,.12)", color: "#F5F3ED" }}
              value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0771234567" required />

            <label className="field-label" style={{ color: "#9BB0A5" }}>Password</label>
            <input type="password" className="input" style={{ marginTop: 6, marginBottom: 8, background: "#0F2019", borderColor: "rgba(255,255,255,.12)", color: "#F5F3ED" }}
              value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />

            {error && <div style={{ color: "#E28576", fontSize: 12.5, marginTop: 8 }}>{error}</div>}

            <button disabled={busy} type="submit" className="btn btn-amber" style={{ width: "100%", justifyContent: "center", marginTop: 18, padding: "11px 0" }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p style={{ textAlign: "center", fontSize: 11, color: "#6F8579", marginTop: 18 }}>
            Your role and permissions come from your account — no role picker here.
          </p>
        </div>
      </div>
    </div>
  );
}
