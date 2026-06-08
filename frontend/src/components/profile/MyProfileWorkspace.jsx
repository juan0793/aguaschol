import { AnimatePresence, motion } from "motion/react";
import {
  Award,
  Bell,
  Clock,
  MapPin,
  Medal,
  MessageSquare,
  Navigation,
  Radio,
  Send,
  Sparkles,
  Target,
  Timer,
  UserRound,
  Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatNumber = (value) => new Intl.NumberFormat("es-HN").format(Number(value ?? 0));

const formatMinutes = (value) => {
  const minutes = Number(value ?? 0);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const formatDateTime = (value) => {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const safeText = (value, fallback = "Sin referencia") => String(value ?? "").trim() || fallback;

const getPointPosition = (point, bounds) => {
  if (!bounds) return { left: "50%", top: "50%" };
  const lngSpan = bounds.maxLng - bounds.minLng || 0.0001;
  const latSpan = bounds.maxLat - bounds.minLat || 0.0001;
  return {
    left: `${((point.longitude - bounds.minLng) / lngSpan) * 100}%`,
    top: `${((bounds.maxLat - point.latitude) / latSpan) * 100}%`
  };
};

const StatCard = ({ icon: Icon, label, value, detail, tone = "" }) => (
  <motion.article
    className={`profile-stat-card ${tone}`.trim()}
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -3, scale: 1.01 }}
    transition={{ duration: 0.22 }}
  >
    <span className="profile-stat-icon">
      <Icon size={20} />
    </span>
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  </motion.article>
);

export default function MyProfileWorkspace({ apiFetch, isAdmin, safeUsers = [], session, showAlert }) {
  const currentUserId = session?.user?.id;
  const [targetUserId, setTargetUserId] = useState(currentUserId ?? "");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [achievementForm, setAchievementForm] = useState({
    title: "",
    description: ""
  });
  const [savingMessage, setSavingMessage] = useState(false);
  const [savingAchievement, setSavingAchievement] = useState(false);

  const selectedUserId = isAdmin ? Number(targetUserId || currentUserId) : currentUserId;

  const loadProfile = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedUserId) return;
      if (!silent) setLoading(true);
      setError("");

      try {
        const query = isAdmin && selectedUserId !== currentUserId ? `?user_id=${selectedUserId}` : "";
        const response = await apiFetch(`/profile${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "No fue posible cargar el perfil.");
        setProfile(data);

        const unreadMessages = (data.messages ?? []).filter(
          (message) => message.recipient_user_id === currentUserId && !message.read_at
        );
        await Promise.all(
          unreadMessages.map((message) =>
            apiFetch(`/profile/messages/${message.id}/read`, {
              method: "PATCH"
            }).catch(() => null)
          )
        );
      } catch (profileError) {
        setError(profileError.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [apiFetch, currentUserId, isAdmin, selectedUserId]
  );

  useEffect(() => {
    setTargetUserId(currentUserId ?? "");
  }, [currentUserId]);

  useEffect(() => {
    loadProfile();
    const timer = window.setInterval(() => loadProfile({ silent: true }), 10000);
    return () => window.clearInterval(timer);
  }, [loadProfile]);

  const bounds = useMemo(() => {
    const points = profile?.points ?? [];
    if (!points.length) return null;
    return points.reduce(
      (acc, point) => ({
        minLat: Math.min(acc.minLat, point.latitude),
        maxLat: Math.max(acc.maxLat, point.latitude),
        minLng: Math.min(acc.minLng, point.longitude),
        maxLng: Math.max(acc.maxLng, point.longitude)
      }),
      {
        minLat: points[0].latitude,
        maxLat: points[0].latitude,
        minLng: points[0].longitude,
        maxLng: points[0].longitude
      }
    );
  }, [profile?.points]);

  const messages = useMemo(() => [...(profile?.messages ?? [])].reverse(), [profile?.messages]);
  const latestAdminMessage = useMemo(
    () => [...(profile?.messages ?? [])].find((message) => message.sender_role === "admin" && message.sender_user_id !== currentUserId),
    [currentUserId, profile?.messages]
  );
  const unreadOwnMessages = useMemo(
    () => (profile?.messages ?? []).filter((message) => message.recipient_user_id === currentUserId && !message.read_at).length,
    [currentUserId, profile?.messages]
  );

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
      setMessageBody("");
      setReplyBody("");
      await loadProfile({ silent: true });
      showAlert?.("Mensaje enviado.");
    } catch (sendError) {
      showAlert?.(sendError.message);
    } finally {
      setSavingMessage(false);
    }
  };

  const handleAwardAchievement = async (event) => {
    event.preventDefault();
    if (!isAdmin || !achievementForm.title.trim()) return;

    setSavingAchievement(true);
    try {
      const response = await apiFetch("/profile/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId,
          title: achievementForm.title,
          description: achievementForm.description,
          icon: "success",
          badge_color: "#1576d1"
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No fue posible asignar el logro.");
      setAchievementForm({ title: "", description: "" });
      await loadProfile({ silent: true });
      showAlert?.("Logro asignado.");
    } catch (achievementError) {
      showAlert?.(achievementError.message);
    } finally {
      setSavingAchievement(false);
    }
  };

  if (loading && !profile) {
    return <div className="module-loading-state">Cargando mi perfil...</div>;
  }

  if (error && !profile) {
    return (
      <section className="profile-workspace">
        <div className="profile-empty-state">
          <Bell />
          <h2>No se pudo cargar el perfil</h2>
          <p>{error}</p>
          <button type="button" onClick={() => loadProfile()}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  const stats = profile?.stats ?? {};
  const user = profile?.user ?? session?.user ?? {};

  return (
    <section className="profile-workspace">
      <motion.div className="profile-hero" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="profile-avatar" aria-hidden="true">
          {safeText(user.full_name, "U").slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-hero-copy">
          <p className="sheet-kicker">Mi perfil</p>
          <h2>{safeText(user.full_name, "Usuario")}</h2>
          <span>{safeText(user.role, "operador")} · {safeText(user.email, "sin correo")}</span>
        </div>
        <div className="profile-live-badge">
          <Radio size={16} />
          En tiempo real
        </div>
      </motion.div>

      {isAdmin ? (
        <div className="profile-admin-switcher">
          <label htmlFor="profile-user-select">Ver perfil de</label>
          <select id="profile-user-select" value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
            {safeUsers.map((userOption) => (
              <option key={userOption.id} value={userOption.id}>
                {userOption.full_name} · {userOption.role}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="profile-stat-grid">
        <StatCard icon={Target} label="Puntos censados" value={formatNumber(stats.points_total)} detail={`${formatNumber(stats.points_today)} registrados hoy`} />
        <StatCard icon={Clock} label="Horas trabajadas" value={formatMinutes(stats.worked_minutes_estimated)} detail={`${formatNumber(stats.worked_days)} jornadas estimadas`} tone="is-green" />
        <StatCard icon={Timer} label="Tiempo en pantalla" value={formatMinutes(stats.screen_minutes_estimated)} detail="Sesion activa estimada" tone="is-amber" />
        <StatCard icon={Zap} label="Rendimiento" value={`${formatNumber(stats.performance_score)}%`} detail={`${formatNumber(stats.approved_points)} puntos validados`} tone="is-blue" />
      </div>

      <div className="profile-main-grid">
        <motion.article className="profile-map-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="profile-panel-head">
            <div>
              <p className="sheet-kicker">Zonas trabajadas</p>
              <h3><Navigation size={20} />Mapa de actividad</h3>
            </div>
            <span>{formatNumber(stats.zones_total)} zonas</span>
          </div>
          <div className="profile-mini-map">
            {(profile?.points ?? []).length ? (
              profile.points.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  className={`profile-map-dot status-${point.validation_status}`}
                  style={{
                    ...getPointPosition(point, bounds),
                    background: point.marker_color || "#1576d1"
                  }}
                  title={`${safeText(point.zone_label)} · ${formatDateTime(point.created_at)}`}
                >
                  <MapPin size={13} />
                </button>
              ))
            ) : (
              <div className="profile-map-empty">
                <MapPin />
                <strong>Sin puntos GPS</strong>
                <span>Los puntos censados apareceran aqui.</span>
              </div>
            )}
          </div>
          <div className="profile-zone-list">
            {(profile?.zones ?? []).slice(0, 8).map((zone) => (
              <div key={zone.zone} className="profile-zone-item">
                <span><MapPin size={15} />{safeText(zone.zone)}</span>
                <strong>{formatNumber(zone.total)}</strong>
              </div>
            ))}
          </div>
        </motion.article>

        <motion.article className="profile-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <div className="profile-panel-head">
            <div>
              <p className="sheet-kicker">Mensajes</p>
              <h3><MessageSquare size={20} />Notificaciones</h3>
            </div>
            <AnimatePresence>
              {unreadOwnMessages ? (
                <motion.span className="profile-notification-pill" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                  <Bell size={14} />
                  {unreadOwnMessages}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="profile-message-list">
            {messages.length ? (
              messages.map((message) => (
                <div key={message.id} className={`profile-message ${message.sender_user_id === currentUserId ? "is-own" : ""}`}>
                  <strong>{message.sender_user_id === currentUserId ? "Tu" : message.sender_name}</strong>
                  <p>{message.body}</p>
                  <small>{formatDateTime(message.created_at)}</small>
                </div>
              ))
            ) : (
              <div className="profile-inline-empty">
                <MessageSquare />
                <span>Sin mensajes todavia.</span>
              </div>
            )}
          </div>
          <form className="profile-message-form" onSubmit={handleSendMessage}>
            <textarea
              value={isAdmin ? messageBody : replyBody}
              onChange={(event) => (isAdmin ? setMessageBody(event.target.value) : setReplyBody(event.target.value))}
              placeholder={isAdmin ? "Enviar mensaje al usuario..." : latestAdminMessage ? "Responder a administracion..." : "Espera un mensaje de administracion para responder"}
              disabled={!isAdmin && !latestAdminMessage}
            />
            <button type="submit" disabled={savingMessage || (!isAdmin && !latestAdminMessage)}>
              <Send size={16} />
              {savingMessage ? "Enviando..." : isAdmin ? "Enviar" : "Responder"}
            </button>
          </form>
        </motion.article>
      </div>

      <div className="profile-achievement-grid">
        <article className="profile-panel">
          <div className="profile-panel-head">
            <div>
              <p className="sheet-kicker">Logros</p>
              <h3><Medal size={20} />Reconocimientos</h3>
            </div>
            <span>{formatNumber(profile?.achievements?.length ?? 0)}</span>
          </div>
          <div className="profile-achievement-list">
            {(profile?.achievements ?? []).length ? (
              profile.achievements.map((achievement) => (
                <motion.div key={achievement.id} className="profile-achievement" whileHover={{ scale: 1.01 }}>
                  <span style={{ background: achievement.badge_color || "#1576d1" }}>
                    <Award size={18} />
                  </span>
                  <div>
                    <strong>{achievement.title}</strong>
                    <p>{safeText(achievement.description, "Reconocimiento asignado por administracion.")}</p>
                    <small>{formatDateTime(achievement.awarded_at)}</small>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="profile-inline-empty">
                <Sparkles />
                <span>Sin logros asignados.</span>
              </div>
            )}
          </div>
        </article>

        {isAdmin ? (
          <article className="profile-panel">
            <div className="profile-panel-head">
              <div>
                <p className="sheet-kicker">Administracion</p>
                <h3><UserRound size={20} />Asignar logro</h3>
              </div>
            </div>
            <form className="profile-achievement-form" onSubmit={handleAwardAchievement}>
              <input
                value={achievementForm.title}
                onChange={(event) => setAchievementForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Nombre del logro"
              />
              <textarea
                value={achievementForm.description}
                onChange={(event) => setAchievementForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Detalle breve"
              />
              <button type="submit" disabled={savingAchievement}>
                <Award size={16} />
                {savingAchievement ? "Asignando..." : "Asignar logro"}
              </button>
            </form>
          </article>
        ) : null}
      </div>
    </section>
  );
}
