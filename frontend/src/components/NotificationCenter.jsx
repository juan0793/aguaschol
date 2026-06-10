import { AnimatePresence, motion } from "motion/react";
import { Bell, MessageSquare, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NOTIFICATION_SOUND_MUTED_STORAGE_KEY } from "../constants/storageKeys.js";
import { getSharedProfileWebSocketManager, releaseSharedProfileWebSocketManager } from "../utils/profileWebSocket.js";
import { playNotificationSound, primeNotificationSound } from "../utils/notificationSound.js";

export function NotificationCenter({
  apiFetch,
  session,
  unreadCount = 0,
  onNotificationClick,
  onNotificationSelect,
  onUnreadCountChange,
  showAlert
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [soundMuted, setSoundMuted] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(NOTIFICATION_SOUND_MUTED_STORAGE_KEY) === "1"
  );
  const sessionToken = session?.token || session?.sessionToken || "";
  const dropdownRef = useRef(null);
  const wsManagerRef = useRef(null);
  const soundMutedRef = useRef(soundMuted);

  useEffect(() => {
    soundMutedRef.current = soundMuted;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(NOTIFICATION_SOUND_MUTED_STORAGE_KEY, soundMuted ? "1" : "0");
  }, [soundMuted]);

  useEffect(() => {
    const unlockSound = () => {
      if (!soundMutedRef.current) {
        primeNotificationSound();
      }
    };

    window.addEventListener("pointerdown", unlockSound, { once: true });
    window.addEventListener("keydown", unlockSound, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Cargar notificaciones cuando se abre
  useEffect(() => {
    if (!isOpen) return;

    const loadNotifications = async () => {
      setLoading(true);
      try {
        const response = await apiFetch("/profile");
        const data = await response.json();
        if (response.ok && data.messages) {
          const unread = data.messages.filter(
            (m) => m.recipient_user_id === session?.user?.id && !m.read_at
          );
          setNotifications(unread);
          onUnreadCountChange?.(unread.length);
        }
      } catch (error) {
        console.error("Error cargando notificaciones:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [apiFetch, isOpen, onUnreadCountChange, session?.user?.id]);

  // Conectar WebSocket para actualizaciones en tiempo real
  useEffect(() => {
    if (!sessionToken || !session?.user?.id) return undefined;

    const manager = getSharedProfileWebSocketManager(sessionToken);
    if (!manager) return undefined;

    const handleMessageReceived = (message) => {
      if (Number(message?.recipient_user_id) === Number(session.user.id) && !message?.read_at) {
        setNotifications((prev) => {
          if (prev.some((item) => Number(item.id) === Number(message.id))) return prev;
          return [message, ...prev];
        });
        onUnreadCountChange?.((current) => Number(current || 0) + 1);
        playNotificationSound({ muted: soundMutedRef.current });
        showAlert?.(message.body || "Nueva notificacion del equipo.");
      }
    };

    manager.on("message_received", handleMessageReceived);

    wsManagerRef.current = manager;
    manager.connect().catch((error) => console.error("WebSocket error:", error));

    return () => {
      manager.off("message_received", handleMessageReceived);
      releaseSharedProfileWebSocketManager(sessionToken);
    };
  }, [onUnreadCountChange, session?.user?.id, sessionToken, showAlert]);

  const handleMarkAsRead = async (messageId) => {
    try {
      await apiFetch(`/profile/messages/${messageId}/read`, {
        method: "PATCH"
      });
      setNotifications((prev) => prev.filter((n) => n.id !== messageId));
      onUnreadCountChange?.((current) => Math.max(0, Number(current || 0) - 1));
    } catch (error) {
      console.error("Error marcando como leído:", error);
    }
  };

  const handleOpenNotification = (notification) => {
    if (notification?.sender_user_id) {
      onNotificationSelect?.(notification.sender_user_id);
    } else {
      onNotificationClick?.();
    }
    setIsOpen(false);
  };

  const handleClearAll = async () => {
    const unreadIds = notifications
      .filter((n) => !n.read_at)
      .map((n) => n.id);

    await Promise.all(
      unreadIds.map((id) =>
        apiFetch(`/profile/messages/${id}/read`, {
          method: "PATCH"
        }).catch(() => null)
      )
    );

    setNotifications([]);
    onUnreadCountChange?.(0);
    setIsOpen(false);
  };

  const handleToggleSound = () => {
    setSoundMuted((current) => {
      const next = !current;
      if (!next) {
        primeNotificationSound();
      }
      return next;
    });
  };

  return (
    <div className="notification-center-container" ref={dropdownRef}>
      <button
        className={`notification-sound-toggle ${soundMuted ? "is-muted" : ""}`}
        onClick={handleToggleSound}
        title={soundMuted ? "Activar sonido de mensajes" : "Mutear sonido de mensajes"}
        aria-label={soundMuted ? "Activar sonido de mensajes" : "Mutear sonido de mensajes"}
        type="button"
      >
        {soundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <button
        className={`notification-bell ${unreadCount > 0 ? "has-notifications" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Notificaciones"
        aria-label="Abrir notificaciones"
      >
        <Bell size={20} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              className="notification-badge"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="notification-dropdown"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="notification-dropdown-header">
              <h4>Notificaciones</h4>
              {notifications.length > 0 && (
                <button
                  className="notification-clear-btn"
                  onClick={handleClearAll}
                  title="Marcar todas como leídas"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="notification-dropdown-list">
              {loading ? (
                <div className="notification-loading">Cargando...</div>
              ) : notifications.length > 0 ? (
                notifications.slice(0, 8).map((notification) => (
                  <motion.div
                    key={notification.id}
                    className="notification-item"
                    role="button"
                    tabIndex={0}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    onClick={() => handleOpenNotification(notification)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleOpenNotification(notification);
                      }
                    }}
                  >
                    <div className="notification-item-content">
                      <div className="notification-item-header">
                        <strong className="notification-sender">
                          {notification.sender_name || "Sistema"}
                        </strong>
                        {!notification.read_at && (
                          <span className="notification-unread-dot" title="Sin leer" />
                        )}
                      </div>
                      <p className="notification-item-body">{notification.body.slice(0, 80)}</p>
                      <small className="notification-item-time">
                        {formatRelativeTime(notification.created_at)}
                      </small>
                    </div>
                    <button
                      className="notification-item-close"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMarkAsRead(notification.id);
                      }}
                      title="Marcar como leído"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="notification-empty">
                  <MessageSquare size={24} />
                  <span>Sin notificaciones</span>
                </div>
              )}
            </div>

            {notifications.length > 8 && (
              <div className="notification-dropdown-footer">
                <button
                  className="notification-view-all"
                  onClick={() => {
                    onNotificationClick?.();
                    setIsOpen(false);
                  }}
                >
                  Ver todas las notificaciones
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Justo ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;

  return new Intl.DateTimeFormat("es-HN", {
    month: "short",
    day: "numeric"
  }).format(date);
}
