const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, scopeToUser } = require("../middleware/auth");
const realtime = require("../lib/realtime");

const router = express.Router();
router.use(requireAuth);

// Which payment types each role is allowed to record.
// This is the server-side enforcement of the permission matrix in
// the spec doc §2 — "record any payment type" only applies to admin.
const ROLE_PAYMENT_TYPES = {
  admin: ["installment", "bank_transfer", "document_charge", "other_charge", "office_payment"],
  accountant: ["bank_transfer", "other_charge", "office_payment"],
  loan_officer: ["installment", "document_charge"],
  recovery_officer: ["installment"],
};

function computeBalance(loan, payments) {
  const charges = payments
    .filter(p => p.type === "document_charge" || p.type === "other_charge")
    .reduce((s, p) => s + p.amount, 0);
  const paid = payments
    .filter(p => p.type === "installment" || p.type === "bank_transfer")
    .reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, loan.totalRepayable + charges - paid);
  const daysPaid = Math.min(loan.termDays, Math.round(paid / loan.installmentAmount));
  return { charges, paid, outstanding, daysPaid };
}

// GET /api/v1/payments?branchId=&type=&since=&limit=
// Powers the live activity feed, dashboards, and the report builder.
router.get("/", async (req, res) => {
  const where = scopeToUser(req);
  if (req.query.branchId) where.branchId = req.query.branchId;
  if (req.query.type) where.type = req.query.type;
  if (req.query.since) where.createdAt = { gte: new Date(req.query.since) };
  const payments = await prisma.payment.findMany({
    where, orderBy: { createdAt: "desc" }, take: Math.min(Number(req.query.limit) || 50, 500),
    include: {
      recordedBy: { select: { id: true, name: true, role: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  res.json(payments);
});

// POST /api/v1/payments
// { loanId?, customerId?, branchId, type, amount, note?, gpsLat?, gpsLng? }
router.post("/", async (req, res) => {
  const { loanId, customerId, branchId, type, amount, note, gpsLat, gpsLng } = req.body;
  const allowed = ROLE_PAYMENT_TYPES[req.user.role] || [];

  if (!allowed.includes(type)) {
    return res.status(403).json({ error: `${req.user.role} cannot record payment type "${type}"` });
  }
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount must be > 0" });
  if (!branchId) return res.status(400).json({ error: "branchId is required" });

  // Non-admin/accountant officers may only post against their own branch
  if (!["admin", "accountant"].includes(req.user.role) && branchId !== req.user.branchId) {
    return res.status(403).json({ error: "Cannot record a payment outside your branch" });
  }

  const payment = await prisma.payment.create({
    data: {
      tenantId: req.user.tenantId, branchId, loanId: loanId || null, customerId: customerId || null,
      type, amount, note, recordedById: req.user.id, gpsLat, gpsLng,
    },
    include: { recordedBy: { select: { id: true, name: true, role: true } } },
  });

  // Realtime fan-out: tenant-wide room (Admin/Accountant dashboards) +
  // the specific branch room (that branch's officers) on a long-running
  // server; a no-op on serverless, where the frontend polls instead —
  // see src/lib/realtime.js.
  realtime.emit(req, "payment.created", payment, { branchId });

  res.status(201).json(payment);
});

module.exports = { router, computeBalance, ROLE_PAYMENT_TYPES };
