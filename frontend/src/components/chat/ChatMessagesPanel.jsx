import { AnimatePresence, motion } from "motion/react";
import { Check, CheckCheck, FileText, Hash, Image as ImageIcon, KeyRound, MapPin, Paperclip, Pin, Reply, Send, Share2, Trash2, Type, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FILES_URL } from "../../config/api.js";
import { CHAT_FONT_STORAGE_KEY } from "../../constants/storageKeys.js";
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
  if (message.read_receipt) {
    return messages.map((item) =>
      Number(item.id) === Number(message.id)
        ? { ...item, read_count: message.read_count, read_by_names: message.read_by_names }
        : item
    );
  }
  const exists = messages.some((item) => item.id === message.id);
  const next = exists ? messages.map((item) => (item.id === message.id ? { ...item, ...message } : item)) : [...messages, message];
  return next.sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
};

const SHARE_TYPES = {
  clave: { label: "Clave", icon: KeyRound, tone: "is-key" },
  punto: { label: "Punto", icon: MapPin, tone: "is-point" },
  ficha: { label: "Ficha", icon: FileText, tone: "is-record" }
};

const SHARE_PREFIX = "[CHAT_SHARE]";
const CHAT_FONTS = [
  { key: "system", label: "Sistema" },
  { key: "serif", label: "Serif" },
  { key: "mono", label: "Mono" }
];

const parseSharedSummary = (body = "") => {
  const text = String(body || "");
  if (!text.startsWith(SHARE_PREFIX)) return null;

  const lines = text.split("\n").slice(1);
  const fields = lines.reduce((acc, line) => {
    const separator = line.indexOf(":");
    if (separator < 0) return acc;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {});

  const type = SHARE_TYPES[fields.tipo] ? fields.tipo : "clave";
  return {
    type,
    label: SHARE_TYPES[type].label,
    title: fields.titulo || SHARE_TYPES[type].label,
    clave: fields.clave || "",
    detail: fields.detalle || "",
    extra: fields.extra || ""
  };
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
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [shareDraft, setShareDraft] = useState({ type: "clave", title: "", clave: "", detail: "", extra: "" });
  const [savingMessage, setSavingMessage] = useState(false);
  const [actingMessageId, setActingMessageId] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [chatFont, setChatFont] = useState(() => window.localStorage.getItem(CHAT_FONT_STORAGE_KEY) || "system");
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
  const readMarkedIdsRef = useRef(new Set());

  useEffect(() => {
    setLocalMessages(
      [...messages].sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
    );
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(CHAT_FONT_STORAGE_KEY, chatFont);
  }, [chatFont]);

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
    setReplyToMessage(null);
  }, [activeChannel]);

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

  useEffect(() => {
    const unreadIds = channelMessages
      .filter((message) => Number(message.sender_user_id) !== Number(currentUserId))
      .filter((message) => !readMarkedIdsRef.current.has(Number(message.id)))
      .map((message) => Number(message.id))
      .filter(Boolean);
    if (!unreadIds.length) return;
    unreadIds.forEach((id) => readMarkedIdsRef.current.add(id));
    apiFetch("/profile/messages/general/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_ids: unreadIds })
    })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data?.receipts)) {
          setLocalMessages((prev) => data.receipts.reduce((acc, receipt) => upsertMessage(acc, receipt), prev));
        }
      })
      .catch(() => null);
  }, [apiFetch, channelMessages, currentUserId]);

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

  const updateShareDraft = (field, value) => {
    setShareDraft((current) => ({ ...current, [field]: value }));
  };

  const getReplyPreview = (message = {}) => {
    const sharedSummary = parseSharedSummary(message.body);
    if (sharedSummary) return `${sharedSummary.label}: ${sharedSummary.clave || sharedSummary.title}`;
    const body = String(message.body || "").trim();
    if (body) return body.length > 120 ? `${body.slice(0, 120)}...` : body;
    if (message.attachment_type === "image" || message.attachment_url) return "Fotografia adjunta";
    return "Mensaje";
  };

  const sendChatMessage = async ({ body, image = null, replyTo = replyToMessage, clearText = true }) => {
    setSavingMessage(true);
    try {
      const formData = new FormData();
      formData.set("body", body);
      formData.set("channel", activeChannel);
      if (replyTo?.id) {
        formData.set("reply_to_message_id", replyTo.id);
      }
      if (image) {
        formData.set("image", image);
      }

      const response = await apiFetch("/profile/messages/general", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || data?.error || "No fue posible enviar el mensaje.");
      const sentMessage = data?.message || data;
      const deliveredCount = Number(data?.notifications_delivered ?? 0);

      if (clearText) setMessageBody("");
      setReplyToMessage(null);
      if (image) clearImage();
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

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const body = messageBody.trim();
    if (!body && !imageFile) return;
    await sendChatMessage({ body, image: imageFile });
  };

  const handleComposerKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (savingMessage || (!messageBody.trim() && !imageFile)) return;
    event.currentTarget.form?.requestSubmit();
  };

  const handleSendSharedSummary = async () => {
    const cleanTitle = shareDraft.title.trim();
    const cleanClave = shareDraft.clave.trim();
    const cleanDetail = shareDraft.detail.trim();
    const cleanExtra = shareDraft.extra.trim();
    if (!cleanTitle && !cleanClave && !cleanDetail && !cleanExtra) {
      showAlert?.("Agrega al menos una clave, referencia o detalle para compartir.");
      return;
    }

    const typeLabel = SHARE_TYPES[shareDraft.type]?.label || "Resumen";
    const body = [
      SHARE_PREFIX,
      `Tipo: ${shareDraft.type}`,
      `Titulo: ${cleanTitle || `${typeLabel} compartida`}`,
      `Clave: ${cleanClave}`,
      `Detalle: ${cleanDetail}`,
      `Extra: ${cleanExtra}`
    ].join("\n");

    await sendChatMessage({ body, image: null });
    setShareDraft({ type: "clave", title: "", clave: "", detail: "", extra: "" });
    setSharePanelOpen(false);
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
      className={`profile-panel chat-workspace ${isCompactLayout ? "is-compact" : ""} font-${chatFont}`}
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
          <div className="chat-room-tools">
            <label title="Cambiar fuente del chat">
              <Type size={14} />
              <select value={chatFont} onChange={(event) => setChatFont(event.target.value)}>
                {CHAT_FONTS.map((font) => (
                  <option key={font.key} value={font.key}>{font.label}</option>
                ))}
              </select>
            </label>
            <span>{channelMessages.length} mensajes</span>
          </div>
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
              const sharedSummary = parseSharedSummary(message.body);

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
                      {message.reply_to ? (
                        <button type="button" className="chat-reply-quote" onClick={() => setReplyToMessage(message.reply_to)}>
                          <strong>{message.reply_to.sender_name || "Usuario"}</strong>
                          <span>{getReplyPreview(message.reply_to)}</span>
                        </button>
                      ) : null}
                      {imageUrl ? (
                        <a href={imageUrl} target="_blank" rel="noreferrer" className="chat-image-attachment">
                          <img src={imageUrl} alt="Adjunto del chat" />
                        </a>
                      ) : null}
                      {sharedSummary ? (
                        <article className={`chat-shared-summary ${SHARE_TYPES[sharedSummary.type]?.tone || ""}`}>
                          <div className="chat-shared-summary-head">
                            {(() => {
                              const ShareIcon = SHARE_TYPES[sharedSummary.type]?.icon || Share2;
                              return <ShareIcon size={15} />;
                            })()}
                            <span>{sharedSummary.label}</span>
                          </div>
                          <strong>{sharedSummary.title}</strong>
                          {sharedSummary.clave ? <p><b>Clave:</b> {sharedSummary.clave}</p> : null}
                          {sharedSummary.detail ? <p>{sharedSummary.detail}</p> : null}
                          {sharedSummary.extra ? <small>{sharedSummary.extra}</small> : null}
                        </article>
                      ) : message.body ? <p>{message.body}</p> : null}
                      <div className="chat-bubble-actions">
                        {message.pinned_at ? <span><Pin size={11} />Fijado</span> : null}
                        {isOwn ? (
                          <span className={`chat-read-state ${Number(message.read_count || 0) > 0 ? "is-seen" : ""}`} title={Number(message.read_count || 0) > 0 ? `Visto por ${message.read_by_names?.join(", ") || "el equipo"}` : "Enviado"}>
                            {Number(message.read_count || 0) > 0 ? <CheckCheck size={13} /> : <Check size={13} />}
                          </span>
                        ) : null}
                        <button type="button" onClick={() => setReplyToMessage(message)} title="Responder mensaje">
                          <Reply size={12} />
                        </button>
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
          {replyToMessage ? (
            <div className="chat-reply-composer">
              <Reply size={14} />
              <div>
                <strong>Respondiendo a {Number(replyToMessage.sender_user_id) === Number(currentUserId) ? "tu mensaje" : replyToMessage.sender_name || "Usuario"}</strong>
                <span>{getReplyPreview(replyToMessage)}</span>
              </div>
              <button type="button" onClick={() => setReplyToMessage(null)} title="Cancelar respuesta">
                <X size={14} />
              </button>
            </div>
          ) : null}
          {imagePreviewUrl ? (
            <div className="chat-image-preview">
              <img src={imagePreviewUrl} alt="Vista previa" />
              <button type="button" onClick={clearImage}>
                <X size={14} />
              </button>
            </div>
          ) : null}
          {sharePanelOpen ? (
            <div className="chat-share-panel">
              <div className="chat-share-type-row" role="group" aria-label="Tipo de resumen">
                {Object.entries(SHARE_TYPES).map(([key, item]) => {
                  const ShareIcon = item.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={shareDraft.type === key ? "is-active" : ""}
                      onClick={() => updateShareDraft("type", key)}
                    >
                      <ShareIcon size={14} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="chat-share-grid">
                <input
                  value={shareDraft.title}
                  onChange={(event) => updateShareDraft("title", event.target.value)}
                  placeholder={shareDraft.type === "punto" ? "Referencia del punto" : shareDraft.type === "ficha" ? "Titulo de la ficha" : "Nombre o referencia"}
                />
                <input
                  value={shareDraft.clave}
                  onChange={(event) => updateShareDraft("clave", event.target.value)}
                  placeholder="Clave catastral o codigo"
                />
                <input
                  value={shareDraft.detail}
                  onChange={(event) => updateShareDraft("detail", event.target.value)}
                  placeholder="Resumen breve"
                />
                <input
                  value={shareDraft.extra}
                  onChange={(event) => updateShareDraft("extra", event.target.value)}
                  placeholder={shareDraft.type === "punto" ? "Coordenadas o zona" : "Estado, deuda o nota"}
                />
              </div>
              <div className="chat-share-actions">
                <button type="button" onClick={() => setSharePanelOpen(false)}>
                  Cancelar
                </button>
                <button type="button" onClick={handleSendSharedSummary} disabled={savingMessage}>
                  Compartir resumen
                </button>
              </div>
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
            <button type="button" className="chat-attach-button" onClick={() => setSharePanelOpen((current) => !current)} title="Compartir clave, punto o ficha">
              <Share2 size={18} />
            </button>
            <div className="chat-textarea-shell">
              <textarea
                value={messageBody}
                onChange={(event) => handleTypingChange(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={`Mensaje en ${channels.find((channel) => channel.key === activeChannel)?.label || "General"}...`}
                disabled={savingMessage}
                rows="1"
              />
            </div>
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
