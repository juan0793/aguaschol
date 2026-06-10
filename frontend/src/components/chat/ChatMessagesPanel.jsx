import { AnimatePresence, motion } from "motion/react";
import { Hash, Image as ImageIcon, Paperclip, Pin, Send, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FILES_URL } from "../../config/api.js";
import { getSharedProfileWebSocketManager, releaseSharedProfileWebSocketManager } from "../../utils/profileWebSocket.js";

const DEFAULT_CHANNELS = [
  { key: "general", label: "General" },
  { key: "campo", label: "Campo" },
  { key: "avisos", label: "Avisos" },
  { key: "soporte", label: "Soporte" },
  { key: "administracion", label: "Administración" }
];

const formatMessageDate = (value) =>
  new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium"
  }).format(new Date(value));

const formatMessageTime = (value) =>
  new Intl.DateTimeFormat("es-HN", {
    timeStyle: "short"
  }).format(new Date(value));

const getDayKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "sin-fecha" : date.toISOString().slice(0, 10);
};

const resolveFileUrl = (value = "") => {
  const path = String(value || "").trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = FILES_URL || "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

const upsertMessage = (messages, message) => {
  if (!message?.id) return messages;
  const exists = messages.some((item) => item.id === message.id);
  const next = exists ? messages.map((item) => (item.id === message.id ? { ...item, ...message } : item)) : [...messages, message];
  return next.sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
};

export function ChatMessagesPanel({
  apiFetch,
  isAdmin,
  messages = [],
  safeUsers = [],
  currentUserId,
  onMessageSent,
  session,
  showAlert,
  chatChannels = DEFAULT_CHANNELS
}) {
  const channels = chatChannels.length ? chatChannels : DEFAULT_CHANNELS;
  const [activeChannel, setActiveChannel] = useState(channels[0]?.key || "general");
  const [localMessages, setLocalMessages] = useState([]);
  const [messageBody, setMessageBody] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [actingMessageId, setActingMessageId] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [wsConnected, setWsConnected] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const sessionToken = session?.token || session?.sessionToken || "";
  const workspaceRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const wsManagerRef = useRef(null);

  useEffect(() => {
    setLocalMessages(
      [...messages].sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
    );
  }, [messages]);

  useEffect(() => {
    const node = workspaceRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;

    const updateLayout = () => setIsCompactLayout(node.getBoundingClientRect().width < 780);
    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sessionToken) return undefined;

    const manager = getSharedProfileWebSocketManager(sessionToken);
    if (!manager) return undefined;
    wsManagerRef.current = manager;

    const handleConnect = () => setWsConnected(true);
    const handleDisconnect = () => setWsConnected(false);
    const handleOnlineUsers = (users = []) => {
      setOnlineUsers(new Map(users.map((user) => [Number(user.id), user])));
    };
    const handleUserOnline = (user) => {
      setOnlineUsers((prev) => new Map(prev).set(Number(user.id), user));
    };
    const handleUserOffline = ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.delete(Number(userId));
        return next;
      });
    };
    const handleMessageReceived = (message) => {
      if (message?.is_general) {
        setLocalMessages((prev) => upsertMessage(prev, message));
        onMessageSent?.({ silent: true });
      }
    };
    const handleMessageDeleted = (payload) => {
      const deletedId = Number(payload?.deleted_id || payload?.id || 0);
      if (!deletedId) return;
      setLocalMessages((prev) => prev.filter((message) => Number(message.id) !== deletedId));
      onMessageSent?.({ silent: true });
    };
    const handleTyping = ({ userId, userName, channel }) => {
      if (!userId || Number(userId) === Number(currentUserId)) return;
      setTypingUsers((prev) => new Map(prev).set(`${channel}:${userId}`, { userId, userName, channel }));
    };
    const handleStopTyping = ({ userId, channel }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(`${channel}:${userId}`);
        return next;
      });
    };

    manager.on("connect", handleConnect);
    manager.on("disconnect", handleDisconnect);
    manager.on("online_users", handleOnlineUsers);
    manager.on("user_online", handleUserOnline);
    manager.on("user_offline", handleUserOffline);
    manager.on("message_received", handleMessageReceived);
    manager.on("message_deleted", handleMessageDeleted);
    manager.on("user_typing", handleTyping);
    manager.on("user_stop_typing", handleStopTyping);
    manager.connect().catch((error) => console.error("WebSocket error:", error));

    return () => {
      manager.off("connect", handleConnect);
      manager.off("disconnect", handleDisconnect);
      manager.off("online_users", handleOnlineUsers);
      manager.off("user_online", handleUserOnline);
      manager.off("user_offline", handleUserOffline);
      manager.off("message_received", handleMessageReceived);
      manager.off("message_deleted", handleMessageDeleted);
      manager.off("user_typing", handleTyping);
      manager.off("user_stop_typing", handleStopTyping);
      wsManagerRef.current = null;
      releaseSharedProfileWebSocketManager(sessionToken);
    };
  }, [currentUserId, onMessageSent, sessionToken]);

  useEffect(() => {
    const node = messagesContainerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [activeChannel, localMessages.length, typingUsers]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const channelMessages = useMemo(
    () => localMessages.filter((message) => (message.channel || "general") === activeChannel),
    [activeChannel, localMessages]
  );

  const pinnedMessages = useMemo(
    () => channelMessages.filter((message) => message.pinned_at).slice(-3),
    [channelMessages]
  );

  const typingInChannel = useMemo(
    () => Array.from(typingUsers.values()).filter((item) => item.channel === activeChannel),
    [activeChannel, typingUsers]
  );

  const usersWithPresence = useMemo(() => {
    const knownUsers = safeUsers.length ? safeUsers : [session?.user].filter(Boolean);
    return knownUsers.map((user) => ({
      ...user,
      isOnline: onlineUsers.has(Number(user.id)) || Number(user.id) === Number(currentUserId)
    }));
  }, [currentUserId, onlineUsers, safeUsers, session?.user]);

  const channelCounts = useMemo(
    () =>
      localMessages.reduce((acc, message) => {
        const key = message.channel || "general";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    [localMessages]
  );

  const handleTypingChange = (value) => {
    setMessageBody(value);
    const manager = wsManagerRef.current;
    manager?.notifyTyping(null, activeChannel);
    window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(() => {
      manager?.notifyStopTyping(null, activeChannel);
    }, 1200);
  };

  const clearImage = () => {
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const body = messageBody.trim();
    if (!body && !imageFile) return;

    setSavingMessage(true);
    try {
      const formData = new FormData();
      formData.set("body", body);
      formData.set("channel", activeChannel);
      if (imageFile) {
        formData.set("image", imageFile);
      }

      const response = await apiFetch("/profile/messages/general", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || data?.error || "No fue posible enviar el mensaje.");
      const sentMessage = data?.message || data;
      const deliveredCount = Number(data?.notifications_delivered ?? 0);

      setMessageBody("");
      clearImage();
      setLocalMessages((prev) => upsertMessage(prev, sentMessage));
      setDeliveryStatus(
        deliveredCount
          ? `Mensaje enviado. Notificacion entregada a ${deliveredCount} usuario${deliveredCount === 1 ? "" : "s"}.`
          : "Mensaje enviado en el canal."
      );
      wsManagerRef.current?.notifyStopTyping(null, activeChannel);
      onMessageSent?.({ silent: true });
      showAlert?.(
        deliveredCount
          ? `Mensaje enviado y notificado a ${deliveredCount} usuario${deliveredCount === 1 ? "" : "s"}.`
          : "Mensaje enviado."
      );
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
      if (!response.ok) throw new Error(data?.message || data?.error || "No fue posible actualizar el mensaje.");
      setLocalMessages((prev) => upsertMessage(prev, data));
      onMessageSent?.({ silent: true });
    } catch (error) {
      showAlert?.(error.message);
    } finally {
      setActingMessageId(null);
    }
  };

  const handleDeleteMessage = async (message) => {
    if (!message?.id) return;
    const canDelete = isAdmin || Number(message.sender_user_id) === Number(currentUserId);
    if (!canDelete) return;
    setActingMessageId(message.id);
    try {
      const response = await apiFetch(`/profile/messages/general/${message.id}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || data?.error || "No fue posible borrar el mensaje.");
      setLocalMessages((prev) => prev.filter((item) => item.id !== message.id));
      onMessageSent?.({ silent: true });
    } catch (error) {
      showAlert?.(error.message);
    } finally {
      setActingMessageId(null);
    }
  };

  let lastDay = "";

  return (
    <motion.article
      ref={workspaceRef}
      className={`profile-panel chat-workspace ${isCompactLayout ? "is-compact" : ""}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <aside className="chat-channel-rail" aria-label="Canales de chat">
        <div className="chat-connection-row">
          <span className={`chat-presence-dot ${wsConnected ? "is-online" : ""}`} />
          <strong>{wsConnected ? "En linea" : "Reconectando"}</strong>
        </div>
        {channels.map((channel) => (
          <button
            key={channel.key}
            type="button"
            className={`chat-channel-button ${activeChannel === channel.key ? "is-active" : ""}`}
            onClick={() => setActiveChannel(channel.key)}
          >
            <Hash size={15} />
            <span>{channel.label}</span>
            <b>{channelCounts[channel.key] || 0}</b>
          </button>
        ))}
        <div className="chat-users-compact">
          <span>
            <Users size={14} />
            Equipo
          </span>
          {usersWithPresence.slice(0, 9).map((user) => (
            <div key={`chat-user-${user.id}`} className="chat-user-presence-row">
              <i className={user.isOnline ? "is-online" : ""} />
              <strong>{user.full_name || user.username || "Usuario"}</strong>
            </div>
          ))}
        </div>
      </aside>

      <section className="chat-room">
        <header className="chat-room-header">
          <div>
            <p className="sheet-kicker">Chat del equipo</p>
            <h3><Hash size={18} />{channels.find((channel) => channel.key === activeChannel)?.label || "General"}</h3>
          </div>
          <span>{channelMessages.length} mensajes</span>
        </header>

        {pinnedMessages.length ? (
          <div className="chat-pinned-bar">
            {pinnedMessages.map((message) => (
              <button key={`pin-${message.id}`} type="button">
                <Pin size={13} />
                <span>{message.body || "Imagen fijada"}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="chat-thread" ref={messagesContainerRef}>
          {channelMessages.length ? (
            channelMessages.map((message) => {
              const dayKey = getDayKey(message.created_at);
              const showDate = dayKey !== lastDay;
              lastDay = dayKey;
              const isOwn = Number(message.sender_user_id) === Number(currentUserId);
              const canDelete = isAdmin || isOwn;
              const imageUrl = resolveFileUrl(message.attachment_url);

              return (
                <div key={`chat-message-wrap-${message.id}`}>
                  {showDate ? <div className="chat-date-separator">{formatMessageDate(message.created_at)}</div> : null}
                  <motion.div
                    className={`chat-bubble-row ${isOwn ? "is-own" : ""}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="chat-bubble">
                      <div className="chat-bubble-meta">
                        <strong>{isOwn ? "Tu" : message.sender_name || "Usuario"}</strong>
                        <span>{formatMessageTime(message.created_at)}</span>
                      </div>
                      {imageUrl ? (
                        <a href={imageUrl} target="_blank" rel="noreferrer" className="chat-image-attachment">
                          <img src={imageUrl} alt="Adjunto del chat" />
                        </a>
                      ) : null}
                      {message.body ? <p>{message.body}</p> : null}
                      <div className="chat-bubble-actions">
                        {message.pinned_at ? <span><Pin size={11} />Fijado</span> : null}
                        {isAdmin ? (
                          <button type="button" onClick={() => handleTogglePin(message)} disabled={actingMessageId === message.id}>
                            <Pin size={12} />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" onClick={() => handleDeleteMessage(message)} disabled={actingMessageId === message.id}>
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })
          ) : (
            <div className="chat-empty-state">
              <Hash size={28} />
              <span>Sin mensajes en este canal.</span>
              <small>Empieza la conversacion para el equipo.</small>
            </div>
          )}

          <AnimatePresence>
            {typingInChannel.length ? (
              <motion.div className="chat-typing-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {typingInChannel.map((item) => item.userName).join(", ")} escribiendo...
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <form className="chat-composer" onSubmit={handleSendMessage}>
          {imagePreviewUrl ? (
            <div className="chat-image-preview">
              <img src={imagePreviewUrl} alt="Vista previa" />
              <button type="button" onClick={clearImage}>
                <X size={14} />
              </button>
            </div>
          ) : null}
          <div className="chat-composer-row">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => setImageFile(event.target.files?.[0] || null)}
            />
            <button type="button" className="chat-attach-button" onClick={() => fileInputRef.current?.click()} title="Adjuntar imagen">
              <Paperclip size={18} />
            </button>
            <textarea
              value={messageBody}
              onChange={(event) => handleTypingChange(event.target.value)}
              placeholder={`Mensaje en ${channels.find((channel) => channel.key === activeChannel)?.label || "General"}...`}
              disabled={savingMessage}
              rows="1"
            />
            <button type="submit" className="chat-send-button" disabled={savingMessage || (!messageBody.trim() && !imageFile)}>
              {imageFile && !messageBody.trim() ? <ImageIcon size={17} /> : <Send size={17} />}
            </button>
          </div>
          <div className="chat-delivery-status" aria-live="polite">
            <span>{savingMessage ? "Enviando y notificando..." : deliveryStatus || "Las notificaciones se entregan al equipo conectado y quedan pendientes si no estan en linea."}</span>
          </div>
        </form>
      </section>
    </motion.article>
  );
}
