const multer = require("multer");
const path = require("path");
const fs = require("fs");

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || "local"; // "local" | "s3" | "vercel-blob"
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

let upload;         // the multer instance routes call with .single("file")
let saveToS3 = null;
let saveToVercelBlob = null;

if (STORAGE_DRIVER === "vercel-blob") {
  // Simplest option if you're already deploying to Vercel: no separate
  // storage account needed. Enable it from your Vercel project's
  // Storage tab ("Blob") — it injects BLOB_READ_WRITE_TOKEN
  // automatically, nothing else to configure.
  const { put } = require("@vercel/blob");

  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(ALLOWED_MIME.includes(file.mimetype) ? null : new Error("Unsupported file type"), true),
  });

  saveToVercelBlob = async (file, loanId) => {
    const ext = path.extname(file.originalname);
    const key = `loan-documents/${loanId}/${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const blob = await put(key, file.buffer, { access: "public", contentType: file.mimetype });
    return blob.url;
  };
} else if (STORAGE_DRIVER === "s3") {
  // Serverless (Vercel/Lambda) has no persistent filesystem — files are
  // held in memory just long enough to stream to S3-compatible storage
  // (works as-is with AWS S3, Cloudflare R2, or Backblaze B2; only the
  // endpoint/credentials differ — see backend/.env.example).
  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined, // required for R2/B2, omit for real AWS S3
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  });

  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(ALLOWED_MIME.includes(file.mimetype) ? null : new Error("Unsupported file type"), true),
  });

  saveToS3 = async (file, loanId) => {
    const ext = path.extname(file.originalname);
    const key = `loan-documents/${loanId}/${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype,
    }));
    // Public URL shape depends on the provider — R2 public buckets and
    // AWS S3 both support a plain https URL once the bucket/object is
    // public, or front it with a CDN. S3_PUBLIC_URL_BASE lets you point
    // this at whichever you're using without changing code.
    const base = process.env.S3_PUBLIC_URL_BASE || `https://${process.env.S3_BUCKET}.s3.amazonaws.com`;
    return `${base}/${key}`;
  };
} else {
  // Local disk storage (Docker/VPS) — served statically from /uploads,
  // see app.js. Fine as long as the volume persists across deploys.
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${req.params.id || "doc"}-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`),
  });
  upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(ALLOWED_MIME.includes(file.mimetype) ? null : new Error("Unsupported file type"), true),
  });
}

/**
 * Resolves the URL to store on the LoanDocument row for an uploaded file.
 * Local driver: multer already wrote it to disk — just build the path.
 * S3 driver: actually uploads the in-memory buffer, then returns the URL.
 */
async function resolveUploadedFileUrl(req) {
  if (STORAGE_DRIVER === "vercel-blob") {
    return saveToVercelBlob(req.file, req.params.id || "misc");
  }
  if (STORAGE_DRIVER === "s3") {
    return saveToS3(req.file, req.params.id || "misc");
  }
  return `/uploads/${req.file.filename}`;
}

module.exports = { upload, UPLOAD_DIR, STORAGE_DRIVER, resolveUploadedFileUrl };
