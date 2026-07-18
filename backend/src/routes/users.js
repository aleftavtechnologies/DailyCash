const express = require("express");
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

module.exports = router;
