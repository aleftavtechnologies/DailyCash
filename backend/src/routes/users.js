const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/users?role=loan_officer — Admin/Accountant only. Powers the
// Admin "Users" tab and the loan-officer picker in the branch form.
router.get("/", requireRole("admin", "accountant"), async (req, res) => {
  const where = { tenantId: req.user.tenantId };
  if (req.query.role) where.role = req.query.role;
  const users = await prisma.user.findMany({
    where, orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, role: true, branchId: true, active: true, routeBranch: { select: { id: true, name: true } } },
  });
  res.json(users);
});

// POST /api/v1/users — Admin only. Creates a Loan Officer, Accountant,
// Recovery Officer, or another Admin. For a Loan Officer, this just
// creates the account and (optionally) sets their home branch — actually
// making them a branch's *route* officer (Branch.loanOfficerId) is a
// separate step on the Branches tab, since that's a deliberate 1:1
// assignment with its own validation (see routes/branches.js).
router.post("/", requireRole("admin"), async (req, res) => {
  const { name, phone, password, role, branchId } = req.body;
  const validRoles = ["admin", "accountant", "loan_officer", "recovery_officer"];
  if (!name || !phone || !password || !role) {
    return res.status(400).json({ error: "name, phone, password and role are all required" });
  }
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const existing = await prisma.user.findFirst({ where: { tenantId: req.user.tenantId, phone } });
  if (existing) return res.status(409).json({ error: "A user with this phone number already exists" });

  if (branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId: req.user.tenantId } });
    if (!branch) return res.status(400).json({ error: "branchId does not match an existing branch" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { tenantId: req.user.tenantId, name, phone, role, passwordHash, branchId: branchId || null },
    select: { id: true, name: true, phone: true, role: true, branchId: true, active: true },
  });
  res.status(201).json(user);
});

module.exports = router;