import React from "react";
import { TrendingUp, TrendingDown, Activity, PiggyBank, Wallet2 } from "lucide-react";
import { CURRENCY, timeAgo, PAYMENT_TYPE_META, ROLE_LABEL } from "../lib/domain";
import { useData } from "../contexts/DataContext";

export function KpiCard({ label, value, sub, trend, tone = "" }) {
  const barTone = { teal: "bar-teal", amber: "bar-amber", rust: "bar-rust", ink: "bar-ink" }[tone] || "bar-ink";
  const toneClass = tone ? `kpi-${tone}` : "";
  return (
    <div className={`card ${toneClass}`}>
      <div className={`kpi-topbar ${barTone}`} />
      <div className="kpi-label">{label}</div>
      <div className="kpi-value mono">{value}</div>
      {sub && (
        <div className="kpi-sub">
          {trend === "up" && <TrendingUp size={12} className="text-teal" />}
          {trend === "down" && <TrendingDown size={12} className="text-rust" />}
          {sub}
        </div>
      )}
    </div>
  );
}

export function DotGrid({ days, paid, missed = 0, size = "sm" }) {
  const dots = [];
  const total = Math.max(0, days || 0);
  for (let i = 0; i < total; i++) {
    let cls = "dot";
    if (i < paid) cls += " paid"; else if (i < paid + missed) cls += " missed";
    dots.push(<span key={i} className={cls} />);
  }
  return <div className={`dot-grid ${size === "md" ? "md" : ""}`}>{dots}</div>;
}

export function StatusPill({ status }) {
  const cls = { active: "pill-active", overdue: "pill-overdue", completed: "pill-completed", pending: "pill-pending", approved: "pill-approved", rejected: "pill-rejected", written_off: "pill-rejected" }[status] || "pill-active";
  return <span className={`pill ${cls}`}>{status?.replace("_", " ")}</span>;
}

export function LivePulse({ label = "Live" }) {
  return <span className="live-badge"><span className="live-dot" />{label}</span>;
}

export function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")].concat(
    rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Live, server-pushed feed of every payment recorded across the tenant
// (or a single branch) — this is real Socket.io data, not a simulation.
export function LiveActivityFeed({ branchId, limit = 8 }) {
  const { recentPayments } = useData();
  const rows = recentPayments.filter(p => !branchId || p.branchId === branchId).slice(0, limit);
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><Activity size={15} />Live activity</h3>
        <LivePulse />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto" }}>
        {rows.map(p => {
          const meta = PAYMENT_TYPE_META[p.type] || PAYMENT_TYPE_META.installment;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div className="icon-chip" style={{ background: meta.color + "1A" }}><meta.icon size={13} style={{ color: meta.color }} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>{p.recordedBy?.name}</span> recorded a <span style={{ fontWeight: 600 }}>{meta.label.toLowerCase()}</span> of <span className="mono" style={{ fontWeight: 600 }}>{CURRENCY(p.amount)}</span>{p.customer ? <> for <span style={{ fontWeight: 600 }}>{p.customer.name}</span></> : null}
                </div>
                <div className="muted-light" style={{ fontSize: 10.5 }}>{timeAgo(p.createdAt)}</div>
              </div>
            </div>
          );
        })}
        {!rows.length && <div className="muted-light" style={{ fontSize: 12 }}>No activity yet.</div>}
      </div>
    </div>
  );
}

// One row per route officer with their live cash-in-hand balance —
// shared by the Admin "Officer cash" tab, Accountant "Cash Book", and
// the Admin/Accountant dashboard. `balances` comes straight from
// GET /api/v1/cash/balances (already aggregated server-side).
export function OfficerCashTable({ balances, onFloat, onDeposit, showFloatAction, showDepositAction }) {
  return (
    <div className="list">
      <div style={{ overflowX: "auto" }}>
        <table className="dc-table">
          <thead><tr><th>Branch / Route</th><th>Officer</th><th>Cash in hand</th><th>Today</th><th>Last deposit</th><th></th></tr></thead>
          <tbody>
            {balances.map(b => (
              <tr key={b.officerId}>
                <td style={{ fontWeight: 600 }}>{b.branch || "—"}</td>
                <td>{b.officerName}</td>
                <td className="mono" style={{ fontWeight: 600 }}>{CURRENCY(b.current)}</td>
                <td className="mono" style={{ fontSize: 11.5 }}>+{CURRENCY(b.today?.collected)} / -{CURRENCY(b.today?.disbursed)}</td>
                <td className="muted-light" style={{ fontSize: 11.5 }}>{b.lastDepositAt ? timeAgo(b.lastDepositAt) : "Never"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  {showFloatAction && <button onClick={()=>{ const amt = Number(prompt(`Float top-up amount for ${b.officerName}?`, "50000")); if (amt>0) onFloat(b.officerId, amt); }} className="btn btn-outline btn-sm"><PiggyBank size={12}/>Float</button>}
                  {showDepositAction && <button onClick={()=>{ const amt = Number(prompt(`Deposit amount from ${b.officerName}?`, String(b.current))); if (amt>0) onDeposit(b.officerId, amt); }} className="btn btn-outline btn-sm"><Wallet2 size={12}/>Deposit</button>}
                </td>
              </tr>
            ))}
            {!balances.length && <tr><td colSpan={6} className="muted-light" style={{ padding: 16 }}>No route officers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
