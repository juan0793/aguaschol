import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCircle2, MessageSquare, Users, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NOTIFICATION_SOUND_MUTED_STORAGE_KEY } from "../constants/storageKeys.js";
import { getSharedProfileWebSocketManager, releaseSharedProfileWebSocketManager } from "../utils/profileWebSocket.js";
import { playNotificationSound, primeNotificationSound } from "../utils/notificationSound.js";
import { agruparActividad, resumenTrabajo } from "../modules/actividad/agruparActividad.js";

export function NotificationCenter({
  apiFetch,
  session,
  unreadCount = 0,
  onNotificationClick,
  onNotificationSelect,
  onEntregaNotification,
  onBancoNotification,
  onUnreadCountChange,
  onTeamActivityClick,
  onTeamActivitySelect,
  showAlert
}) {
  // Administración también recibe lo que hace el equipo (actividad del sistema).
  const isAdmin = session?.user?.role === "admin";
  const [tab, setTab] = useState("mensajes");
  const [team, setTeam] = useState([]);
  const [teamUnread, setTeamUnread] = useState(0);
  const [teamSeenAt, setTeamSeenAt] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [soundMuted, setSoundMuted] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(NOTIFICATION_SOUND_MUTED_STORAGE_KEY) === "1"
  );
  const sessionToken = session?.token || session?.sessionToken || "";
  const dropdownRef = useRef(null);
  const wsManagerRef = useRef(null);
  const soundMutedRef = useRef(soundMuted);
  const isOpenRef = useRef(false);
  const tabRef = useRef(tab);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // Actividad del equipo: lo último y cuántas no ha visto este administrador.
  const loadTeam = async () => {
    const response = await apiFetch("/admin/team-activity?resumen=0&limit=30");
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo cargar la actividad del equipo.");
    setTeam(data.items || []);
    setTeamUnread(Number(data.unread || 0));
    setTeamSeenAt(data.seen_at || null);
    return data;
  };
  useEffect(() => {
    if (!isAdmin) return;
    loadTeam().catch(() => {});
  }, [isAdmin]);

  // Al abrir la pestaña "Equipo" se da por vista la actividad; los puntos de
  // "nueva" siguen hasta cerrar, para distinguir lo que acaba de llegar.
  useEffect(() => {
    if (!isAdmin || !isOpen || tab !== "equipo" || !teamUnread) return;
    apiFetch("/admin/team-activity/seen", { method: "POST" }).then((response) => { if (response.ok) setTeamUnread(0); }).catch(() => {});
  }, [apiFetch, isAdmin, isOpen, tab, teamUnread]);

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
      const escape = (event) => { if (event.key === "Escape") { setIsOpen(false); dropdownRef.current?.querySelector(".notification-bell")?.focus(); } };
      document.addEventListener("keydown", escape);
      return () => { document.removeEventListener("mousedown", handleClickOutside); document.removeEventListener("keydown", escape); };
    }
  }, [isOpen]);

  // Cargar notificaciones cuando se abre
  useEffect(() => {
    if (!isOpen) return;

    const loadNotifications = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await apiFetch("/profile");
        const data = await response.json();
        if (!response.ok) throw new Error("No se pudieron cargar los mensajes.");
        if (response.ok && data.messages) {
          const unread = data.messages.filter(
            (m) => Number(m.recipient_user_id) === Number(session?.user?.id) && !m.read_at
          );
          setNotifications(unread);
          onUnreadCountChange?.(unread.length);
        }
      } catch (error) {
        setError("No se pudieron cargar las notificaciones. Cierra y vuelve a abrir para reintentar.");
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
    if (isAdmin) loadTeam().catch(() => setError("No se pudo cargar la actividad del equipo."));
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

    // Algo que hizo el equipo: siempre a la campana; sonido y aviso solo si cierra un trabajo.
    const handleTeamActivity = (activity) => {
      if (!isAdmin || !activity?.id) return;
      setTeam((prev) => (prev.some((item) => item.id === activity.id) ? prev : [activity, ...prev].slice(0, 40)));
      if (!(isOpenRef.current && tabRef.current === "equipo")) setTeamUnread((current) => current + 1);
      if (activity.final) {
        playNotificationSound({ muted: soundMutedRef.current });
        showAlert?.(`${activity.actor_name}: ${activity.summary}`);
      }
    };

    manager.on("message_received", handleMessageReceived);
    manager.on("team_activity", handleTeamActivity);

    wsManagerRef.current = manager;
    manager.connect().catch((error) => console.error("WebSocket error:", error));

    return () => {
      manager.off("message_received", handleMessageReceived);
      manager.off("team_activity", handleTeamActivity);
      releaseSharedProfileWebSocketManager(sessionToken);
    };
  }, [isAdmin, onUnreadCountChange, session?.user?.id, sessionToken, showAlert]);

  const totalUnread = Number(unreadCount || 0) + (isAdmin ? teamUnread : 0);
  const abrirCampana = () => {
    // Se abre en la pestaña que tiene algo nuevo; si solo hay del equipo, en "Equipo".
    if (!isOpen && isAdmin) setTab(Number(unreadCount || 0) === 0 && teamUnread > 0 ? "equipo" : "mensajes");
    setIsOpen(!isOpen);
  };
  const esNueva = (activity) => !teamSeenAt || new Date(activity.created_at) > new Date(teamSeenAt);

  const handleMarkAsRead = async (messageId) => {
    try {
      const response = await apiFetch(`/profile/messages/${messageId}/read`, {
        method: "PATCH"
      });
      if (!response.ok) throw new Error("No se pudo marcar como leído.");
      setNotifications((prev) => prev.filter((n) => n.id !== messageId));
      onUnreadCountChange?.((current) => Math.max(0, Number(current || 0) - 1));
    } catch (error) {
      setError("No se pudo marcar como leído. Inténtalo nuevamente.");
    }
  };

  const handleOpenNotification = (notification) => {
    if (notification?.entrega_lote_id) {
      onEntregaNotification?.(notification.entrega_lote_id);
      handleMarkAsRead(notification.id);
    } else if (notification?.banco_asignacion) {
      onBancoNotification?.();
      handleMarkAsRead(notification.id);
    } else if (notification?.sender_user_id) {
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

    const results = await Promise.all(
      unreadIds.map((id) =>
        apiFetch(`/profile/messages/${id}/read`, {
          method: "PATCH"
        }).catch(() => null)
      )
    );

    const successfulIds = unreadIds.filter((id, index) => results[index]?.ok);
    setNotifications((current) => current.filter((item) => !successfulIds.includes(item.id)));
    onUnreadCountChange?.((current) => Math.max(0, Number(current || 0) - successfulIds.length));
    if (successfulIds.length !== unreadIds.length) setError("Algunos mensajes no se pudieron marcar como leídos. Inténtalo nuevamente.");
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
        className={`notification-bell ${totalUnread > 0 ? "has-notifications" : ""}`}
        onClick={abrirCampana}
        title="Notificaciones"
        aria-label="Abrir notificaciones"
        type="button"
        aria-expanded={isOpen}
        aria-controls="notification-dropdown"
      >
        <Bell size={20} />
        <AnimatePresence>
          {totalUnread > 0 && (
            <motion.span
              className="notification-badge"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              {totalUnread > 9 ? "9+" : totalUnread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="notification-dropdown"
            id="notification-dropdown"
            role="region"
            aria-label="Notificaciones"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="notification-dropdown-header">
              <h4>Notificaciones</h4>
              {(!isAdmin || tab === "mensajes") && notifications.length > 0 && (
                <button
                  className="notification-clear-btn"
                  onClick={handleClearAll}
                  title="Marcar todas como leídas"
                >
                  Limpiar
                </button>
              )}
            </div>

            {isAdmin ? <div className="notification-tabs" role="tablist" aria-label="Tipo de notificación">
              <button type="button" role="tab" aria-selected={tab === "mensajes"} className={tab === "mensajes" ? "is-active" : ""} onClick={() => setTab("mensajes")}><MessageSquare size={14} />Mensajes{unreadCount > 0 ? <b>{unreadCount}</b> : null}</button>
              <button type="button" role="tab" aria-selected={tab === "equipo"} className={tab === "equipo" ? "is-active" : ""} onClick={() => setTab("equipo")}><Users size={14} />Equipo{teamUnread > 0 ? <b>{teamUnread}</b> : null}</button>
            </div> : null}

            {isAdmin && tab === "equipo" ? <div className="notification-dropdown-list" role="tabpanel" aria-label="Actividad del equipo">
              {/* Agrupado por trabajo: lo que una persona hizo sobre el mismo registro en pocos minutos. */}
              {team.length ? agruparActividad(team).slice(0, 8).map((trabajo) => <button type="button" key={trabajo.id} className={`notification-item notification-team-item ${trabajo.final ? "is-final" : ""}`} onClick={() => { onTeamActivitySelect?.({ ...trabajo.items[0], enlace: trabajo.enlace }); setIsOpen(false); }}>
                <span className="notification-team-mark" aria-hidden="true">{trabajo.final ? <CheckCircle2 size={15} /> : <i />}</span>
                <span className="notification-item-content">
                  <span className="notification-item-header"><strong className="notification-sender">{trabajo.actor_name}</strong>{trabajo.items.some(esNueva) ? <span className="notification-unread-dot" title="Nueva" /> : null}</span>
                  <span className="notification-item-body">{trabajo.final ? <em>Finalizó · </em> : null}{trabajo.items.length > 1 && trabajo.titulo ? `${trabajo.titulo} · ` : ""}{resumenTrabajo(trabajo)}</span>
                  <small className="notification-item-time">{formatRelativeTime(trabajo.hasta)}{trabajo.items.length > 1 ? ` · ${trabajo.items.length} acciones` : ""}</small>
                </span>
              </button>) : <div className="notification-empty"><Users size={24} /><span>El equipo no ha registrado actividad reciente</span></div>}
            </div> : <div className="notification-dropdown-list">
              {error ? <p className="notification-error" role="alert">{error}</p> : null}
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
                      <p className="notification-item-body">{String(notification.body || "").slice(0, 80)}</p>
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
              ) : !error ? (
                <div className="notification-empty">
                  <MessageSquare size={24} />
                  <span>Sin notificaciones</span>
                </div>
              ) : null}
            </div>}

            {isAdmin && tab === "equipo" ? <div className="notification-dropdown-footer">
              <button className="notification-view-all" type="button" onClick={() => { onTeamActivityClick?.(); setIsOpen(false); }}>Ver toda la actividad del equipo</button>
            </div> : null}

            {(!isAdmin || tab === "mensajes") && notifications.length > 8 && (
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
