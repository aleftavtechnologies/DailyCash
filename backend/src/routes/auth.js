const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const router = express.Router();

// POST /api/v1/auth/login  { companyId, phone, password }
router.post("/login", async (req, res) => {
  const { tenantId, phone, password } = req.body;
  if (!tenantId || !phone || !password) {
    return res.status(400).json({ error: "tenantId, phone and password are required" });
  }

  const user = await prisma.user.findFirst({ where: { tenantId, phone, active: true } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const payload = { id: user.id, tenantId: user.tenantId, branchId: user.branchId, role: user.role, name: user.name };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });

  res.json({ token, user: payload });
});

module.exports = router;
