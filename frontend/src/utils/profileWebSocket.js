export class ProfileWebSocketManager {
  constructor(token) {
    this.token = token;
    this.socket = null;
    this.listeners = {
      connect: [],
      disconnect: [],
      message_received: [],
      user_online: [],
      user_offline: [],
      user_typing: [],
      user_stop_typing: [],
      error: []
    };
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/profile?token=${encodeURIComponent(this.token)}`;
        
        this.socket = new WebSocket(wsUrl);

        this.socket.addEventListener("open", () => {
          console.log("✓ Conectado al chat en tiempo real");
          this.reconnectAttempts = 0;
          this.emit("connect");
          resolve();
        });

        this.socket.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error("Error parseando WebSocket:", error);
          }
        });

        this.socket.addEventListener("close", () => {
          console.log("✗ Desconectado del chat");
          this.emit("disconnect");
          this.attemptReconnect();
        });

        this.socket.addEventListener("error", (error) => {
          console.error("Error WebSocket:", error);
          this.emit("error", error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(data) {
    const { type } = data;

    if (type === "profile.connected") {
      this.emit("connect", data.user);
    } else if (type === "profile.message_received") {
      this.emit("message_received", data.message);
    } else if (type === "profile.user_online") {
      this.emit("user_online", data.user);
    } else if (type === "profile.user_offline") {
      this.emit("user_offline", { userId: data.userId });
    } else if (type === "profile.user_typing") {
      this.emit("user_typing", {
        userId: data.typingUserId,
        userName: data.typingUserName
      });
    } else if (type === "profile.user_stop_typing") {
      this.emit("user_stop_typing", { userId: data.typingUserId });
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts += 1;
      console.log(`Reintentando conexión (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error("Reconexión fallida:", error);
        });
      }, this.reconnectDelay);
    } else {
      console.error("No se pudo reconectar al chat. Por favor recarga la página.");
      this.emit("error", new Error("Reconexión fallida"));
    }
  }

  sendMessage(data) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket no está conectado");
    }
  }

  notifyTyping(recipientUserId) {
    this.sendMessage({
      type: "profile.typing",
      recipientUserId
    });
  }

  notifyStopTyping(recipientUserId) {
    this.sendMessage({
      type: "profile.stop_typing",
      recipientUserId
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
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}
