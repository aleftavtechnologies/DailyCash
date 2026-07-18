import React, { useState } from "react";
import { Search, Plus } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { CURRENCY } from "../../lib/domain";
import { DotGrid, StatusPill } from "../primitives";
import LoanApplicationForm from "./LoanApplicationForm";

export default function LoansScreen({ openCustomer, currentUser, role }) {
  const { loans, disburseLoan } = useData();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const scoped = role === "loan_officer" ? loans.filter(l => l.officerId === currentUser.id) : loans;
  const rows = scoped.filter(l => {
    if (statusFilter !== "all" && l.displayStatus !== statusFilter) return false;
    if (!q) return true;
    return l.customer?.name?.toLowerCase().includes(q.toLowerCase()) || l.id.toLowerCase().includes(q.toLowerCase());
  });
  const canSubmitLoans = role === "admin" || role === "loan_officer";

  const tryDisburse = async (loan) => {
    setBusyId(loan.id);
    try {
      await disburseLoan(loan.id);
    } catch (err) {
      alert(err.message || "Could not disburse this loan");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 300 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#93A39C" }} />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search customer or loan ID" className="input" style={{ paddingLeft: 34 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select className="input" style={{ width: "auto" }} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="all">All status</option><option value="pending">Pending</option><option value="approved">Approved</option>
            <option value="active">Active</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="rejected">Rejected</option>
          </select>
          {canSubmitLoans && <button onClick={()=>setShowForm(s=>!s)} className="btn btn-dark"><Plus size={15}/> New loan</button>}
        </div>
      </div>

      {showForm && <LoanApplicationForm currentUser={currentUser} onDone={()=>setShowForm(false)} />}

      <div className="list">
        <div style={{ overflowX: "auto" }}>
          <table className="dc-table">
            <thead><tr><th>Loan</th><th>Customer</th><th>Progress</th><th>Balance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.slice(0, 50).map(l => {
                const notDisbursed = ["pending", "approved", "rejected"].includes(l.status);
                const showDisburse = l.status === "approved" && (role === "admin" || (role === "loan_officer" && l.officerId === currentUser.id));
                return (
                  <tr key={l.id}>
                    <td className="mono" style={{ fontSize: 12, cursor: "pointer" }} onClick={()=>openCustomer(l.customerId, l.id)}>{l.id.slice(0,8)}</td>
                    <td className="clickable" onClick={()=>openCustomer(l.customerId, l.id)}><div style={{ fontWeight: 600 }}>{l.customer?.name}</div><div className="muted-light" style={{ fontSize: 11 }}>{l.customer?.phone}</div></td>
                    <td>{notDisbursed ? <span className="muted-light" style={{ fontSize: 11.5 }}>Not disbursed</span> : <DotGrid days={l.termDays} paid={l.balance?.daysPaid || 0} missed={l.missedDays || 0} />}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{CURRENCY(notDisbursed ? l.totalRepayable : l.balance?.outstanding)}</td>
                    <td><StatusPill status={l.displayStatus} /></td>
                    <td>{showDisburse && <button onClick={()=>tryDisburse(l)} disabled={busyId===l.id} className="btn btn-primary btn-sm">{busyId===l.id?"…":"Disburse"}</button>}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={6} className="muted-light" style={{ padding: 16 }}>No loans match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
