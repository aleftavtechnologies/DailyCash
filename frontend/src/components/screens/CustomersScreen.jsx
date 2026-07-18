import React, { useState } from "react";
import { Search, Phone, MapPin } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { StatusPill } from "../primitives";

export default function CustomersScreen({ openCustomer }) {
  const { customers, loans, branches } = useData();
  const [q, setQ] = useState("");
  const rows = customers.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ position: "relative", maxWidth: 300 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#93A39C" }} />
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search customers" className="input" style={{ paddingLeft: 34 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }} className="cust-grid">
        {rows.map(c => {
          const loan = loans.find(l => l.customerId === c.id);
          return (
            <div key={c.id} onClick={()=>openCustomer(c.id, loan?.id)} className="card card-tight" style={{ cursor: "pointer" }}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div className="muted-light" style={{ fontSize: 11.5, marginTop: 2 }}>{c.businessType}</div>
              <div className="muted-light" style={{ fontSize: 11, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}><Phone size={11}/>{c.phone}</div>
              <div className="muted-light" style={{ fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11}/>{branches.find(b=>b.id===c.branchId)?.name}</div>
              {loan && <div style={{ marginTop: 8 }}><StatusPill status={loan.displayStatus} /></div>}
            </div>
          );
        })}
        {!rows.length && <div className="muted-light" style={{ fontSize: 12.5 }}>No customers found.</div>}
      </div>
    </div>
  );
}
