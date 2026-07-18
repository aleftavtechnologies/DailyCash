const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, scopeToUser } = require("../middleware/auth");
const { computeBalance } = require("./payments");

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/reports/dashboard-summary
// Computed server-side against the full dataset — this is what the
// Overview dashboard's KPIs and charts read from, rather than
// aggregating a capped "recent payments" feed client-side (which would
// silently drift wrong once there's more activity than the cache window).
router.get("/dashboard-summary", async (req, res) => {
  const scoped = scopeToUser(req);
  const disbursedStatuses = ["active", "overdue", "completed"];

  const [loans, last14Payments] = await Promise.all([
    prisma.loan.findMany({ where: scoped, include: { payments: { select: { type: true, amount: true } } } }),
    prisma.payment.findMany({
      where: { ...scoped, type: { in: ["installment", "bank_transfer"] }, createdAt: { gte: new Date(Date.now() - 14 * 86400000) } },
      select: { amount: true, createdAt: true },
    }),
  ]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const collectedToday = last14Payments.filter(p => p.createdAt.toISOString().slice(0,10) === todayStr).reduce((s,p)=>s+p.amount,0);

  const last14 = Array.from({ length: 14 }).map((_, idx) => {
    const d = new Date(Date.now() - (13 - idx) * 86400000);
    const ds = d.toISOString().slice(0, 10);
    const amount = last14Payments.filter(p => p.createdAt.toISOString().slice(0,10) === ds).reduce((s,p)=>s+p.amount,0);
    return { day: d.toLocaleDateString("en-LK", { day: "2-digit", month: "short" }), amount };
  });

  let overdueCount = 0, activeCount = 0, completedCount = 0, totalOutstanding = 0;
  for (const loan of loans) {
    const balance = computeBalance(loan, loan.payments);
    let missedDays = 0;
    if (["active", "overdue"].includes(loan.status) && loan.disbursedAt) {
      const daysSinceStart = Math.floor((Date.now() - new Date(loan.disbursedAt).getTime()) / 86400000);
      missedDays = Math.max(0, Math.min(loan.termDays, Math.max(0, daysSinceStart)) - balance.daysPaid);
    }
    const isOverdue = loan.status === "active" && missedDays >= 3;
    if (isOverdue) overdueCount++; else if (loan.status === "active") activeCount++;
    else if (loan.status === "completed") completedCount++;
    if (disbursedStatuses.includes(loan.status) && loan.status !== "completed") totalOutstanding += balance.outstanding;
  }

  const branches = await prisma.branch.findMany({ where: { tenantId: req.user.tenantId } });
  const branchPerf = await Promise.all(branches.map(async b => {
    const branchLoans = await prisma.loan.findMany({ where: { branchId: b.id, status: { in: disbursedStatuses } }, include: { payments: { select: { type: true, amount: true } } } });
    const disbursed = branchLoans.reduce((s,l)=>s+l.principal,0);
    const outstanding = branchLoans.filter(l=>l.status!=="completed").reduce((s,l)=>s+computeBalance(l,l.payments).outstanding,0);
    return { name: b.name, disbursed, outstanding };
  }));

  res.json({ collectedToday, last14, overdueCount, activeCount, completedCount, totalOutstanding, branchPerf });
});

// POST /api/v1/reports/generate  { type, branchId?, from?, to? }
// Mirrors the report types in the prototype's report builder and the
// spec doc §11. Extend this switch as new report types are needed —
// the frontend report builder is generic and just renders whatever
// columns come back.
router.post("/generate", async (req, res) => {
  const { type, branchId, from, to } = req.body;
  const where = scopeToUser(req, branchId ? { branchId } : {});
  const dateRange = from && to ? { gte: new Date(from), lte: new Date(to) } : undefined;

  let rows = [];
  switch (type) {
    case "daily_collection": {
      const payments = await prisma.payment.findMany({
        where: { ...where, type: { in: ["installment", "bank_transfer"] }, ...(dateRange ? { createdAt: dateRange } : {}) },
        include: { customer: { select: { name: true } }, recordedBy: { select: { name: true } } },
        take: 500, orderBy: { createdAt: "desc" },
      });
      rows = payments.map(p => ({ date: p.createdAt, customer: p.customer?.name, type: p.type, amount: p.amount, recordedBy: p.recordedBy.name }));
      break;
    }
    case "overdue_arrears": {
      const loans = await prisma.loan.findMany({ where: { ...where, status: "active" }, include: { customer: { select: { name: true } }, payments: { select: { type: true, amount: true } } } });
      rows = loans.map(l => {
        const balance = computeBalance(l, l.payments);
        const daysSinceStart = l.disbursedAt ? Math.floor((Date.now() - new Date(l.disbursedAt).getTime()) / 86400000) : 0;
        const expected = Math.min(l.termDays, Math.max(0, daysSinceStart));
        const missedDays = Math.max(0, expected - balance.daysPaid);
        return { loanId: l.id, customer: l.customer.name, missedDays, arrears: missedDays * l.installmentAmount };
      }).filter(r => r.missedDays >= 3);
      break;
    }
    case "outstanding_portfolio": {
      const loans = await prisma.loan.findMany({ where: { ...where, status: { not: "completed" } }, include: { payments: true, customer: { select: { name: true } } } });
      rows = loans.map(l => ({ loanId: l.id, customer: l.customer.name, ...computeBalance(l, l.payments) }));
      break;
    }
    case "officer_performance": {
      const officers = await prisma.user.findMany({ where: { tenantId: req.user.tenantId, role: { in: ["loan_officer", "recovery_officer"] } } });
      rows = await Promise.all(officers.map(async o => {
        const loanCount = await prisma.loan.count({ where: { officerId: o.id } });
        const collected = await prisma.payment.aggregate({ where: { recordedById: o.id, type: { in: ["installment", "bank_transfer"] } }, _sum: { amount: true } });
        return { officer: o.name, role: o.role, loansHandled: loanCount, totalCollected: collected._sum.amount || 0 };
      }));
      break;
    }
    case "payment_type_breakdown": {
      const types = ["installment", "bank_transfer", "document_charge", "other_charge", "office_payment"];
      rows = await Promise.all(types.map(async t => {
        const agg = await prisma.payment.aggregate({ where: { ...where, type: t, ...(dateRange ? { createdAt: dateRange } : {}) }, _sum: { amount: true }, _count: true });
        return { type: t, count: agg._count, total: agg._sum.amount || 0 };
      }));
      break;
    }
    case "branch_comparison": {
      const branches = await prisma.branch.findMany({ where: { tenantId: req.user.tenantId } });
      rows = await Promise.all(branches.map(async b => {
        const branchLoans = await prisma.loan.findMany({ where: { branchId: b.id }, include: { payments: true } });
        const disbursed = branchLoans.filter(l=>["active","overdue","completed"].includes(l.status)).reduce((s,l)=>s+l.principal,0);
        const outstanding = branchLoans.filter(l=>l.status!=="completed").reduce((s,l)=>s+computeBalance(l,l.payments).outstanding,0);
        return { branch: b.name, loans: branchLoans.length, disbursed, outstanding };
      }));
      break;
    }
    default:
      return res.status(400).json({ error: `Unknown report type: ${type}` });
  }
  res.json({ type, count: rows.length, rows });
});

module.exports = router;
