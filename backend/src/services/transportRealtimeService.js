import { WebSocketServer } from "ws";
import { getSessionUser } from "./authService.js";

let websocketServer = null;
const transportClients = new Set();

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const canReceiveRouteEvent = (client, route) => {
  if (!client?.user) {
    return false;
  }

  if (client.user.role === "admin") {
    return true;
  }

  return Number(route?.assigned_user_id) === Number(client.user.id);
};

const sendEvent = (socket, payload) => {
  if (!socket || socket.readyState !== 1) {
    return;
  }

  socket.send(JSON.stringify(payload));
};

export const broadcastTransportEvent = ({ type, route, position = null }) => {
  transportClients.forEach((client) => {
    if (!canReceiveRouteEvent(client, route)) {
      return;
    }

    sendEvent(client.socket, {
      type,
      route_id: route?.id ?? null,
      assigned_user_id: route?.assigned_user_id ?? null,
      is_off_route: Boolean(route?.is_off_route ?? position?.is_on_route === false),
      position
    });
  });
};

export const initializeTransportRealtime = ({ server }) => {
  websocketServer = new WebSocketServer({ server, path: "/ws/transport" });

  websocketServer.on("connection", async (socket, request) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const token = url.searchParams.get("token") ?? "";
      const user = await getSessionUser(token);

      if (!user || !["admin", "transport"].includes(user.role)) {
        socket.close(1008, "No autorizado");
        return;
      }

      const client = { socket, user };
      transportClients.add(client);
      sendEvent(socket, {
        type: "transport.connected",
        user: {
          id: user.id,
          role: user.role,
          full_name: user.full_name
        }
      });

      socket.on("message", (raw) => {
        const payload = safeJsonParse(String(raw));
        if (!payload || payload.type !== "transport.ping") {
          return;
        }

        sendEvent(socket, {
          type: "transport.pong",
          ts: Date.now()
        });
      });

      socket.on("close", () => {
        transportClients.delete(client);
      });

      socket.on("error", () => {
        transportClients.delete(client);
      });
    } catch {
      socket.close(1011, "Error interno");
    }
  });

  return websocketServer;
};
