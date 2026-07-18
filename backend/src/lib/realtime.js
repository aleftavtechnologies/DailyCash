// Two deployment targets need two different realtime strategies:
//
// - Long-running server (Docker/VPS): Socket.io holds persistent
//   connections and pushes events instantly — see attach() below.
// - Serverless (Vercel/Lambda): functions are stateless and short-lived,
//   so there's nothing to hold a WebSocket open. Every route that would
//   emit an event just no-ops here instead, and the frontend switches to
//   polling (VITE_REALTIME_MODE=poll) to get the same effect at a small
//   delay instead of instantly. See frontend/src/contexts/DataContext.jsx.
//
// Every route calls emit(req, event, payload) rather than touching
// Socket.io directly, so route code doesn't need to know which mode it's
// running in.

let ioInstance = null;

function attach(io) {
  ioInstance = io;
}

function emit(req, event, payload, { branchId } = {}) {
  if (!ioInstance) return; // serverless / realtime disabled — no-op by design
  const tenantId = req.user?.tenantId;
  if (tenantId) ioInstance.to(`tenant:${tenantId}`).emit(event, payload);
  if (branchId) ioInstance.to(`branch:${branchId}`).emit(event, payload);
}

module.exports = { attach, emit };
