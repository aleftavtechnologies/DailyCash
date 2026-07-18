import React, { useState } from "react";
import { Building2, ChevronRight, Edit2, Plus } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { ROLE_LABEL } from "../../lib/domain";
import { OfficerCashTable } from "../primitives";

function BranchForm({ branch, onSave, onCancel }) {
  const { branches, users } = useData();
  const [name, setName] = useState(branch?.name || "");
  const [address, setAddress] = useState(branch?.address || "");
  const [loanOfficerId, setLoanOfficerId] = useState(branch?.loanOfficerId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // One branch = one route = one loan officer: only offer officers who
  // aren't already running another branch's route.
  const availableOfficers = users.filter(u => u.role === "loan_officer" && (!branches.some(b => b.loanOfficerId === u.id && b.id !== branch?.id)));

  const save = async () => {
    if (!name) return;
    setSaving(true); setError("");
    try {
      await onSave({ name, address, loanOfficerId: loanOfficerId || null });
    } catch (err) {
      setError(err.message || "Could not save branch");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 600 }}>{branch ? "Edit branch" : "New branch"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="form-grid-2">
        <div><label className="field-label">Branch name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Piliyandala" /></div>
        <div><label className="field-label">Address</label><input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Optional" /></div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Route loan officer (one per branch)</label>
          <select className="input" value={loanOfficerId} onChange={e=>setLoanOfficerId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {availableOfficers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="text-rust" style={{ fontSize: 12.5 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">{saving ? "Saving…" : "Save branch"}</button>
        <button onClick={onCancel} className="btn btn-outline btn-sm">Cancel</button>
      </div>
    </div>
  );
}

export default function AdminScreen() {
  const { branches, users, loanProducts, officerBalances, createBranch, updateBranch, issueFloat } = useData();
  const [tab, setTab] = useState("branches");
  const [editingId, setEditingId] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {["branches","users","products","cash"].map(t=>(
          <button key={t} onClick={()=>{setTab(t); setEditingId(null);}} className={`btn btn-sm ${tab===t?"btn-dark":"btn-outline"}`} style={{ textTransform: "capitalize" }}>
            {t === "products" ? "Loan products" : t === "cash" ? "Officer cash" : t}
          </button>
        ))}
      </div>

      {tab === "branches" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {editingId && (
            <BranchForm
              branch={editingId === "new" ? null : branches.find(b=>b.id===editingId)}
              onSave={async (data)=>{ editingId === "new" ? await createBranch(data) : await updateBranch(editingId, data); setEditingId(null); }}
              onCancel={()=>setEditingId(null)}
            />
          )}
          <div className="list">
            {branches.map(b=>(
              <div key={b.id} className="list-item">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 size={16} className="muted"/>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.name}</div>
                    <div className="muted-light" style={{ fontSize: 11 }}>{b.loanOfficer ? `Route officer: ${b.loanOfficer.name}` : "No officer assigned"}{b.address ? ` · ${b.address}` : ""}</div>
                  </div>
                </div>
                <button onClick={()=>setEditingId(b.id)} className="btn btn-outline btn-sm"><Edit2 size={12}/>Edit</button>
              </div>
            ))}
            {!branches.length && <div className="list-item muted-light" style={{ fontSize: 12.5 }}>No branches yet.</div>}
          </div>
          {!editingId && <button onClick={()=>setEditingId("new")} className="btn btn-dark btn-sm" style={{ alignSelf: "flex-start" }}><Plus size={14}/>Add branch</button>}
        </div>
      )}

      {tab === "users" && (
        <div className="list">
          {users.map(u=>(
            <div key={u.id} className="list-item">
              <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</div><div className="muted-light" style={{ fontSize: 11 }}>{ROLE_LABEL[u.role]} · {u.routeBranch?.name || "—"}</div></div>
              <ChevronRight size={16} className="muted-light" />
            </div>
          ))}
        </div>
      )}

      {tab === "products" && (
        <div className="list">
          {loanProducts.map(p=>(
            <div key={p.id} className="list-item">
              <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div><div className="muted-light" style={{ fontSize: 11 }}>{p.termDays} days · {p.interestValue}% flat interest</div></div>
              <ChevronRight size={16} className="muted-light" />
            </div>
          ))}
        </div>
      )}

      {tab === "cash" && (
        <OfficerCashTable balances={officerBalances} showFloatAction onFloat={(officerId, amount) => issueFloat({ officerId, amount, note: "Float top-up" })} />
      )}
    </div>
  );
}
