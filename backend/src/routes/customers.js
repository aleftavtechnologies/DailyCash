const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, scopeToUser } = require("../middleware/auth");
const { computeBalance } = require("./payments");

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/customers?search=
router.get("/", async (req, res) => {
  const where = scopeToUser(req);
  if (req.query.search) {
    where.name = { contains: req.query.search, mode: "insensitive" };
  }
  const customers = await prisma.customer.findMany({ where, orderBy: { name: "asc" }, take: 100 });
  res.json(customers);
});

// POST /api/v1/customers
router.post("/", async (req, res) => {
  const { name, nic, phone, address, businessType, branchId } = req.body;
  const customer = await prisma.customer.create({
    data: { tenantId: req.user.tenantId, branchId: branchId || req.user.branchId, name, nic, phone, address, businessType },
  });
  res.status(201).json(customer);
});

// GET /api/v1/customers/:id/ledger
// The Customer 360 view: live balance, arrears, next due date, full
// payment ledger and comment thread — the feature every role shares.
router.get("/:id/ledger", async (req, res) => {
  const customer = await prisma.customer.findFirst({ where: scopeToUser(req, { id: req.params.id }) });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const loan = await prisma.loan.findFirst({
    where: { customerId: customer.id, tenantId: req.user.tenantId },
    orderBy: { createdAt: "desc" },
  });
  if (!loan) return res.json({ customer, loan: null, balance: null, payments: [], comments: [] });

  const payments = await prisma.payment.findMany({
    where: { loanId: loan.id },
    orderBy: { createdAt: "desc" },
    include: { recordedBy: { select: { name: true, role: true } } },
  });
  const nextSchedule = await prisma.installmentSchedule.findFirst({
    where: { loanId: loan.id, status: "pending" },
    orderBy: { dueDate: "asc" },
  });
  const comments = await prisma.comment.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, role: true } } },
  });

  const balance = computeBalance(loan, payments);
  let missedDays = 0;
  if (["active", "overdue"].includes(loan.status) && loan.disbursedAt) {
    const daysSinceStart = Math.floor((Date.now() - new Date(loan.disbursedAt).getTime()) / 86400000);
    const expected = Math.min(loan.termDays, Math.max(0, daysSinceStart));
    missedDays = Math.max(0, expected - balance.daysPaid);
  }
  const displayStatus = loan.status === "active" && missedDays >= 3 ? "overdue" : loan.status;

  res.json({
    customer, loan: { ...loan, missedDays, displayStatus },
    balance, nextDueDate: nextSchedule?.dueDate || null,
    payments, comments,
  });
});

module.exports = router;
