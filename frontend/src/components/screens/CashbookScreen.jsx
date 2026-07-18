import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";
import { useData } from "../../contexts/DataContext";
import { CURRENCY, timeAgo } from "../../lib/domain";
import { KpiCard, OfficerCashTable } from "../primitives";

export default function CashbookScreen({ currentUser }) {
  const { officerBalances, depositCash } = useData();
  const [officePayments, setOfficePayments] = useState([]);
  const [amount, setAmount] = useState(1000);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const loadOfficePayments = useCallback(async () => {
    const rows = await api.listPayments({ type: "office_payment", limit: 20 });
    setOfficePayments(rows);
  }, []);
  useEffect(() => { loadOfficePayments(); }, [loadOfficePayments]);

  const todayStr = new Date().toISOString().slice(0,10);
  const inflowToday = officeBalancesInflowToday(officerBalances);
  const officeToday = officePayments.filter(p=>p.createdAt.slice(0,10)===todayStr).reduce((s,p)=>s+p.amount,0);

  const addOffice = async () => {
    if (!amount) return;
    setBusy(true);
    try {
      await api.addPayment({ branchId: currentUser.branchId, type: "office_payment", amount: Number(amount), note: note || "Office payment" });
      setNote("");
      await loadOfficePayments();
    } catch (err) {
      alert(err.message || "Could not record expense");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }} className="kpi-grid-3">
        <KpiCard label="Officer cash collected today" value={CURRENCY(inflowToday)} tone="teal" />
        <KpiCard label="Office payments today" value={CURRENCY(officeToday)} tone="rust" />
        <KpiCard label="Net cash position" value={CURRENCY(inflowToday - officeToday)} tone="ink" />
      </div>
      <div className="card">
        <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Loan officer cash positions</h3>
        <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>What each officer is holding from daily collections, ready to record their month-end deposit.</div>
        <OfficerCashTable balances={officerBalances} showDepositAction
          onDeposit={(officerId, amt) => depositCash({ officerId, amount: amt, note: "Cash deposit to company account" })} />
      </div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 600 }}>Record office payment</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }} className="form-grid-2">
          <input type="number" className="input input-mono" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount" />
          <input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Branch rent, fuel, stationery" />
        </div>
        <button onClick={addOffice} disabled={busy} className="btn btn-dark" style={{ alignSelf: "flex-start" }}>{busy ? "Saving…" : "Add expense"}</button>
      </div>
      <div className="card">
        <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Recent office payments</h3>
        <table className="dc-table">
          <tbody>
            {officePayments.map(e=>(
              <tr key={e.id}>
                <td>{e.note}</td>
                <td className="muted-light" style={{ fontSize: 11.5 }}>{timeAgo(e.createdAt)}</td>
                <td className="mono" style={{ textAlign: "right" }}>{CURRENCY(e.amount)}</td>
              </tr>
            ))}
            {!officePayments.length && <tr><td className="muted-light" style={{ padding: 12 }}>No office payments recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function officeBalancesInflowToday(officerBalances) {
  return officerBalances.reduce((s, b) => s + (b.today?.collected || 0), 0);
}
