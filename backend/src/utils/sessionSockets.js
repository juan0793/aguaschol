import { hashToken } from "./password.js";
const sessions = new Map();
export function registerSessionSocket(token, socket) {
  const key = hashToken(token);
  if (!sessions.has(key)) sessions.set(key, new Set());
  sessions.get(key).add(socket);
  socket.once("close", () => {
    const sockets = sessions.get(key);
    sockets?.delete(socket);
    if (!sockets?.size) sessions.delete(key);
  });
}
export function closeSessionSockets(token) {
  for (const socket of sessions.get(hashToken(token)) || []) {
    socket.authRevoked = true;
    socket.close(1008, "La sesión cambió de modo");
  }
}
