const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const realtime = require("../lib/realtime");

const router = express.Router();

// Cash-in-hand collected physically by the officer (installments, document
// charges, other on-the-spot charges). Bank transfers go straight to the
// company account via the Accountant, so they never touch the officer's
// physical float and are excluded here.
const CASH_IN_HAND_PAYMENT_TYPES = ["installment", "document_charge", "other_charge"];

/**
 * Computes an officer's current cash-in-hand balance:
 *   + physical collections they recorded
 *   + float top-ups from Admin
 *   - loans they disbursed
 *   - deposits they made to the company bank account
 * Also returns today's movement and the date of the last deposit, which
 * is what the officer/accountant/admin dashboards render.
 */
async function getOfficerCashBalance(officerId) {
  const officer = await prisma.user.findUnique({ where: { id: officerId } });
  if (!officer) return null;

  const [collected, movements] = await Promise.all([
    prisma.payment.aggregate({
      where: { recordedById: officerId, type: { in: CASH_IN_HAND_PAYMENT_TYPES } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.findMany({ where: { officerId }, orderBy: { createdAt: "desc" } }),
  ]);

  const floatIn = movements.filter(m => m.type === "float_in").reduce((s, m) => s + m.amount, 0);
  const disbursed = movements.filter(m => m.type === "disbursement").reduce((s, m) => s + m.amount, 0);
  const depositedOut = movements.filter(m => m.type === "deposit_out").reduce((s, m) => s + m.amount, 0);
  const adjustments = movements.filter(m => m.type === "adjustment").reduce((s, m) => s + m.amount, 0);

  const collectedTotal = collected._sum.amount || 0;
  const current = collectedTotal + floatIn - disbursed - depositedOut + adjustments;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCollected = await prisma.payment.aggregate({
    where: { recordedById: officerId, type: { in: CASH_IN_HAND_PAYMENT_TYPES }, createdAt: { gte: new Date(todayStr) } },
    _sum: { amount: true },
  });
  const todayDisbursed = movements.filter(m => m.type === "disbursement" && m.createdAt.toISOString().slice(0,10) === todayStr).reduce((s,m)=>s+m.amount,0);
  const lastDeposit = movements.find(m => m.type === "deposit_out");

  return {
    officerId, officerName: officer.name, current,
    breakdown: { collectedTotal, floatIn, disbursed, depositedOut, adjustments },
    today: { collected: todayCollected._sum.amount || 0, disbursed: todayDisbursed },
    lastDepositAt: lastDeposit?.createdAt || null,
  };
}

router.use(requireAuth);

// GET /api/v1/cash/balance/:officerId
// Loan officer can view their own; admin/accountant can view any in tenant.
router.get("/balance/:officerId", async (req, res) => {
  if (req.user.role === "loan_officer" && req.user.id !== req.params.officerId) {
    return res.status(403).json({ error: "Loan officers can only view their own cash balance" });
  }
  const officer = await prisma.user.findFirst({ where: { id: req.params.officerId, tenantId: req.user.tenantId } });
  if (!officer) return res.status(404).json({ error: "Officer not found" });
  res.json(await getOfficerCashBalance(officer.id));
});

// GET /api/v1/cash/balances — admin/accountant: every officer's balance,
// e.g. for the "Loan Officer Cash Positions" table on their dashboards.
router.get("/balances", requireRole("admin", "accountant"), async (req, res) => {
  const officers = await prisma.user.findMany({ where: { tenantId: req.user.tenantId, role: "loan_officer" }, include: { routeBranch: { select: { name: true } } } });
  const balances = await Promise.all(officers.map(o => getOfficerCashBalance(o.id)));
  res.json(balances.map((b, i) => ({ ...b, branch: officers[i].routeBranch?.name || null })));
});

// POST /api/v1/cash/deposit  { amount, note }
// Officer (or accountant on their behalf) records a cash deposit to the
// company bank account — typically month-end, reduces cash-in-hand.
router.post("/deposit", requireRole("loan_officer", "accountant", "admin"), async (req, res) => {
  const { officerId, amount, note } = req.body;
  const targetOfficerId = req.user.role === "loan_officer" ? req.user.id : officerId;
  if (!targetOfficerId) return res.status(400).json({ error: "officerId is required" });
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount must be > 0" });

  const officer = await prisma.user.findFirst({ where: { id: targetOfficerId, tenantId: req.user.tenantId, role: "loan_officer" } });
  if (!officer) return res.status(404).json({ error: "Loan officer not found" });

  const movement = await prisma.cashMovement.create({
    data: { tenantId: req.user.tenantId, branchId: officer.branchId, officerId: officer.id, type: "deposit_out", amount, recordedById: req.user.id, note: note || "Cash deposit to company account" },
  });
  realtime.emit(req, "cash.deposit", movement, { branchId: officer.branchId });
  res.status(201).json(movement);
});

// POST /api/v1/cash/float  { officerId, amount, note } — admin issues a
// starting or top-up cash float so the officer can begin disbursing loans.
router.post("/float", requireRole("admin"), async (req, res) => {
  const { officerId, amount, note } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount must be > 0" });

  const officer = await prisma.user.findFirst({ where: { id: officerId, tenantId: req.user.tenantId, role: "loan_officer" } });
  if (!officer) return res.status(404).json({ error: "Loan officer not found" });

  const movement = await prisma.cashMovement.create({
    data: { tenantId: req.user.tenantId, branchId: officer.branchId, officerId: officer.id, type: "float_in", amount, recordedById: req.user.id, note: note || "Cash float issued" },
  });
  realtime.emit(req, "cash.float", movement, { branchId: officer.branchId });
  res.status(201).json(movement);
});

module.exports = { router, getOfficerCashBalance };
