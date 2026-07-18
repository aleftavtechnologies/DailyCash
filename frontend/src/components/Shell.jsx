import React, { useState } from "react";
import { Menu, X, Bell, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_MENUS, ROLE_LABEL } from "../lib/domain";
import { LivePulse } from "./primitives";

import OverviewDashboard from "./screens/OverviewDashboard";
import LoansScreen from "./screens/LoansScreen";
import CustomersScreen from "./screens/CustomersScreen";
import CustomerDetailScreen from "./screens/CustomerDetailScreen";
import ReportsScreen from "./screens/ReportsScreen";
import AdminScreen from "./screens/AdminScreen";
import ApprovalsScreen from "./screens/ApprovalsScreen";
import CashbookScreen from "./screens/CashbookScreen";
import CollectionsScreen from "./screens/CollectionsScreen";
import RecoveryScreen from "./screens/RecoveryScreen";

const TITLE_MAP = {
  dashboard: "Overview", loans: "Loans", customers: "Customers", reports: "Reports",
  admin: "Company setup", cashbook: "Cash book", collections: "Today's route", recovery: "Overdue cases",
  customerDetail: "Customer", approvals: "Loan approvals",
};

export default function Shell() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const role = user.role;
  const menu = ROLE_MENUS[role];

  const openCustomer = (customerId, loanId) => { setDetail({ customerId, loanId }); setScreen("customerDetail"); };
  const goto = (key) => { setDetail(null); setScreen(key); setNavOpen(false); };

  const renderScreen = () => {
    switch (screen) {
      case "dashboard": return <OverviewDashboard role={role} currentUser={user} />;
      case "loans": return <LoansScreen openCustomer={openCustomer} currentUser={user} role={role} />;
      case "customers": return <CustomersScreen openCustomer={openCustomer} />;
      case "reports": return <ReportsScreen />;
      case "admin": return <AdminScreen />;
      case "approvals": return <ApprovalsScreen currentUser={user} />;
      case "cashbook": return <CashbookScreen currentUser={user} />;
      case "collections": return <CollectionsScreen currentUser={user} openCustomer={openCustomer} />;
      case "recovery": return <RecoveryScreen currentUser={user} openCustomer={openCustomer} />;
      case "customerDetail": return <CustomerDetailScreen customerId={detail.customerId} focusLoanId={detail.loanId} currentUser={user} role={role} back={()=>setScreen("customers")} />;
      default: return null;
    }
  };

  return (
    <div className="dc">
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="logo-chip mono">Rs</div>
            <span className="font-display" style={{ color: "#F5F3ED", fontWeight: 600, fontSize: 15 }}>DailyCash</span>
          </div>
          <nav className="sidebar-nav">
            {menu.map(m => (
              <button key={m.key} onClick={()=>goto(m.key)} className={`nav-item ${screen===m.key?"active":""}`}>
                <m.icon size={16}/>{m.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="user-chip"><div className="name">{user.name}</div><div className="role">{ROLE_LABEL[role]}</div></div>
            <button onClick={logout} className="nav-item"><LogOut size={15}/>Sign out</button>
          </div>
        </aside>

        <div className="topbar-mobile">
          <button onClick={()=>setNavOpen(true)} style={{ background: "none", border: "none" }}><Menu size={22} color="#fff"/></button>
          <span className="font-display" style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{TITLE_MAP[screen]}</span>
          <Bell size={19} color="#fff"/>
        </div>

        <div className={`drawer-overlay ${navOpen?"open":""}`} onClick={()=>setNavOpen(false)} />
        <div className={`drawer ${navOpen?"open":""}`}>
          <div className="sidebar-header" style={{ justifyContent: "space-between" }}>
            <span className="font-display" style={{ color: "#F5F3ED", fontWeight: 600, fontSize: 15 }}>DailyCash</span>
            <button onClick={()=>setNavOpen(false)} style={{ background: "none", border: "none" }}><X size={20} color="#fff"/></button>
          </div>
          <nav className="sidebar-nav">
            {menu.map(m => (
              <button key={m.key} onClick={()=>goto(m.key)} className={`nav-item ${screen===m.key?"active":""}`}>
                <m.icon size={16}/>{m.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button onClick={logout} className="nav-item"><LogOut size={15}/>Sign out</button>
          </div>
        </div>

        <div className="bottom-nav">
          {menu.slice(0,5).map(m => (
            <button key={m.key} onClick={()=>goto(m.key)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1, padding: "6px 0" }}>
              <m.icon size={19} color={screen===m.key?"#0E7C55":"#93A39C"} />
              <span style={{ fontSize: 10, fontWeight: 600, color: screen===m.key?"#0E7C55":"#93A39C" }}>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="main">
          <div className="topbar-desktop">
            <h1 className="font-display" style={{ fontSize: 19, fontWeight: 600 }}>{TITLE_MAP[screen]}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <LivePulse label="realtime sync" />
              <Bell size={18} className="muted"/>
              <div className="avatar">{user.name.split(" ").map(n=>n[0]).join("")}</div>
            </div>
          </div>
          <div className="content">{renderScreen()}</div>
        </div>
      </div>
    </div>
  );
}
