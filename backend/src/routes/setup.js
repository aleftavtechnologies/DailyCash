const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

const router = express.Router();

// POST /api/v1/setup/init-tenant
// { companyName, adminName, adminPhone, adminPassword }
//
// Deliberately UNAUTHENTICATED — this exists so the very first company +
// Admin account can be created without SSH/CLI access to the database
// (useful on serverless deploys where there's no easy local `node -e`
// against the production DB). It self-disables the moment any tenant
// exists: after your first company is created, this always returns 403,
// so it can't be used to spray fake companies into a live database.
router.post("/init-tenant", async (req, res) => {
  const existing = await prisma.tenant.count();
  if (existing > 0) {
    return res.status(403).json({ error: "Setup already completed — a company already exists. Use the normal login/signup flow from here." });
  }

  const { companyName, adminName, adminPhone, adminPassword } = req.body;
  if (!companyName || !adminName || !adminPhone || !adminPassword) {
    return res.status(400).json({ error: "companyName, adminName, adminPhone and adminPassword are all required" });
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ error: "adminPassword must be at least 8 characters" });
  }

  const tenant = await prisma.tenant.create({ data: { companyName } });
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.create({
    data: { tenantId: tenant.id, name: adminName, phone: adminPhone, role: "admin", passwordHash },
  });

  res.status(201).json({
    tenantId: tenant.id,
    adminPhone: admin.phone,
    message: "Save the tenantId above — you'll need it on the login screen along with the phone and password you chose.",
  });
});

module.exports = router;
