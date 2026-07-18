import React from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useData } from "../../contexts/DataContext";
import { CURRENCY } from "../../lib/domain";
import { KpiCard, LiveActivityFeed, OfficerCashTable } from "../primitives";

export default function OverviewDashboard({ role, currentUser }) {
  const { loans, customers, branches, officerBalances, myBalance, dashboardSummary, loading } = useData();
  const scopeBranch = role === "admin" || role === "accountant" ? null : currentUser.branchId;
  const pendingCount = loans.filter(l => l.status === "pending" && (!scopeBranch || l.branchId === scopeBranch)).length;
  const activeLoanCount = loans.filter(l => l.status !== "completed" && l.status !== "rejected" && (!scopeBranch || l.branchId === scopeBranch)).length;

  if (loading || !dashboardSummary) return <div className="muted" style={{ fontSize: 13.5 }}>Loading…</div>;

  const portfolioSplit = [
    { name: "On track", value: dashboardSummary.activeCount, color: "#0E7C55" },
    { name: "Overdue", value: dashboardSummary.overdueCount, color: "#D2543A" },
    { name: "Completed", value: dashboardSummary.completedCount, color: "#93A39C" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }} className="kpi-grid">
        <KpiCard label="Collected Today" value={CURRENCY(dashboardSummary.collectedToday)} sub="updates live" trend="up" tone="teal" />
        <KpiCard label="Outstanding Portfolio" value={CURRENCY(dashboardSummary.totalOutstanding)} sub={`${activeLoanCount} active loans`} tone="ink" />
        <KpiCard label="Overdue Cases" value={dashboardSummary.overdueCount} sub="3+ missed days" trend="down" tone="rust" />
        {role === "loan_officer" ? (
          <KpiCard label="Cash In Hand" value={CURRENCY(myBalance?.current || 0)} sub={pendingCount ? `${pendingCount} awaiting approval` : "for disbursing loans"} tone="amber" />
        ) : (
          <KpiCard label="Customers" value={(scopeBranch?customers.filter(c=>c.branchId===scopeBranch):customers).length} sub={scopeBranch?branches.find(b=>b.id===scopeBranch)?.name:`${branches.length} branches`} tone="amber" />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} className="dash-grid-3">
        <div className="card">
          <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Collections — last 14 days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dashboardSummary.last14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4DFD1" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#5B6B65" />
              <YAxis tick={{ fontSize: 10 }} stroke="#5B6B65" tickFormatter={(v)=>`${v/1000}k`} />
              <Tooltip formatter={(v)=>CURRENCY(v)} />
              <Line type="monotone" dataKey="amount" stroke="#0E7C55" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Portfolio status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={portfolioSplit} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={3}>
                {portfolioSplit.map((e,i)=><Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {(role === "admin" || role === "accountant") && (
        <div className="card">
          <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Loan officer cash positions</h3>
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Cash each route officer is holding from daily collections, by branch.</div>
          <OfficerCashTable balances={officerBalances} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: role === "admin" || role === "accountant" ? "2fr 1fr" : "1fr", gap: 16 }} className="dash-grid-3">
        {(role === "admin" || role === "accountant") && (
          <div className="card">
            <h3 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Branch performance</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dashboardSummary.branchPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4DFD1" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#5B6B65" />
                <YAxis tick={{ fontSize: 10 }} stroke="#5B6B65" tickFormatter={(v)=>`${v/1000}k`} />
                <Tooltip formatter={(v)=>CURRENCY(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="disbursed" fill="#0E7C55" radius={[4,4,0,0]} name="Disbursed" />
                <Bar dataKey="outstanding" fill="#E59A2E" radius={[4,4,0,0]} name="Outstanding" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <LiveActivityFeed branchId={scopeBranch} />
      </div>
    </div>
  );
}
