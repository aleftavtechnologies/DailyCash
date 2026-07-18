require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const setupRoutes = require("./routes/setup");
const branchRoutes = require("./routes/branches");
const userRoutes = require("./routes/users");
const customerRoutes = require("./routes/customers");
const loanRoutes = require("./routes/loans");
const loanProductRoutes = require("./routes/loan-products");
const documentRoutes = require("./routes/documents");
const { router: paymentRoutes } = require("./routes/payments");
const { router: cashRoutes } = require("./routes/cash");
const commentRoutes = require("./routes/comments");
const reportRoutes = require("./routes/reports");
const { UPLOAD_DIR, STORAGE_DRIVER } = require("./lib/upload");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// Local disk storage only makes sense with a persistent filesystem
// (Docker/VPS). On serverless (STORAGE_DRIVER=s3) uploaded files live in
// S3/R2 instead and are served from there directly — see lib/upload.js.
if (STORAGE_DRIVER === "local") {
  app.use("/uploads", express.static(UPLOAD_DIR));
}

app.get("/health", (_req, res) => res.json({ ok: true, storageDriver: STORAGE_DRIVER }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/setup", setupRoutes);
app.use("/api/v1/branches", branchRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/customers", customerRoutes);   // includes GET /:id/ledger
app.use("/api/v1/customers", commentRoutes);    // includes /:customerId/comments
app.use("/api/v1/loans", loanRoutes);
app.use("/api/v1/loan-products", loanProductRoutes);
app.use("/api/v1/loans", documentRoutes);       // includes /:id/documents
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/cash", cashRoutes);
app.use("/api/v1/reports", reportRoutes);

// Multer (file upload) errors land here instead of crashing the process
app.use((err, _req, res, next) => {
  if (err && err.message) return res.status(400).json({ error: err.message });
  next(err);
});

module.exports = app;
