const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/branches
router.get("/", async (req, res) => {
  const branches = await prisma.branch.findMany({
    where: { tenantId: req.user.tenantId },
    include: { loanOfficer: { select: { id: true, name: true, phone: true } }, _count: { select: { customers: true, loans: true } } },
    orderBy: { name: "asc" },
  });
  res.json(branches);
});

// POST /api/v1/branches  { name, address, loanOfficerId? }
// Admin only. One branch = one route = one loan officer: if loanOfficerId
// is supplied it must (a) belong to a loan_officer in this tenant and
// (b) not already be the route owner of another branch.
router.post("/", requireRole("admin"), async (req, res) => {
  const { name, address, loanOfficerId } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  if (loanOfficerId) {
    const err = await validateRouteOfficer(req.user.tenantId, loanOfficerId);
    if (err) return res.status(400).json({ error: err });
  }

  const branch = await prisma.branch.create({ data: { tenantId: req.user.tenantId, name, address, loanOfficerId: loanOfficerId || null } });
  res.status(201).json(branch);
});

// PUT /api/v1/branches/:id  { name?, address?, loanOfficerId? }
router.put("/:id", requireRole("admin"), async (req, res) => {
  const { name, address, loanOfficerId } = req.body;
  const branch = await prisma.branch.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
  if (!branch) return res.status(404).json({ error: "Branch not found" });

  if (loanOfficerId && loanOfficerId !== branch.loanOfficerId) {
    const err = await validateRouteOfficer(req.user.tenantId, loanOfficerId);
    if (err) return res.status(400).json({ error: err });
  }

  const updated = await prisma.branch.update({
    where: { id: branch.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(loanOfficerId !== undefined ? { loanOfficerId: loanOfficerId || null } : {}),
    },
  });
  res.json(updated);
});

async function validateRouteOfficer(tenantId, loanOfficerId) {
  const officer = await prisma.user.findFirst({ where: { id: loanOfficerId, tenantId, role: "loan_officer" } });
  if (!officer) return "loanOfficerId must be an existing loan_officer in this company";
  const existingRoute = await prisma.branch.findUnique({ where: { loanOfficerId } });
  if (existingRoute) return `This officer already owns the route for branch "${existingRoute.name}" — one officer can only run one branch`;
  return null;
}

module.exports = router;
