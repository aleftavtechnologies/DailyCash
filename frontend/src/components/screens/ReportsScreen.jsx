import React, { useState } from "react";
import { Filter, Download } from "lucide-react";
import { api } from "../../api/client";
import { useData } from "../../contexts/DataContext";
import { downloadCSV } from "../primitives";

const REPORT_TYPES = [
  { key: "daily_collection", label: "Daily Collection Report" },
  { key: "outstanding_portfolio", label: "Outstanding Loan Report" },
  { key: "overdue_arrears", label: "Overdue / Arrears Aging" },
  { key: "officer_performance", label: "Officer Performance" },
  { key: "payment_type_breakdown", label: "Payment Type Breakdown" },
  { key: "branch_comparison", label: "Branch Comparison" },
];

export default function ReportsScreen() {
  const { branches } = useData();
  const [type, setType] = useState(REPORT_TYPES[0].key);
  const [branchId, setBranchId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.generateReport({ type, branchId: branchId === "all" ? undefined : branchId, from: from || undefined, to: to || undefined });
      setResult(res);
    } catch (err) {
      alert(err.message || "Could not generate report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><Filter size={15}/>Report builder</h3>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }} className="form-grid-2">
          <div>
            <label className="field-label">Report type</label>
            <select className="input" value={type} onChange={e=>setType(e.target.value)}>
              {REPORT_TYPES.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Branch</label>
            <select className="input" value={branchId} onChange={e=>setBranchId(e.target.value)}>
              <option value="all">All branches</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">From</label><input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} /></div>
          <div><label className="field-label">To</label><input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} /></div>
        </div>
        <button onClick={generate} disabled={busy} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>{busy ? "Generating…" : "Generate report"}</button>
      </div>

      {result && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h4 style={{ fontSize: 13.5, fontWeight: 600 }}>{REPORT_TYPES.find(t=>t.key===type)?.label} <span className="muted-light" style={{ fontWeight: 400 }}>({result.count} rows)</span></h4>
            <button onClick={()=>downloadCSV(type+".csv", result.rows)} className="btn btn-outline btn-sm"><Download size={13}/>Export CSV</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="dc-table">
              <thead><tr>{result.rows[0] && Object.keys(result.rows[0]).map(k=><th key={k}>{k}</th>)}</tr></thead>
              <tbody>
                {result.rows.map((r,i)=>(
                  <tr key={i}>{Object.values(r).map((v,j)=><td key={j} className="mono">{typeof v === "number" ? v.toLocaleString() : String(v ?? "")}</td>)}</tr>
                ))}
                {!result.rows.length && <tr><td className="muted-light" style={{ padding: 14 }}>No rows for this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
