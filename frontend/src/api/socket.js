import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let socket = null;

// Connects once per login. The server puts this connection into
// tenant:{tenantId} and branch:{branchId} rooms based on the JWT — see
// backend/src/index.js — so events for the caller's scope arrive
// automatically without any client-side subscription management.
export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io(BASE_URL, { auth: { token }, transports: ["websocket", "polling"] });
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
