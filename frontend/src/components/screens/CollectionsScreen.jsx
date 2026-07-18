import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Circle, Phone, Wallet2 } from "lucide-react";
import { api } from "../../api/client";
import { useData } from "../../contexts/DataContext";
import { CURRENCY } from "../../lib/domain";
import { LivePulse } from "../primitives";

export default function CollectionsScreen({ currentUser, openCustomer }) {
  const { loans, myBalance, addPayment, depositCash } = useData();
  const [collectedToday, setCollectedToday] = useState([]); // loanIds collected today
  const [busyLoanId, setBusyLoanId] = useState(null);
  const myLoans = loans.filter(l => l.officerId === currentUser.id && l.status === "active");

  const loadToday = useCallback(async () => {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const rows = await api.listPayments({ branchId: currentUser.branchId, type: "installment", since: todayStart.toISOString(), limit: 200 });
    setCollectedToday(rows.filter(p => p.recordedBy?.id === currentUser.id || p.recordedById === currentUser.id).map(p => p.loanId));
  }, [currentUser]);
  useEffect(() => { loadToday(); }, [loadToday]);

  const collectedSet = new Set(collectedToday);
  const collectedCount = myLoans.filter(l => collectedSet.has(l.id)).length;

  const collect = async (loan) => {
    setBusyLoanId(loan.id);
    try {
      await addPayment({ loanId: loan.id, customerId: loan.customerId, branchId: loan.branchId, type: "installment", amount: loan.installmentAmount, note: "Daily installment" });
      await loadToday();
    } catch (err) {
      alert(err.message || "Could not record collection");
    } finally {
      setBusyLoanId(null);
    }
  };

  const doDeposit = async () => {
    const amt = Number(prompt(`Deposit how much to the company account? (You're holding ${CURRENCY(myBalance?.current || 0)})`, String(myBalance?.current || 0)));
    if (amt > 0) {
      try { await depositCash({ amount: amt, note: "Cash deposit to company account" }); }
      catch (err) { alert(err.message || "Could not record deposit"); }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ background: "linear-gradient(135deg,var(--ink),var(--ink-soft))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#9BB0A5", textTransform: "uppercase", letterSpacing: ".04em", display: "flex", alignItems: "center", gap: 8 }}>Today's route <LivePulse label="syncing" /></div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{collectedCount}/{myLoans.length} collected</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#9BB0A5", textTransform: "uppercase", letterSpacing: ".04em" }}>Cash in hand</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "#E59A2E", marginTop: 4 }}>{CURRENCY(myBalance?.current || 0)}</div>
        </div>
        <button onClick={doDeposit} className="btn btn-amber btn-sm"><Wallet2 size={13}/>Deposit cash</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {myLoans.map(l => {
          const done = collectedSet.has(l.id);
          return (
            <div key={l.id} className="card card-tight" style={{ display: "flex", alignItems: "center", gap: 12, borderColor: done ? "var(--teal)" : "var(--border)", background: done ? "var(--teal-10)" : "var(--card)" }}>
              <button onClick={()=>!done && collect(l)} disabled={busyLoanId===l.id} style={{ background: "none", border: "none", padding: 0, cursor: done ? "default" : "pointer" }}>
                {done ? <CheckCircle2 color="#0E7C55" size={26}/> : <Circle color="#C7C1AF" size={26}/>}
              </button>
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={()=>openCustomer(l.customerId, l.id)}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.customer?.name}</div>
                <div className="muted-light" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                  <Phone size={11}/>{l.customer?.phone}
                  {l.displayStatus === "overdue" && <span className="text-rust" style={{ fontWeight: 600 }}>· {l.missedDays} missed</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontWeight: 600, fontSize: 13.5 }}>{CURRENCY(l.installmentAmount)}</div>
                <div className="muted-light" style={{ fontSize: 10.5 }}>bal {CURRENCY(l.balance?.outstanding)}</div>
              </div>
            </div>
          );
        })}
        {!myLoans.length && <div className="card muted" style={{ fontSize: 12.5 }}>No active loans on your route yet.</div>}
      </div>
    </div>
  );
}
