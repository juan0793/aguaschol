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
  Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessagesPanel } from "../chat/ChatMessagesPanel.jsx";

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
const PROFILE_REFRESH_INTERVAL_MS = 60000;

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

export default function MyProfileWorkspace({ apiFetch, isAdmin, safeUsers = [], session, showAlert, initialTargetUserId, onTargetUserSelected }) {
  const currentUserId = session?.user?.id;
  const [targetUserId, setTargetUserId] = useState(currentUserId ?? "");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const processedUserIdRef = useRef(null);

  useEffect(() => {
    if (initialTargetUserId && initialTargetUserId !== processedUserIdRef.current) {
      processedUserIdRef.current = initialTargetUserId;
      setTargetUserId(initialTargetUserId);
      onTargetUserSelected?.();
    }
  }, [initialTargetUserId, onTargetUserSelected]);

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
    const timer = window.setInterval(() => loadProfile({ silent: true }), PROFILE_REFRESH_INTERVAL_MS);
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
  const generalMessages = useMemo(() => [...(profile?.general_messages ?? [])].reverse(), [profile?.general_messages]);
  const visibleProfileMapPoints = useMemo(() => (profile?.points ?? []).slice(0, 80), [profile?.points]);
  const recentProfilePoints = useMemo(() => (profile?.points ?? []).slice(0, 5), [profile?.points]);
  const topProfileZone = profile?.zones?.[0] ?? null;
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

  const handleChatMessagesChanged = useCallback(() => {
    loadProfile({ silent: true });
  }, [loadProfile]);

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
        <StatCard icon={Timer} label="Tiempo en pantalla" value={formatMinutes(stats.screen_minutes_estimated)} detail="Sesión activa estimada" tone="is-amber" />
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
              <>
                <div className="profile-map-summary-card">
                  <span>Zona principal</span>
                  <strong>{safeText(topProfileZone?.zone, "Actividad de campo")}</strong>
                  <small>{formatNumber(profile?.points?.length ?? 0)} puntos registrados</small>
                </div>
                {visibleProfileMapPoints.map((point, index) => (
                <button
                  key={point.id}
                    type="button"
                    className={`profile-map-dot status-${point.validation_status} ${index < 8 ? "is-prominent" : ""}`}
                    style={{
                      ...getPointPosition(point, bounds),
                      "--point-color": point.marker_color || "#1576d1"
                    }}
                    title={`${safeText(point.zone_label)} · ${formatDateTime(point.created_at)}`}
                    aria-label={`${safeText(point.zone_label)} registrado el ${formatDateTime(point.created_at)}`}
                  >
                    {index < 8 ? <span>{index + 1}</span> : null}
                  </button>
                ))}
                <div className="profile-map-legend">
                  <span><i />Recientes</span>
                  <span><i className="is-pending" />Pendientes</span>
                </div>
              </>
            ) : (
              <div className="profile-map-empty">
                <MapPin />
                <strong>Sin puntos GPS</strong>
                <span>Los puntos censados aparecerán aquí.</span>
              </div>
            )}
          </div>
          {recentProfilePoints.length ? (
            <div className="profile-recent-points" aria-label="Puntos recientes del perfil">
              {recentProfilePoints.map((point, index) => (
                <div key={`recent-${point.id}`} className="profile-recent-point">
                  <span>{index + 1}</span>
                  <div>
                    <strong>{safeText(point.zone_label)}</strong>
                    <small>{formatDateTime(point.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="profile-zone-list">
            {(profile?.zones ?? []).slice(0, 8).map((zone) => (
              <div key={zone.zone} className="profile-zone-item">
                <span><MapPin size={15} />{safeText(zone.zone)}</span>
                <strong>{formatNumber(zone.total)}</strong>
              </div>
            ))}
          </div>
        </motion.article>

        <ChatMessagesPanel
          apiFetch={apiFetch}
          isAdmin={isAdmin}
          messages={generalMessages}
          safeUsers={safeUsers}
          currentUserId={currentUserId}
          selectedUserId={selectedUserId}
          onUserSelect={setTargetUserId}
          onMessageSent={handleChatMessagesChanged}
          session={session}
          showAlert={showAlert}
          chatChannels={profile?.chat_channels ?? []}
        />
      </div>

      <div className="profile-achievement-grid">
        <article className="profile-panel profile-achievements-panel">
          <div className="profile-panel-head">
            <div>
              <p className="sheet-kicker">Logros</p>
              <h3><Medal size={20} />Logros desbloqueados</h3>
            </div>
            <span>{formatNumber(profile?.achievements?.length ?? 0)}</span>
          </div>
          <div className="profile-achievement-list">
            {(profile?.achievements ?? []).length ? (
              profile.achievements.map((achievement) => (
                <motion.div key={achievement.id} className="profile-achievement" whileHover={{ scale: 1.01 }}>
                  <span style={{ "--achievement-color": achievement.badge_color || "#1576d1" }}>
                    <Award size={14} />
                  </span>
                  <div>
                    <strong>{achievement.title}</strong>
                    <p>{safeText(achievement.description, "Logro desbloqueado automáticamente.")}</p>
                    <small>{formatDateTime(achievement.awarded_at)}</small>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="profile-inline-empty">
                <Sparkles />
                <span>Sin logros desbloqueados todavía.</span>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
