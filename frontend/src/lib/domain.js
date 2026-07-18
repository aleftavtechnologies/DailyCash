import {
  LayoutGrid, Wallet, ClipboardList, FileBarChart, Settings, Users,
  AlertTriangle, Banknote, ClipboardCheck, Plus, Receipt, FileText, Landmark,
} from "lucide-react";

export const CURRENCY = (n) => "Rs. " + Number(n || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 });

export const timeAgo = (iso) => {
  if (!iso) return "";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
};

export const ROLE_LABEL = {
  admin: "Administrator", accountant: "Accountant",
  loan_officer: "Loan Officer", recovery_officer: "Recovery Officer",
};

export const ROLE_MENUS = {
  admin: [
    { key: "dashboard", label: "Overview", icon: LayoutGrid },
    { key: "approvals", label: "Approvals", icon: ClipboardCheck },
    { key: "loans", label: "Loans", icon: Wallet },
    { key: "customers", label: "Customers", icon: Users },
    { key: "reports", label: "Reports", icon: FileBarChart },
    { key: "admin", label: "Setup", icon: Settings },
  ],
  accountant: [
    { key: "dashboard", label: "Overview", icon: LayoutGrid },
    { key: "cashbook", label: "Cash Book", icon: Banknote },
    { key: "loans", label: "Loans", icon: Wallet },
    { key: "customers", label: "Customers", icon: Users },
    { key: "reports", label: "Reports", icon: FileBarChart },
  ],
  loan_officer: [
    { key: "dashboard", label: "Overview", icon: LayoutGrid },
    { key: "collections", label: "Today's Route", icon: ClipboardList },
    { key: "loans", label: "New Loan", icon: Plus },
    { key: "customers", label: "Customers", icon: Users },
  ],
  recovery_officer: [
    { key: "dashboard", label: "Overview", icon: LayoutGrid },
    { key: "recovery", label: "Overdue Cases", icon: AlertTriangle },
    { key: "customers", label: "Customers", icon: Users },
  ],
};

export const PAYMENT_TYPE_META = {
  installment: { label: "Installment", icon: Receipt, color: "#0E7C55" },
  document_charge: { label: "Document Charge", icon: FileText, color: "#B87418" },
  bank_transfer: { label: "Bank Transfer", icon: Landmark, color: "#2F6FB0" },
  office_payment: { label: "Office Payment", icon: Banknote, color: "#5B6B65" },
  other_charge: { label: "Other Charge", icon: FileText, color: "#D2543A" },
};

// Mirrors backend src/routes/payments.js ROLE_PAYMENT_TYPES exactly —
// duplicated here only so the UI can show/hide the right form fields;
// the server re-validates on every request regardless.
export const ROLE_PAYMENT_TYPES = {
  admin: ["installment", "bank_transfer", "document_charge", "other_charge"],
  accountant: ["bank_transfer", "other_charge"],
  loan_officer: ["installment", "document_charge"],
  recovery_officer: ["installment"],
};

export const DOCUMENT_TYPES = [
  { key: "nic_photo", label: "NIC Photo" },
  { key: "business_photo", label: "Business Photo" },
  { key: "signature", label: "Signature" },
  { key: "guarantor_nic", label: "Guarantor NIC" },
];

export const LOAN_PRODUCTS_FALLBACK_DAYS = 60;
