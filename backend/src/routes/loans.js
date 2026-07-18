const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole, scopeToUser } = require("../middleware/auth");
const { getOfficerCashBalance } = require("./cash");
const { computeBalance } = require("./payments");
const realtime = require("../lib/realtime");

const router = express.Router();
router.use(requireAuth);

// A loan is shown as "overdue" once it's 3+ installments behind where it
// should be by today, given its disbursement date. This is computed here
// (not stored) so it's always correct without a cron job drifting out of
// sync — see spec doc for the configurable-threshold version of this.
function withProgress(loan) {
  const balance = computeBalance(loan, loan.payments || []);
  let missedDays = 0;
  if (["active", "overdue"].includes(loan.status) && loan.disbursedAt) {
    const daysSinceStart = Math.floor((Date.now() - new Date(loan.disbursedAt).getTime()) / 86400000);
    const expected = Math.min(loan.termDays, Math.max(0, daysSinceStart));
    missedDays = Math.max(0, expected - balance.daysPaid);
  }
  const displayStatus = loan.status === "active" && missedDays >= 3 ? "overdue" : loan.status;
  const { payments, ...rest } = loan;
  return { ...rest, balance, missedDays, displayStatus };
}

// GET /api/v1/loans?status=pending
router.get("/", async (req, res) => {
  const where = scopeToUser(req);
  if (req.query.status) where.status = req.query.status;
  const loans = await prisma.loan.findMany({
    where, take: 200, orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, phone: true } },
      officer: { select: { name: true } },
      documents: { select: { id: true, type: true, fileUrl: true } },
      payments: { select: { type: true, amount: true } },
    },
  });
  res.json(loans.map(withProgress));
});

// GET /api/v1/loans/:id
router.get("/:id", async (req, res) => {
  const loan = await prisma.loan.findFirst({
    where: scopeToUser(req, { id: req.params.id }),
    include: { customer: true, officer: { select: { name: true } }, documents: true, schedule: true },
  });
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  res.json(loan);
});

// POST /api/v1/loans — loan officer fills out the full application.
// Starts life as "pending" and is routed to Admin for approval (see
// PUT /:id/approve and /:id/reject below). Document uploads happen via
// POST /:id/documents after the loan row exists.
router.post("/", requireRole("admin", "loan_officer"), async (req, res) => {
  const { customerId, productId, principal, termDays, interestValue, branchId } = req.body;
  const product = await prisma.loanProduct.findFirst({ where: { id: productId, tenantId: req.user.tenantId } });
  if (!product) return res.status(404).json({ error: "Loan product not found" });

  // A loan officer can only ever submit under their own id (prevents
  // spoofing another officer's applications); Admin must specify which
  // route officer this is for.
  const officerId = req.user.role === "loan_officer" ? req.user.id : req.body.officerId;
  if (!officerId) return res.status(400).json({ error: "officerId is required" });

  const days = termDays || product.termDays;
  const rate = interestValue ?? product.interestValue;
  const totalRepayable = product.interestType === "fixed_total" ? rate : Math.round(principal * (1 + rate / 100));
  const installmentAmount = Math.round(totalRepayable / days);

  const loan = await prisma.loan.create({
    data: {
      tenantId: req.user.tenantId, branchId: branchId || req.user.branchId, customerId, productId,
      officerId, submittedById: req.user.id,
      principal, termDays: days, interestValue: rate,
      totalRepayable, installmentAmount, startDate: new Date(), status: "pending",
    },
  });

  realtime.emit(req, "loan.submitted", loan, { branchId: loan.branchId });
  res.status(201).json(loan);
});

// PUT /api/v1/loans/:id/approve — Admin reviews the application + its
// uploaded documents and approves it. Does NOT hand out cash yet — the
// loan officer still has to actively disburse (next step) from their
// own cash float, which is a deliberate second checkpoint.
router.put("/:id/approve", requireRole("admin"), async (req, res) => {
  const loan = await prisma.loan.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  if (loan.status !== "pending") return res.status(400).json({ error: `Cannot approve a loan in status "${loan.status}"` });

  const updated = await prisma.loan.update({
    where: { id: loan.id },
    data: { status: "approved", approvedById: req.user.id, approvedAt: new Date() },
  });
  realtime.emit(req, "loan.approved", updated, { branchId: loan.branchId });
  res.json(updated);
});

// PUT /api/v1/loans/:id/reject  { reason }
router.put("/:id/reject", requireRole("admin"), async (req, res) => {
  const loan = await prisma.loan.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  if (loan.status !== "pending") return res.status(400).json({ error: `Cannot reject a loan in status "${loan.status}"` });

  const updated = await prisma.loan.update({
    where: { id: loan.id },
    data: { status: "rejected", approvedById: req.user.id, approvedAt: new Date(), rejectedReason: req.body.reason || null },
  });
  realtime.emit(req, "loan.rejected", updated, { branchId: loan.branchId });
  res.json(updated);
});

// PUT /api/v1/loans/:id/disburse — the loan officer hands over cash from
// their own float. Blocked if the officer doesn't have enough cash on
// hand (see getOfficerCashBalance in cash.js) — this is what keeps the
// daily cash balance honest instead of letting it go negative silently.
router.put("/:id/disburse", requireRole("admin", "loan_officer"), async (req, res) => {
  const loan = await prisma.loan.findUnique({ where: { id: req.params.id }, include: { product: true } });
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  if (loan.status !== "approved") return res.status(400).json({ error: `Loan must be "approved" before disbursement (currently "${loan.status}")` });
  if (req.user.role === "loan_officer" && loan.officerId !== req.user.id) {
    return res.status(403).json({ error: "Only the assigned loan officer can disburse this loan" });
  }

  const balance = await getOfficerCashBalance(loan.officerId);
  if (balance.current < loan.principal) {
    return res.status(400).json({ error: `Insufficient cash in hand: Rs. ${balance.current} available, Rs. ${loan.principal} required. Request a float top-up from Admin.` });
  }

  const rows = [];
  let cursor = new Date(loan.startDate);
  let seq = 1;
  while (rows.length < loan.termDays) {
    if (!(loan.product.skipSundays && cursor.getDay() === 0)) {
      rows.push({ loanId: loan.id, sequenceNo: seq++, dueDate: new Date(cursor), amountDue: loan.installmentAmount });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const [updated] = await prisma.$transaction([
    prisma.loan.update({ where: { id: loan.id }, data: { status: "active", disbursedAt: new Date() } }),
    prisma.installmentSchedule.createMany({ data: rows }),
    prisma.cashMovement.create({
      data: {
        tenantId: loan.tenantId, branchId: loan.branchId, officerId: loan.officerId, type: "disbursement",
        amount: loan.principal, loanId: loan.id, recordedById: req.user.id, note: `Disbursed loan ${loan.id}`,
      },
    }),
  ]);

  realtime.emit(req, "loan.disbursed", updated, { branchId: loan.branchId });
  res.json(updated);
});

module.exports = router;
