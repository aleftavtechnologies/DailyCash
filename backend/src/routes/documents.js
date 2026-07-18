const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, scopeToUser } = require("../middleware/auth");
const { upload, resolveUploadedFileUrl } = require("../lib/upload");

const router = express.Router();
router.use(requireAuth);

// POST /api/v1/loans/:id/documents  (multipart/form-data, field "file", plus "type")
// Loan officer uploads NIC photo, business photo, signature, guarantor ID
// etc. while filling out the application. Multiple calls = multiple docs.
router.post("/:id/documents", upload.single("file"), async (req, res) => {
  const loan = await prisma.loan.findFirst({ where: scopeToUser(req, { id: req.params.id }) });
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  if (!req.file) return res.status(400).json({ error: "file is required (multipart field name: file)" });

  const fileUrl = await resolveUploadedFileUrl(req);
  const doc = await prisma.loanDocument.create({
    data: {
      loanId: loan.id,
      type: req.body.type || "other",
      fileUrl,
      originalName: req.file.originalname,
      uploadedById: req.user.id,
    },
  });
  res.status(201).json(doc);
});

// GET /api/v1/loans/:id/documents
router.get("/:id/documents", async (req, res) => {
  const loan = await prisma.loan.findFirst({ where: scopeToUser(req, { id: req.params.id }) });
  if (!loan) return res.status(404).json({ error: "Loan not found" });
  const docs = await prisma.loanDocument.findMany({ where: { loanId: loan.id }, orderBy: { createdAt: "desc" } });
  res.json(docs);
});

module.exports = router;
