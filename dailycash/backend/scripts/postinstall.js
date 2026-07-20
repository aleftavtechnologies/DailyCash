// Runs after `npm install`, on every platform (Windows locally, Linux on
// Vercel). Vercel's build cache occasionally restores node_modules/.bin
// binaries without their executable bit set, which makes `prisma
// generate` fail with "Permission denied" — this doesn't happen because
// of anything in the code, it's a caching artifact. Explicitly restoring
// the permission here (a safe no-op on Windows) fixes it regardless of
// whether the cache is used.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const binPath = path.join(__dirname, "..", "node_modules", ".bin", "prisma");
try {
  if (fs.existsSync(binPath)) fs.chmodSync(binPath, 0o755);
} catch (err) {
  // Harmless on Windows, or if the path doesn't exist yet — ignore.
}

execSync("npx prisma generate", { stdio: "inherit" });
