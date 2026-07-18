import React, { useState } from "react";
import { ClipboardCheck, Upload, Paperclip } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { CURRENCY, DOCUMENT_TYPES } from "../../lib/domain";
import { DotGrid } from "../primitives";

export default function LoanApplicationForm({ currentUser, onDone }) {
  const { loanProducts, branches, submitLoanApplication } = useData();
  const [name, setName] = useState("");
  const [nic, setNic] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [address, setAddress] = useState("");
  const [productId, setProductId] = useState(loanProducts[0]?.id || "");
  const [principal, setPrincipal] = useState(50000);
  const [customDays, setCustomDays] = useState(null);
  const [customPct, setCustomPct] = useState(null);
  const [documents, setDocuments] = useState({}); // { type: File }
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState("");

  const product = loanProducts.find(p => p.id === productId) || loanProducts[0];
  const days = customDays ?? product?.termDays ?? 60;
  const pct = customPct ?? product?.interestValue ?? 20;
  const total = Math.round(principal * (1 + pct / 100));
  const installment = Math.round(total / days);
  const canSubmit = name && nic && phone && documents.nic_photo && product && !submitting;

  const attachDoc = (type, file) => {
    if (!file) return;
    setDocuments(prev => ({ ...prev, [type]: file }));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError("");
    try {
      const branch = branches.find(b => b.id === currentUser.branchId);
      const officerId = currentUser.role === "loan_officer" ? currentUser.id : branch?.loanOfficerId;
      if (!officerId) throw new Error("This branch has no route officer assigned yet — ask an Admin to assign one first.");
      const { loan } = await submitLoanApplication({
        customer: { name, nic, phone, businessType, address },
        branchId: currentUser.branchId, officerId, productId,
        principal, termDays: days, interestValue: pct,
        documents: Object.entries(documents).map(([type, file]) => ({ type, file })),
      });
      setSubmitted(loan);
    } catch (err) {
      setError(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--amber-10)", borderColor: "rgba(229,154,46,.3)" }}>
        <ClipboardCheck color="#B87418" size={22} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Application {submitted.id.slice(0,8)} submitted for approval</div>
          <div className="muted" style={{ fontSize: 12 }}>Admin will review the details and documents, then approve or reject it. You'll be able to disburse once it's approved.</div>
        </div>
        <button onClick={onDone} className="btn btn-outline btn-sm">Done</button>
      </div>
    );
  }

  if (!loanProducts.length) {
    return <div className="card muted" style={{ fontSize: 12.5 }}>No loan products configured yet — ask an Admin to set one up first.</div>;
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 600 }}>New loan application</h3>

      <div>
        <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>Customer details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="form-grid-2">
          <div><label className="field-label">Full name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Sunil Perera" /></div>
          <div><label className="field-label">NIC number</label><input className="input" value={nic} onChange={e=>setNic(e.target.value)} placeholder="198012345678V" /></div>
          <div><label className="field-label">Phone</label><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0771234567" /></div>
          <div><label className="field-label">Business type</label><input className="input" value={businessType} onChange={e=>setBusinessType(e.target.value)} placeholder="e.g. Grocery Shop" /></div>
          <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Address</label><input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Shop / home address" /></div>
        </div>
      </div>

      <div>
        <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>Loan terms</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="form-grid-2">
          <div>
            <label className="field-label">Loan product</label>
            <select className="input" value={productId} onChange={e=>{setProductId(e.target.value); setCustomDays(null); setCustomPct(null);}}>
              {loanProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.termDays}d, {p.interestValue}%)</option>)}
            </select>
          </div>
          <div><label className="field-label">Principal (Rs.)</label><input type="number" className="input input-mono" value={principal} onChange={e=>setPrincipal(Number(e.target.value)||0)} /></div>
          <div><label className="field-label">Installment days (custom)</label><input type="number" className="input input-mono" placeholder={String(product?.termDays)} value={customDays ?? ""} onChange={e=>setCustomDays(e.target.value?Number(e.target.value):null)} /></div>
          <div><label className="field-label">Interest % (custom)</label><input type="number" className="input input-mono" placeholder={String(product?.interestValue)} value={customPct ?? ""} onChange={e=>setCustomPct(e.target.value?Number(e.target.value):null)} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, background: "var(--paper)", borderRadius: 12, padding: 14, marginTop: 12 }}>
          <div><div className="kpi-label">Total repayable</div><div className="mono" style={{ fontWeight: 600, marginTop: 3 }}>{CURRENCY(total)}</div></div>
          <div><div className="kpi-label">Daily installment</div><div className="mono text-teal" style={{ fontWeight: 600, marginTop: 3 }}>{CURRENCY(installment)}</div></div>
          <div><div className="kpi-label">Duration</div><div className="mono" style={{ fontWeight: 600, marginTop: 3 }}>{days} days</div></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>Schedule preview ({days} installments)</div>
          <DotGrid days={days} paid={0} size="sm" />
        </div>
      </div>

      <div>
        <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>Documents</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="form-grid-2">
          {DOCUMENT_TYPES.map(d => (
            <label key={d.key} className="card card-tight" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderStyle: documents[d.key] ? "solid" : "dashed", borderColor: documents[d.key] ? "var(--teal)" : "var(--border)" }}>
              <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e=>attachDoc(d.key, e.target.files[0])} />
              {documents[d.key] ? <Paperclip size={16} color="#0E7C55" /> : <Upload size={16} color="#93A39C" />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{d.label}{d.key === "nic_photo" && <span className="text-rust"> *</span>}</div>
                <div className="muted-light" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{documents[d.key]?.name || "Tap to upload"}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && <div className="text-rust" style={{ fontSize: 12.5 }}>{error}</div>}
      <button onClick={submit} disabled={!canSubmit} className="btn btn-primary" style={{ justifyContent: "center", padding: "11px 0" }}>
        {submitting ? "Submitting…" : "Submit for approval"}
      </button>
      {!canSubmit && !submitting && <div className="muted-light" style={{ fontSize: 11.5, marginTop: -10 }}>Name, NIC, phone and the NIC photo are required before this can be submitted.</div>}
    </div>
  );
}
