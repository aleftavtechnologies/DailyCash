import React, { useState } from "react";
import { ClipboardCheck, CheckCircle2, XCircle, Phone, MapPin, Paperclip } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { fileUrl } from "../../api/client";
import { CURRENCY, DOCUMENT_TYPES } from "../../lib/domain";

export default function ApprovalsScreen() {
  const { loans, branches, approveLoan, rejectLoan } = useData();
  const pending = loans.filter(l => l.status === "pending");
  const [busyId, setBusyId] = useState(null);

  const doApprove = async (id) => {
    setBusyId(id);
    try { await approveLoan(id); } catch (err) { alert(err.message); } finally { setBusyId(null); }
  };
  const doReject = async (id) => {
    const reason = prompt("Reason for rejecting this application?");
    if (reason === null) return;
    setBusyId(id);
    try { await rejectLoan(id, reason || "Not specified"); } catch (err) { alert(err.message); } finally { setBusyId(null); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card" style={{ background: "var(--amber-10)", borderColor: "rgba(229,154,46,.3)", display: "flex", alignItems: "center", gap: 12 }}>
        <ClipboardCheck color="#B87418" size={22} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{pending.length} applications awaiting review</div>
          <div className="muted" style={{ fontSize: 12 }}>Check the uploaded documents before approving</div>
        </div>
      </div>
      {pending.map(l => (
        <div key={l.id} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{l.customer?.name} <span className="muted-light mono" style={{ fontWeight: 400, fontSize: 11 }}>· {l.id.slice(0,8)}</span></div>
              <div className="muted-light" style={{ fontSize: 11.5, marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11}/>{l.customer?.phone}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11}/>{branches.find(b=>b.id===l.branchId)?.name}</span>
                <span>Submitted by {l.officer?.name}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontWeight: 600 }}>{CURRENCY(l.principal)}</div>
              <div className="muted-light" style={{ fontSize: 11 }}>{l.termDays} days · {CURRENCY(l.installmentAmount)}/day</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {(l.documents || []).map((d) => (
              <a key={d.id} href={fileUrl(d.fileUrl)} target="_blank" rel="noreferrer" className="pill" style={{ background: "var(--paper)", color: "var(--grey)", border: "1px solid var(--border)", textDecoration: "none" }}>
                <Paperclip size={11} style={{ marginRight: 4 }}/>{DOCUMENT_TYPES.find(t=>t.key===d.type)?.label || d.type}
              </a>
            ))}
            {!l.documents?.length && <span className="muted-light" style={{ fontSize: 11.5 }}>No documents attached</span>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={()=>doApprove(l.id)} disabled={busyId===l.id} className="btn btn-primary btn-sm"><CheckCircle2 size={13}/>Approve</button>
            <button onClick={()=>doReject(l.id)} disabled={busyId===l.id} className="btn btn-outline btn-sm"><XCircle size={13}/>Reject</button>
          </div>
        </div>
      ))}
      {!pending.length && <div className="card muted" style={{ fontSize: 12.5 }}>Nothing waiting on you right now.</div>}
    </div>
  );
}
