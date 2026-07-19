// Thin fetch wrapper around the DailyCash backend (see /backend).
// Always network-first — this app deliberately does NOT cache API
// responses in the service worker (see vite.config.js), since serving
// stale loan balances or cash positions would be actively dangerous.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let authToken = null;
export function setAuthToken(token) {
  authToken = token;
  if (token) localStorage.setItem("dailycash_token", token);
  else localStorage.removeItem("dailycash_token");
}
export function getStoredToken() {
  return localStorage.getItem("dailycash_token");
}

async function request(path, { method = "GET", body, isMultipart = false, params } = {}) {
  const url = new URL(BASE_URL + path);
  if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && url.searchParams.set(k, v));

  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  let payload = body;
  if (body && !isMultipart) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers, body: payload });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  login: (tenantId, phone, password) => request("/api/v1/auth/login", { method: "POST", body: { tenantId, phone, password } }),

  // Branches
  listBranches: () => request("/api/v1/branches"),
  createBranch: (data) => request("/api/v1/branches", { method: "POST", body: data }),
  updateBranch: (id, data) => request(`/api/v1/branches/${id}`, { method: "PUT", body: data }),

  // Users
  listUsers: (role) => request("/api/v1/users", { params: { role } }),
  createUser: (data) => request("/api/v1/users", { method: "POST", body: data }),

  // Customers
  listCustomers: (search) => request("/api/v1/customers", { params: { search } }),
  createCustomer: (data) => request("/api/v1/customers", { method: "POST", body: data }),
  getCustomerLedger: (id) => request(`/api/v1/customers/${id}/ledger`),
  listComments: (customerId) => request(`/api/v1/customers/${customerId}/comments`),
  addComment: (customerId, text) => request(`/api/v1/customers/${customerId}/comments`, { method: "POST", body: { text } }),

  // Loan products
  listLoanProducts: () => request("/api/v1/loan-products"),
  createLoanProduct: (data) => request("/api/v1/loan-products", { method: "POST", body: data }),

  // Loans
  listLoans: (status) => request("/api/v1/loans", { params: { status } }),
  getLoan: (id) => request(`/api/v1/loans/${id}`),
  createLoan: (data) => request("/api/v1/loans", { method: "POST", body: data }),
  approveLoan: (id) => request(`/api/v1/loans/${id}/approve`, { method: "PUT" }),
  rejectLoan: (id, reason) => request(`/api/v1/loans/${id}/reject`, { method: "PUT", body: { reason } }),
  disburseLoan: (id) => request(`/api/v1/loans/${id}/disburse`, { method: "PUT" }),
  uploadLoanDocument: (loanId, file, type) => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    return request(`/api/v1/loans/${loanId}/documents`, { method: "POST", body: form, isMultipart: true });
  },
  listLoanDocuments: (loanId) => request(`/api/v1/loans/${loanId}/documents`),

  // Payments
  listPayments: (params) => request("/api/v1/payments", { params }),
  addPayment: (data) => request("/api/v1/payments", { method: "POST", body: data }),

  // Cash float
  getOfficerBalance: (officerId) => request(`/api/v1/cash/balance/${officerId}`),
  listOfficerBalances: () => request("/api/v1/cash/balances"),
  depositCash: (data) => request("/api/v1/cash/deposit", { method: "POST", body: data }),
  issueFloat: (data) => request("/api/v1/cash/float", { method: "POST", body: data }),

  // Reports
  generateReport: (data) => request("/api/v1/reports/generate", { method: "POST", body: data }),
  getDashboardSummary: () => request("/api/v1/reports/dashboard-summary"),
};

export function fileUrl(path) {
  if (!path) return null;
  return path.startsWith("http") ? path : BASE_URL + path;
}
