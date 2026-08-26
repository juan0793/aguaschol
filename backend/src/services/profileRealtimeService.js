import { WebSocketServer } from "ws";
import { getSessionUser } from "./authService.js";

let websocketServer = null;
const profileClients = new Set();

const sendEvent = (socket, event) => {
  try {
    socket.send(JSON.stringify(event));
  } catch (error) {
    console.error("Error enviando evento WebSocket:", error.message);
  }
};

const broadcastEvent = (event, filterFn = () => true) => {
  profileClients.forEach((client) => {
    if (filterFn(client)) {
      sendEvent(client.socket, event);
    }
  });
};

const getUniqueOnlineUsers = () => {
  const usersById = new Map();
  profileClients.forEach((client) => {
    usersById.set(client.userId, {
      id: client.userId,
      name: client.user.full_name,
      full_name: client.user.full_name,
      role: client.user.role
    });
  });
  return Array.from(usersById.values());
};

export const initializeProfileRealtime = ({ server }) => {
  websocketServer = new WebSocketServer({ noServer: true });

  websocketServer.on("connection", async (socket, request) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const token = url.searchParams.get("token") ?? "";
      const user = await getSessionUser(token);

      if (!user) {
        socket.close(1008, "No autorizado");
        return;
      }

      const client = { socket, user, userId: user.id };
      profileClients.add(client);

      // Notificar conexión
      sendEvent(socket, {
        type: "profile.connected",
        user: {
          id: user.id,
          role: user.role,
          full_name: user.full_name
        },
        online_users: getUniqueOnlineUsers()
      });

      // Notificar a otros usuarios que este usuario está online
      broadcastEvent(
        {
          type: "profile.user_online",
          user: {
            id: user.id,
            full_name: user.full_name,
            role: user.role
          }
        },
        (c) => c.userId !== user.id
      );

      socket.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());

          if (data.type === "profile.message_sent") {
            broadcastEvent(
              {
                type: "profile.message_received",
                message: data.message
              },
              (c) =>
                c.userId === data.message.sender_user_id ||
                c.userId === data.message.recipient_user_id
            );
          } else if (data.type === "profile.typing") {
            broadcastEvent(
              {
                type: "profile.user_typing",
                typingUserId: user.id,
                typingUserName: user.full_name,
                channel: data.channel || "general"
              },
              (c) => c.userId !== user.id && (!data.recipientUserId || c.userId === data.recipientUserId)
            );
          } else if (data.type === "profile.stop_typing") {
            broadcastEvent(
              {
                type: "profile.user_stop_typing",
                typingUserId: user.id,
                channel: data.channel || "general"
              },
              (c) => c.userId !== user.id && (!data.recipientUserId || c.userId === data.recipientUserId)
            );
          }
        } catch (error) {
          console.error("Error procesando mensaje WebSocket:", error.message);
        }
      });

      socket.on("close", () => {
        profileClients.delete(client);
        // Notificar desconexión
        broadcastEvent(
          {
            type: "profile.user_offline",
            userId: user.id
          },
          (c) => c.userId !== user.id
        );
      });

      socket.on("error", (error) => {
        console.error("Error WebSocket:", error.message);
      });
    } catch (error) {
      console.error("Error en conexión WebSocket:", error.message);
      socket.close(1011, "Error interno");
    }
  });

  return websocketServer;
};

export const emitProfileMessage = (message) => {
  if (!websocketServer) return;

  const event = {
    type: message?.deleted_id ? "profile.message_deleted" : "profile.message_received",
    message
  };

  if (message?.is_general || message?.deleted_id) {
    broadcastEvent(event);
    return;
  }

  const senderId = Number(message?.sender_user_id ?? 0);
  const recipientId = Number(message?.recipient_user_id ?? 0);
  broadcastEvent(event, (client) => client.userId === senderId || client.userId === recipientId);
};

export const getProfileOnlineUsers = () => {
  return getUniqueOnlineUsers();
};
