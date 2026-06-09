import { WS_URL } from "../config/api.js";

export class ProfileWebSocketManager {
  constructor(token) {
    this.token = token;
    this.socket = null;
    this.connectPromise = null;
    this.listeners = {
      connect: [],
      disconnect: [],
      message_received: [],
      message_deleted: [],
      online_users: [],
      user_online: [],
      user_offline: [],
      user_typing: [],
      user_stop_typing: [],
      error: []
    };
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.shouldReconnect = true;
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.emit("connect");
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.shouldReconnect = true;
    this.connectPromise = new Promise((resolve, reject) => {
      try {
        const fallbackWsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
        const baseWsUrl = (WS_URL || fallbackWsUrl).replace(/\/$/, "");
        const wsUrl = `${baseWsUrl}/ws/profile?token=${encodeURIComponent(this.token)}`;

        this.socket = new WebSocket(wsUrl);

        this.socket.addEventListener("open", () => {
          this.reconnectAttempts = 0;
          this.connectPromise = null;
          this.emit("connect");
          resolve();
        });

        this.socket.addEventListener("message", (event) => {
          try {
            this.handleMessage(JSON.parse(event.data));
          } catch (error) {
            console.error("Error parseando WebSocket:", error);
          }
        });

        this.socket.addEventListener("close", () => {
          this.connectPromise = null;
          this.emit("disconnect");
          if (this.shouldReconnect) {
            this.attemptReconnect();
          }
        });

        this.socket.addEventListener("error", (error) => {
          this.connectPromise = null;
          this.emit("error", error);
          reject(error);
        });
      } catch (error) {
        this.connectPromise = null;
        reject(error);
      }
    });

    return this.connectPromise;
  }

  handleMessage(data) {
    const { type } = data;

    if (type === "profile.connected") {
      this.emit("connect", data.user);
      this.emit("online_users", data.online_users || []);
    } else if (type === "profile.message_received") {
      this.emit("message_received", data.message);
    } else if (type === "profile.message_deleted") {
      this.emit("message_deleted", data.message);
    } else if (type === "profile.user_online") {
      this.emit("user_online", data.user);
    } else if (type === "profile.user_offline") {
      this.emit("user_offline", { userId: data.userId });
    } else if (type === "profile.user_typing") {
      this.emit("user_typing", {
        userId: data.typingUserId,
        userName: data.typingUserName,
        channel: data.channel || "general"
      });
    } else if (type === "profile.user_stop_typing") {
      this.emit("user_stop_typing", {
        userId: data.typingUserId,
        channel: data.channel || "general"
      });
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts += 1;
      window.setTimeout(() => {
        this.connect().catch((error) => {
          console.error("Reconexion WebSocket fallida:", error);
        });
      }, this.reconnectDelay);
      return;
    }

    this.emit("error", new Error("Reconexion fallida"));
  }

  sendMessage(data) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  notifyTyping(recipientUserId = null, channel = "general") {
    this.sendMessage({
      type: "profile.typing",
      recipientUserId,
      channel
    });
  }

  notifyStopTyping(recipientUserId = null, channel = "general") {
    this.sendMessage({
      type: "profile.stop_typing",
      recipientUserId,
      channel
    });
  }

  on(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].push(callback);
    }
  }

  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter((cb) => cb !== callback);
    }
  }

  emit(eventType, data) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error en listener ${eventType}:`, error);
        }
      });
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

const sharedManagers = new Map();

export const getSharedProfileWebSocketManager = (token) => {
  const key = String(token || "");
  if (!key) return null;

  const current = sharedManagers.get(key);
  if (current) {
    current.refs += 1;
    return current.manager;
  }

  const manager = new ProfileWebSocketManager(key);
  sharedManagers.set(key, { manager, refs: 1 });
  return manager;
};

export const releaseSharedProfileWebSocketManager = (token) => {
  const key = String(token || "");
  const current = sharedManagers.get(key);
  if (!current) return;

  current.refs -= 1;
  if (current.refs <= 0) {
    current.manager.disconnect();
    sharedManagers.delete(key);
  }
};
