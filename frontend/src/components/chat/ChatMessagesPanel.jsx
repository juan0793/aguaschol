import { AnimatePresence, motion } from "motion/react";
import { Bell, MessageSquare, Send, UserCheck, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProfileWebSocketManager } from "@/utils/profileWebSocket.js";

export function ChatMessagesPanel({
  apiFetch,
  isAdmin,
  messages = [],
  safeUsers = [],
  currentUserId,
  selectedUserId,
  onUserSelect,
  onMessageSent,
  session,
  showAlert
}) {
  const [messageBody, setMessageBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [wsConnected, setWsConnected] = useState(false);
  const wsManagerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const latestAdminMessage = messages.find(
    (m) => m.sender_role === "admin" && m.sender_user_id !== currentUserId
  );
  const unreadMessages = messages.filter(
    (m) => m.recipient_user_id === currentUserId && !m.read_at
  ).length;

  // Inicializar WebSocket
  useEffect(() => {
    if (!session?.sessionToken) return;

    const manager = new ProfileWebSocketManager(session.sessionToken);

    manager.on("connect", () => {
      setWsConnected(true);
    });

    manager.on("disconnect", () => {
      setWsConnected(false);
    });

    manager.on("message_received", (message) => {
      if (
        message.sender_user_id === currentUserId ||
        message.recipient_user_id === currentUserId ||
        message.sender_user_id === selectedUserId ||
        message.recipient_user_id === selectedUserId
      ) {
        onMessageSent?.();
      }
    });

    manager.on("user_online", (user) => {
      setOnlineUsers((prev) => new Map(prev).set(user.id, user));
    });

    manager.on("user_offline", (data) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    });

    manager.on("user_typing", (data) => {
      setTypingUsers((prev) => new Set(prev).add(data.userId));
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
      }, 3000);
    });

    manager.on("user_stop_typing", (data) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    });

    manager.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    wsManagerRef.current = manager;
    manager.connect().catch((error) => {
      console.error("WebSocket connection failed:", error);
    });

    return () => {
      manager.disconnect();
    };
  }, [session?.sessionToken, currentUserId, selectedUserId, onMessageSent]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTyping = (e) => {
    const newBody = e.target.value;
    setMessageBody(newBody);

    if (isAdmin && wsManagerRef.current?.isConnected()) {
      wsManagerRef.current.notifyTyping(selectedUserId);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const body = isAdmin ? messageBody : replyBody;
    const recipientId = isAdmin ? selectedUserId : latestAdminMessage?.sender_user_id;

    if (!body.trim() || !recipientId) return;

    setSavingMessage(true);
    try {
      const response = await apiFetch("/profile/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_user_id: recipientId,
          parent_message_id: isAdmin ? null : latestAdminMessage?.id,
          body
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No fue posible enviar el mensaje.");

      if (wsManagerRef.current?.isConnected()) {
        wsManagerRef.current.notifyStopTyping(recipientId);
      }

      setMessageBody("");
      setReplyBody("");
      onMessageSent?.();
      showAlert?.("Mensaje enviado.");
    } catch (sendError) {
      showAlert?.(sendError.message);
    } finally {
      setSavingMessage(false);
    }
  };

  const chatHeader = isAdmin
    ? `Chatear con: ${
        safeUsers.find((u) => u.id === Number(selectedUserId))?.full_name || "Selecciona usuario"
      }`
    : "Soporte técnico";

  return (
    <motion.article
      className="profile-panel profile-messages-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div className="profile-panel-head">
        <div>
          <p className="sheet-kicker">Comunicación</p>
          <h3>
            <MessageSquare size={20} />
            {chatHeader}
          </h3>
        </div>
        <div className="chat-header-controls">
          <span className={`ws-status-badge ${wsConnected ? "is-connected" : "is-disconnected"}`}>
            <span className="ws-status-dot" />
            {wsConnected ? "En línea" : "Fuera de línea"}
          </span>
          <AnimatePresence>
            {unreadMessages > 0 && (
              <motion.span
                className="chat-notification-badge"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
              >
                <Bell size={14} />
                {unreadMessages}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isAdmin && (
        <div className="chat-user-selector">
          <label htmlFor="chat-user-select">
            <Users size={16} />
            Selecciona usuario
          </label>
          <select
            id="chat-user-select"
            value={selectedUserId}
            onChange={(e) => onUserSelect?.(e.target.value)}
            className="chat-user-dropdown"
          >
            {safeUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
                {onlineUsers.has(user.id) ? " 🟢" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="chat-messages-container">
        <div className="chat-messages-list">
          {messages.length > 0 ? (
            messages.map((message) => (
              <motion.div
                key={message.id}
                className={`chat-message ${message.sender_user_id === currentUserId ? "is-own" : ""}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                <div className="chat-message-bubble">
                  <strong className="chat-message-sender">
                    {message.sender_user_id === currentUserId ? "Tú" : message.sender_name}
                  </strong>
                  <p className="chat-message-body">{message.body}</p>
                  <small className="chat-message-time">
                    {new Intl.DateTimeFormat("es-HN", {
                      timeStyle: "short"
                    }).format(new Date(message.created_at))}
                  </small>
                  {message.read_at && message.sender_user_id === currentUserId && (
                    <span className="chat-message-read-badge" title="Leído">
                      ✓✓
                    </span>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="chat-empty-state">
              <MessageSquare size={32} />
              <span>Sin mensajes todavía.</span>
              <small>Inicia la conversación...</small>
            </div>
          )}

          <AnimatePresence>
            {typingUsers.size > 0 && (
              <motion.div
                className="chat-typing-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
                <small>
                  {Array.from(typingUsers).length === 1
                    ? "Escribiendo..."
                    : "Varios están escribiendo..."}
                </small>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      <form className="chat-message-form" onSubmit={handleSendMessage}>
        <textarea
          value={isAdmin ? messageBody : replyBody}
          onChange={isAdmin ? handleTyping : (e) => setReplyBody(e.target.value)}
          placeholder={
            isAdmin
              ? "Escribe un mensaje..."
              : latestAdminMessage
                ? "Responder a administración..."
                : "Espera un mensaje de administración"
          }
          disabled={(!isAdmin && !latestAdminMessage) || savingMessage}
          className="chat-message-input"
          rows="3"
        />
        <button
          type="submit"
          disabled={
            savingMessage ||
            !((isAdmin && messageBody.trim()) || (!isAdmin && latestAdminMessage && replyBody.trim()))
          }
          className="chat-send-button"
        >
          <Send size={16} />
          {savingMessage ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </motion.article>
  );
}

const safeText = (value, fallback = "") => String(value ?? "").trim() || fallback;
