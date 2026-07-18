// Entry point for the Docker/VPS deployment (docker-compose.yml, Dockerfile
// CMD). For the serverless deployment (Vercel), see api/index.js at the
// repo root instead — that one skips Socket.io entirely since serverless
// functions can't hold a persistent connection open. See src/lib/realtime.js.
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const app = require("./app");
const realtime = require("./lib/realtime");

const server = http.createServer(app);

// Every authenticated client joins tenant:{tenantId}. Admin/Accountant
// additionally get every branch room for their tenant (they see
// everything); Loan/Recovery officers join only their own branch room.
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || "*" } });
realtime.attach(io);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = payload;
    next();
  } catch (err) {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const { tenantId, branchId } = socket.user;
  socket.join(`tenant:${tenantId}`);
  if (branchId) socket.join(`branch:${branchId}`);
  socket.on("disconnect", () => {});
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`DailyCash API listening on :${PORT} (realtime: socket.io)`));
