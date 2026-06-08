import { AnimatePresence, motion } from "motion/react";
import { Bell, MessageSquare, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProfileWebSocketManager } from "../utils/profileWebSocket.js";

export function NotificationCenter({ apiFetch, session, unreadCount = 0, onNotificationClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const wsManagerRef = useRef(null);

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
        }
      } catch (error) {
        console.error("Error cargando notificaciones:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [isOpen, apiFetch, session?.user?.id]);

  // Conectar WebSocket para actualizaciones en tiempo real
  useEffect(() => {
    if (!session?.sessionToken) return;

    const manager = new ProfileWebSocketManager(session.sessionToken);

    manager.on("message_received", (message) => {
      if (message.recipient_user_id === session?.user?.id) {
        setNotifications((prev) => [message, ...prev]);
      }
    });

    wsManagerRef.current = manager;
    manager.connect().catch((error) => console.error("WebSocket error:", error));

    return () => {
      manager.disconnect();
    };
  }, [session?.sessionToken, session?.user?.id]);

  const handleMarkAsRead = async (messageId) => {
    try {
      await apiFetch(`/profile/messages/${messageId}/read`, {
        method: "PATCH"
      });
      setNotifications((prev) => prev.filter((n) => n.id !== messageId));
    } catch (error) {
      console.error("Error marcando como leído:", error);
    }
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
    setIsOpen(false);
  };

  return (
    <div className="notification-center-container" ref={dropdownRef}>
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
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
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
                      onClick={() => handleMarkAsRead(notification.id)}
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
