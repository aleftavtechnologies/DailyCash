import React, { useState } from "react";
import { AlertTriangle, Phone, MapPin, MessageSquare } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { CURRENCY } from "../../lib/domain";
import { DotGrid } from "../primitives";

export default function RecoveryScreen({ currentUser, openCustomer }) {
  const { loans, branches, addPayment } = useData();
  const overdue = loans.filter(l => l.displayStatus === "overdue");
  const [busyId, setBusyId] = useState(null);

  const recordPayment = async (l) => {
    setBusyId(l.id);
    try {
      await addPayment({ loanId: l.id, customerId: l.customerId, branchId: l.branchId, type: "installment", amount: l.installmentAmount, note: "Collected on recovery visit" });
    } catch (err) {
      alert(err.message || "Could not record payment");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card" style={{ background: "var(--rust-10)", borderColor: "rgba(210,84,58,.3)", display: "flex", alignItems: "center", gap: 12 }}>
        <AlertTriangle color="#D2543A" size={22} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{overdue.length} cases need follow-up</div>
          <div className="muted" style={{ fontSize: 12 }}>3 or more consecutive missed installments</div>
        </div>
      </div>
      {overdue.map(l => {
        const arrears = (l.missedDays || 0) * l.installmentAmount;
        return (
          <div key={l.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ cursor: "pointer" }} onClick={()=>openCustomer(l.customerId, l.id)}>
                <div style={{ fontWeight: 600 }}>{l.customer?.name}</div>
                <div className="muted-light" style={{ fontSize: 11, display: "flex", gap: 12, marginTop: 3 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11}/>{l.customer?.phone}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11}/>{branches.find(b=>b.id===l.branchId)?.name}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono text-rust" style={{ fontWeight: 600 }}>{CURRENCY(arrears)}</div>
                <div className="muted-light" style={{ fontSize: 10.5 }}>in arrears · bal {CURRENCY(l.balance?.outstanding)}</div>
              </div>
            </div>
            <div style={{ margin: "10px 0" }}><DotGrid days={l.termDays} paid={l.balance?.daysPaid || 0} missed={l.missedDays || 0} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={()=>recordPayment(l)} disabled={busyId===l.id} className="btn btn-primary btn-sm">{busyId===l.id?"…":"Record payment"}</button>
              <button onClick={()=>openCustomer(l.customerId, l.id)} className="btn btn-outline btn-sm"><MessageSquare size={12}/>Add comment</button>
            </div>
          </div>
        );
      })}
      {!overdue.length && <div className="card muted" style={{ fontSize: 12.5 }}>No overdue cases right now.</div>}
    </div>
  );
}
