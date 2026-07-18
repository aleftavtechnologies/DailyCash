const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, scopeToUser } = require("../middleware/auth");
const realtime = require("../lib/realtime");

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/customers/:customerId/comments
router.get("/:customerId/comments", async (req, res) => {
  const customer = await prisma.customer.findFirst({ where: scopeToUser(req, { id: req.params.customerId }) });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const comments = await prisma.comment.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, role: true } } },
  });
  res.json(comments);
});

// POST /api/v1/customers/:customerId/comments  { text }
// Every role (admin, accountant, loan_officer, recovery_officer) may post.
router.post("/:customerId/comments", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });

  const customer = await prisma.customer.findFirst({ where: scopeToUser(req, { id: req.params.customerId }) });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const comment = await prisma.comment.create({
    data: { tenantId: req.user.tenantId, customerId: customer.id, userId: req.user.id, text: text.trim() },
    include: { user: { select: { name: true, role: true } } },
  });

  realtime.emit(req, "comment.created", comment, { branchId: customer.branchId });

  res.status(201).json(comment);
});

module.exports = router;
