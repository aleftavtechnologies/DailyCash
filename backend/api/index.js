// Vercel convention: anything under /api becomes a serverless function.
// Exporting the Express app directly works because Express apps are
// themselves (req, res) handlers — no socket.io here (see src/index.js
// for that, used only by the long-running Docker/VPS deployment) and no
// app.listen() (Vercel manages the actual listening).
module.exports = require("../src/app");
