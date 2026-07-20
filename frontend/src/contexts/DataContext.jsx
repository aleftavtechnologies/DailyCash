import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

// "socket" = Docker/VPS deployment, instant push via Socket.io.
// "poll"   = serverless deployment (Vercel/Lambda) — there's no
// persistent connection to push through, so this refetches on an
// interval instead. Set VITE_REALTIME_MODE=poll for that build.
const REALTIME_MODE = import.meta.env.VITE_REALTIME_MODE || "socket";
const POLL_INTERVAL_MS = 7000;

export function DataProvider({ children }) {
  const { user } = useAuth();
  const isPrivileged = user && ["admin", "accountant"].includes(user.role);

  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loanProducts, setLoanProducts] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [officerBalances, setOfficerBalances] = useState([]); // admin/accountant: every officer
  const [myBalance, setMyBalance] = useState(null); // loan_officer: just their own
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refreshBranches = useCallback(async () => setBranches(await api.listBranches()), []);
  const refreshUsers = useCallback(async () => { if (isPrivileged) setUsers(await api.listUsers()); }, [isPrivileged]);
  const refreshCustomers = useCallback(async () => setCustomers(await api.listCustomers()), []);
  const refreshLoans = useCallback(async () => setLoans(await api.listLoans()), []);
  const refreshLoanProducts = useCallback(async () => setLoanProducts(await api.listLoanProducts()), []);
  const refreshPayments = useCallback(async () => setRecentPayments(await api.listPayments({ limit: 50 })), []);
  const refreshDashboard = useCallback(async () => setDashboardSummary(await api.getDashboardSummary()), []);
  const refreshBalances = useCallback(async () => {
    if (!user) return;
    if (isPrivileged) setOfficerBalances(await api.listOfficerBalances());
    else if (user.role === "loan_officer") setMyBalance(await api.getOfficerBalance(user.id));
  }, [user, isPrivileged]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshBranches(), refreshUsers(), refreshCustomers(), refreshLoans(), refreshLoanProducts(), refreshPayments(), refreshBalances(), refreshDashboard()]);
  }, [refreshBranches, refreshUsers, refreshCustomers, refreshLoans, refreshLoanProducts, refreshPayments, refreshBalances, refreshDashboard]);

  useEffect(() => {
    mounted.current = true;
    if (!user) return;
    setLoading(true);
    refreshAll().finally(() => mounted.current && setLoading(false));
    return () => { mounted.current = false; };
  }, [user, refreshAll]);

  // Realtime: on the socket.io deployment, the backend broadcasts into
  // tenant:/branch: rooms (see backend/src/index.js + routes/payments.js,
  // comments.js, loans.js, cash.js) and we refetch the affected list on
  // each event. On the serverless deployment there's nothing to push, so
  // we just refetch everything on a short interval instead — same result,
  // small delay instead of instant.
  useEffect(() => {
    if (!user) return;

    if (REALTIME_MODE === "poll") {
      const iv = setInterval(() => {
        refreshPayments(); refreshLoans(); refreshBalances(); refreshDashboard();
      }, POLL_INTERVAL_MS);
      return () => clearInterval(iv);
    }

    const socket = getSocket();
    if (!socket) return;

    const onPayment = (payment) => {
      setRecentPayments(prev => [payment, ...prev].slice(0, 50));
      if (["installment", "document_charge", "other_charge"].includes(payment.type)) refreshBalances();
      refreshDashboard();
    };
    const onLoanEvent = () => { refreshLoans(); refreshBalances(); refreshDashboard(); };
    const onCashEvent = () => refreshBalances();

    socket.on("payment.created", onPayment);
    socket.on("loan.submitted", onLoanEvent);
    socket.on("loan.approved", onLoanEvent);
    socket.on("loan.rejected", onLoanEvent);
    socket.on("loan.disbursed", onLoanEvent);
    socket.on("cash.float", onCashEvent);
    socket.on("cash.deposit", onCashEvent);

    return () => {
      socket.off("payment.created", onPayment);
      socket.off("loan.submitted", onLoanEvent);
      socket.off("loan.approved", onLoanEvent);
      socket.off("loan.rejected", onLoanEvent);
      socket.off("loan.disbursed", onLoanEvent);
      socket.off("cash.float", onCashEvent);
      socket.off("cash.deposit", onCashEvent);
    };
  }, [user, refreshPayments, refreshLoans, refreshBalances, refreshDashboard]);

  // --- Actions -----------------------------------------------------
  const addPayment = useCallback(async (data) => {
    const payment = await api.addPayment(data);
    setRecentPayments(prev => [payment, ...prev].slice(0, 50));
    refreshBalances();
    return payment;
  }, [refreshBalances]);

  const createBranch = useCallback(async (data) => { const b = await api.createBranch(data); await refreshBranches(); return b; }, [refreshBranches]);
  const createUser = useCallback(async (data) => { const u = await api.createUser(data); await refreshUsers(); return u; }, [refreshUsers]);
  const createLoanProduct = useCallback(async (data) => { const p = await api.createLoanProduct(data); await refreshLoanProducts(); return p; }, [refreshLoanProducts]);
  const updateBranch = useCallback(async (id, data) => { const b = await api.updateBranch(id, data); await refreshBranches(); return b; }, [refreshBranches]);

  // Full application: create customer, create loan (pending), then
  // upload each attached document against the new loan id. `officerId`
  // is required explicitly — when a loan_officer submits it's their own
  // id; when an Admin submits on a branch's behalf, the caller must pass
  // that branch's route officer (see LoanApplicationForm).
  const submitLoanApplication = useCallback(async ({ customer, branchId, officerId, productId, principal, termDays, interestValue, documents }) => {
    const cust = await api.createCustomer({ ...customer, branchId });
    const loan = await api.createLoan({ customerId: cust.id, officerId, productId, principal, termDays, interestValue, branchId });
    for (const doc of documents || []) {
      if (doc.file) await api.uploadLoanDocument(loan.id, doc.file, doc.type);
    }
    await Promise.all([refreshCustomers(), refreshLoans()]);
    return { customer: cust, loan };
  }, [refreshCustomers, refreshLoans]);

  const approveLoan = useCallback(async (id) => { const l = await api.approveLoan(id); await refreshLoans(); return l; }, [refreshLoans]);
  const rejectLoan = useCallback(async (id, reason) => { const l = await api.rejectLoan(id, reason); await refreshLoans(); return l; }, [refreshLoans]);
  const disburseLoan = useCallback(async (id) => { const l = await api.disburseLoan(id); await Promise.all([refreshLoans(), refreshBalances()]); return l; }, [refreshLoans, refreshBalances]);

  const depositCash = useCallback(async (data) => { const m = await api.depositCash(data); await refreshBalances(); return m; }, [refreshBalances]);
  const issueFloat = useCallback(async (data) => { const m = await api.issueFloat(data); await refreshBalances(); return m; }, [refreshBalances]);

  const value = {
    branches, users, customers, loans, loanProducts, recentPayments, officerBalances, myBalance, dashboardSummary, loading,
    refreshAll, refreshCustomers, refreshLoans,
    addPayment, createBranch, createUser, createLoanProduct, updateBranch, submitLoanApplication,
    approveLoan, rejectLoan, disburseLoan, depositCash, issueFloat,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
