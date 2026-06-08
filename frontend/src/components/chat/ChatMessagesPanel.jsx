import { AnimatePresence, motion } from "motion/react";
import { Bell, MessageSquare, Pin, Send, Trash2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProfileWebSocketManager } from "@/utils/profileWebSocket.js";

export function ChatMessagesPanel({
  apiFetch,
  isAdmin,
  messages = [],
  safeUsers = [],
  currentUserId,
  onMessageSent,
  session,
  showAlert
}) {
  const [messageBody, setMessageBody] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [actingMessageId, setActingMessageId] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [wsConnected, setWsConnected] = useState(false);
  const wsManagerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const participantCount = Math.max(1, safeUsers.length || 1);
  const pinnedMessages = messages.filter((message) => message.pinned_at);

  useEffect(() => {
    if (!session?.sessionToken) return;

    const manager = new ProfileWebSocketManager(session.sessionToken);

    manager.on("connect", () => setWsConnected(true));
    manager.on("disconnect", () => setWsConnected(false));
    manager.on("message_received", (message) => {
      if (message.is_general || message.sender_user_id === currentUserId || message.recipient_user_id === currentUserId) {
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
  }, [currentUserId, onMessageSent, session?.sessionToken]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const body = messageBody.trim();

    if (!body) return;

    setSavingMessage(true);
    try {
      const response = await apiFetch("/profile/messages/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No fue posible enviar el mensaje.");

      setMessageBody("");
      onMessageSent?.();
      showAlert?.("Mensaje enviado al chat general.");
    } catch (sendError) {
      showAlert?.(sendError.message);
    } finally {
      setSavingMessage(false);
    }
  };

  const handleTogglePin = async (message) => {
    if (!isAdmin || !message?.id) return;
    setActingMessageId(message.id);
    try {
      const response = await apiFetch(`/profile/messages/general/${message.id}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !message.pinned_at })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No fue posible actualizar el mensaje.");
      onMessageSent?.();
    } catch (error) {
      showAlert?.(error.message);
    } finally {
      setActingMessageId(null);
    }
  };

  const handleDeleteMessage = async (message) => {
    if (!isAdmin || !message?.id) return;
    setActingMessageId(message.id);
    try {
      const response = await apiFetch(`/profile/messages/general/${message.id}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No fue posible borrar el mensaje.");
      onMessageSent?.();
    } catch (error) {
      showAlert?.(error.message);
    } finally {
      setActingMessageId(null);
    }
  };

  return (
    <motion.article
      className="profile-panel profile-messages-panel chat-general-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div className="profile-panel-head chat-general-head">
        <div>
          <p className="sheet-kicker">Comunicacion</p>
          <h3>
            <MessageSquare size={20} />
            Chat general del equipo
          </h3>
          <small className="chat-general-subtitle">Una sola conversacion para coordinar avisos, campo y seguimiento.</small>
        </div>
        <div className="chat-header-controls">
          <span className="chat-participants-badge">
            <Users size={14} />
            {participantCount} participantes
          </span>
          <span className={`ws-status-badge ${wsConnected ? "is-connected" : "is-disconnected"}`}>
            <span className="ws-status-dot" />
            {wsConnected ? "En linea" : "Fuera de linea"}
          </span>
          <AnimatePresence>
            {onlineUsers.size > 0 && (
              <motion.span
                className="chat-notification-badge"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
              >
                <Bell size={14} />
                {onlineUsers.size}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="chat-general-shell">
        {pinnedMessages.length ? (
          <div className="chat-pinned-strip" aria-label="Mensajes anclados">
            {pinnedMessages.slice(-2).map((message) => (
              <button key={`pinned-${message.id}`} type="button" className="chat-pinned-card">
                <Pin size={13} />
                <span>{message.body}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="chat-messages-container" ref={messagesContainerRef}>
          <div className="chat-messages-list">
            {messages.length > 0 ? (
              messages.map((message) => (
                <motion.div
                  key={`general-${message.id}`}
                  className={`chat-message ${message.sender_user_id === currentUserId ? "is-own" : ""}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="chat-message-bubble">
                    {message.pinned_at ? (
                      <span className="chat-message-pin">
                        <Pin size={12} />
                        Anclado
                      </span>
                    ) : null}
                    <strong className="chat-message-sender">
                      {message.sender_user_id === currentUserId ? "Tu" : message.sender_name}
                    </strong>
                    <p className="chat-message-body">{message.body}</p>
                    <small className="chat-message-time">
                      {new Intl.DateTimeFormat("es-HN", {
                        timeStyle: "short"
                      }).format(new Date(message.created_at))}
                    </small>
                    {isAdmin ? (
                      <span className="chat-message-admin-actions">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(message)}
                          disabled={actingMessageId === message.id}
                          title={message.pinned_at ? "Desanclar mensaje" : "Anclar mensaje"}
                        >
                          <Pin size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(message)}
                          disabled={actingMessageId === message.id}
                          title="Borrar mensaje"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="chat-empty-state">
                <MessageSquare size={32} />
                <span>Sin mensajes todavia.</span>
                <small>Escribe el primer mensaje para todo el equipo.</small>
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
                  <small>Alguien esta escribiendo...</small>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </div>

        <form className="chat-message-form" onSubmit={handleSendMessage}>
          <textarea
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            placeholder="Escribe un mensaje para todo el equipo..."
            disabled={savingMessage}
            className="chat-message-input"
            rows="3"
          />
          <button
            type="submit"
            disabled={savingMessage || !messageBody.trim()}
            className="chat-send-button"
          >
            <Send size={16} />
            {savingMessage ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </div>
    </motion.article>
  );
}
