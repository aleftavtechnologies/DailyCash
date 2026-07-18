const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/loan-products
router.get("/", async (req, res) => {
  const products = await prisma.loanProduct.findMany({ where: { tenantId: req.user.tenantId, active: true }, orderBy: { name: "asc" } });
  res.json(products);
});

// POST /api/v1/loan-products — Admin only
router.post("/", requireRole("admin"), async (req, res) => {
  const { name, termDays, interestType, interestValue, skipSundays } = req.body;
  if (!name || !termDays || interestValue === undefined) return res.status(400).json({ error: "name, termDays and interestValue are required" });
  const product = await prisma.loanProduct.create({
    data: { tenantId: req.user.tenantId, name, termDays, interestType: interestType || "flat_percent", interestValue, skipSundays: !!skipSundays },
  });
  res.status(201).json(product);
});

module.exports = router;
