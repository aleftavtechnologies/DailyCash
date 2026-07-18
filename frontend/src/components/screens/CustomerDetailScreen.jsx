import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Phone, MapPin, MessageSquare, Send } from "lucide-react";
import { api } from "../../api/client";
import { getSocket } from "../../api/socket";
import { useData } from "../../contexts/DataContext";
import { CURRENCY, timeAgo, ROLE_LABEL, ROLE_PAYMENT_TYPES, PAYMENT_TYPE_META } from "../../lib/domain";
import { DotGrid, StatusPill, KpiCard } from "../primitives";

export default function CustomerDetailScreen({ customerId, currentUser, role, back }) {
  const { branches } = useData();
  const [data, setData] = useState(null); // { customer, loan, balance, nextDueDate, payments, comments }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const allowedTypes = ROLE_PAYMENT_TYPES[role] || [];
  const [payType, setPayType] = useState(allowedTypes[0] || "installment");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const ledger = await api.getCustomerLedger(customerId);
      setData(ledger);
      setPayAmount(ledger.loan?.installmentAmount || "");
    } catch (err) {
      setError(err.message || "Could not load this customer");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  // Live updates while this screen is open: if someone else records a
  // payment or comment for this exact customer, refresh immediately.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onPayment = (p) => { if (p.customerId === customerId) load(); };
    const onComment = (c) => { if (c.customerId === customerId) load(); };
    socket.on("payment.created", onPayment);
    socket.on("comment.created", onComment);
    return () => { socket.off("payment.created", onPayment); socket.off("comment.created", onComment); };
  }, [customerId, load]);

  if (loading) return <div className="muted" style={{ fontSize: 13.5 }}>Loading…</div>;
  if (error) return <div className="card text-rust" style={{ fontSize: 13 }}>{error}</div>;
  if (!data?.loan) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button onClick={back} className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}><ArrowLeft size={14}/>Back</button>
      <div className="card muted" style={{ fontSize: 13 }}>This customer has no loan yet.</div>
    </div>
  );

  const { customer, loan, balance, nextDueDate, payments, comments } = data;

  const submitPayment = async () => {
    if (!payAmount) return;
    setBusy(true);
    try {
      await api.addPayment({ loanId: loan.id, customerId, branchId: loan.branchId, type: payType, amount: Number(payAmount), note: payNote || PAYMENT_TYPE_META[payType].label });
      setPayNote("");
      await load();
    } catch (err) {
      alert(err.message || "Could not record payment");
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setBusy(true);
    try {
      await api.addComment(customerId, commentText.trim());
      setCommentText("");
      await load();
    } catch (err) {
      alert(err.message || "Could not add comment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button onClick={back} className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}><ArrowLeft size={14}/>Back</button>

      <div className="card" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }} className="font-display">{customer.name}</div>
          <div className="muted-light" style={{ fontSize: 11.5, marginTop: 6, display: "flex", flexWrap: "wrap", gap: 14 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11}/>{customer.phone}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11}/>{branches.find(b=>b.id===customer.branchId)?.name}</span>
            <span>{customer.businessType}</span>
            <span className="mono">{customer.nic}</span>
          </div>
        </div>
        <StatusPill status={loan.displayStatus} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }} className="kpi-grid">
        <KpiCard label="Loan Balance" value={CURRENCY(balance.outstanding)} tone="ink" />
        <KpiCard label="Arrears" value={CURRENCY((loan.missedDays||0) * loan.installmentAmount)} tone="rust" sub={`${loan.missedDays||0} missed days`} />
        <KpiCard label="Next Due" value={loan.status==="completed" ? "—" : (nextDueDate ? nextDueDate.slice(0,10) : "—")} tone="amber" />
        <KpiCard label="Other Charges" value={CURRENCY(balance.charges)} tone="teal" sub="documents, fees" />
      </div>

      <div className="card">
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>Installment progress ({loan.id.slice(0,8)} · {loan.termDays} days)</div>
        <DotGrid days={loan.termDays} paid={balance.daysPaid} missed={loan.missedDays || 0} size="md" />
      </div>

      {allowedTypes.length > 0 && loan.status === "active" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600 }}>Add payment</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8 }} className="form-grid-3">
            <select className="input" value={payType} onChange={e=>setPayType(e.target.value)}>
              {allowedTypes.map(t => <option key={t} value={t}>{PAYMENT_TYPE_META[t].label}</option>)}
            </select>
            <input type="number" className="input input-mono" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="Amount" />
            <input className="input" value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="Note (optional)" />
          </div>
          <button onClick={submitPayment} disabled={busy} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>{busy ? "Recording…" : "Record payment"}</button>
        </div>
      )}
      {(allowedTypes.length === 0 || loan.status !== "active") && (
        <div className="card muted" style={{ fontSize: 12.5 }}>
          {loan.status !== "active" ? `This loan is ${loan.status} — payments can only be recorded on active loans.` : `Your role (${ROLE_LABEL[role]}) can view this ledger but not record payments directly.`}
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Payment ledger</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="dc-table">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Recorded by</th><th>Note</th></tr></thead>
            <tbody>
              {payments.slice(0,30).map(p => {
                const meta = PAYMENT_TYPE_META[p.type] || PAYMENT_TYPE_META.installment;
                return (
                  <tr key={p.id}>
                    <td className="mono">{new Date(p.createdAt).toLocaleDateString("en-LK",{day:"2-digit",month:"short"})}</td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: meta.color }}><meta.icon size={11}/>{meta.label}</span></td>
                    <td className="mono">{CURRENCY(p.amount)}</td>
                    <td>{p.recordedBy?.name}</td>
                    <td className="muted-light">{p.note}</td>
                  </tr>
                );
              })}
              {!payments.length && <tr><td colSpan={5} className="muted-light" style={{ padding: 14 }}>No payments recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><MessageSquare size={15}/>Comments — visible to every role</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitComment()} placeholder="Add a note about this customer…" className="input" style={{ flex: 1 }} />
          <button onClick={submitComment} disabled={busy} className="btn btn-dark"><Send size={15}/></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10 }}>
              <div className="avatar">{c.user?.name?.split(" ").map(n=>n[0]).join("")}</div>
              <div>
                <div style={{ fontSize: 12 }}><span style={{ fontWeight: 600 }}>{c.user?.name}</span> <span className="muted-light">· {ROLE_LABEL[c.user?.role]} · {timeAgo(c.createdAt)}</span></div>
                <div style={{ fontSize: 13.5, marginTop: 2 }}>{c.text}</div>
              </div>
            </div>
          ))}
          {!comments.length && <div className="muted-light" style={{ fontSize: 12 }}>No comments yet.</div>}
        </div>
      </div>
    </div>
  );
}
