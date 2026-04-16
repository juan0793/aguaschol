import { useEffect, useMemo, useRef, useState } from "react";
import { WS_URL } from "../config/api";
import { Icon } from "./Icon";
import TransportMap from "./TransportMap";

const emptyRouteForm = {
  id: null,
  name: "",
  description: "",
  assigned_user_id: "",
  allowed_deviation_meters: 35,
  route_path: []
};
const SIMULATION_INTERVAL_MS = 1800;
const SIMULATION_STEP_DISTANCE_METERS = 12;

const toNumber = (value) => Number(value ?? 0);

const offsetPoint = (point, latitudeOffset, longitudeOffset) => ({
  latitude: Number((toNumber(point.latitude) + latitudeOffset).toFixed(7)),
  longitude: Number((toNumber(point.longitude) + longitudeOffset).toFixed(7)),
  accuracy: 4
});

const estimateDistanceMeters = (fromPoint, toPoint) => {
  const latitudeDeltaMeters = (toNumber(toPoint.latitude) - toNumber(fromPoint.latitude)) * 111320;
  const averageLatitudeRadians = ((toNumber(fromPoint.latitude) + toNumber(toPoint.latitude)) / 2) * (Math.PI / 180);
  const longitudeDeltaMeters =
    (toNumber(toPoint.longitude) - toNumber(fromPoint.longitude)) * 111320 * Math.cos(averageLatitudeRadians);

  return Math.hypot(latitudeDeltaMeters, longitudeDeltaMeters);
};

const interpolatePoint = (fromPoint, toPoint, progress) => ({
  latitude: Number((toNumber(fromPoint.latitude) + ((toNumber(toPoint.latitude) - toNumber(fromPoint.latitude)) * progress)).toFixed(7)),
  longitude: Number((toNumber(fromPoint.longitude) + ((toNumber(toPoint.longitude) - toNumber(fromPoint.longitude)) * progress)).toFixed(7)),
  accuracy: 4
});

const expandSimulationPath = (points = []) => {
  if (points.length <= 1) {
    return points;
  }

  const expanded = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[index + 1];
    const segmentDistance = estimateDistanceMeters(currentPoint, nextPoint);
    const totalSteps = Math.max(1, Math.ceil(segmentDistance / SIMULATION_STEP_DISTANCE_METERS));

    if (index === 0) {
      expanded.push({
        latitude: Number(toNumber(currentPoint.latitude).toFixed(7)),
        longitude: Number(toNumber(currentPoint.longitude).toFixed(7)),
        accuracy: 4
      });
    }

    for (let step = 1; step <= totalSteps; step += 1) {
      expanded.push(interpolatePoint(currentPoint, nextPoint, step / totalSteps));
    }
  }

  return expanded;
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const formatDeviation = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)} m` : "--";
};

const statusLabel = (status) =>
  (
    {
      draft: "Pendiente",
      active: "En recorrido",
      completed: "Completada"
    }[status] ?? status
  );

function TransportWorkspace({ apiFetch, clearSession, isActive, isAdmin, session, showAlert }) {
  const [routes, setRoutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeForm, setRouteForm] = useState(emptyRouteForm);
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState("Sin seguimiento activo.");
  const [savingPosition, setSavingPosition] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);
  const [socketState, setSocketState] = useState("Desconectado");
  const [simulationMode, setSimulationMode] = useState(null);
  const watchIdRef = useRef(null);
  const lastSentMsRef = useRef(0);
  const socketRef = useRef(null);
  const simulationTimerRef = useRef(null);

  const transportUsers = useMemo(
    () => users.filter((user) => user.role === "transport"),
    [users]
  );
  const selectedRoute = useMemo(
    () => routes.find((route) => Number(route.id) === Number(selectedRouteId)) ?? null,
    [routes, selectedRouteId]
  );
  const plannedPathForMap = useMemo(() => {
    if (isAdmin) {
      return routeForm.route_path ?? [];
    }

    return selectedRoute?.route_path ?? [];
  }, [isAdmin, routeForm.route_path, selectedRoute]);
  const canTrackRoute = !isAdmin && Boolean(selectedRoute);
  const latestPosition = selectedRoute?.latest_position ?? null;

  const handleUnauthorized = () => {
    clearSession?.();
    showAlert?.("La sesion vencio. Ingresa nuevamente.");
  };

  const loadRoutes = async ({ silent = false } = {}) => {
    if (!isActive) return;
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await apiFetch("/transport");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        throw new Error(data.message || "No fue posible cargar las rutas de transporte.");
      }

      const nextRoutes = Array.isArray(data) ? data : [];
      setRoutes(nextRoutes);
      setSelectedRouteId((current) => {
        if (!nextRoutes.length) return null;
        if (current == null) {
          return isAdmin ? null : nextRoutes[0].id;
        }

        return nextRoutes.some((route) => Number(route.id) === Number(current)) ? current : nextRoutes[0].id;
      });
    } catch (error) {
      if (!silent) {
        showAlert?.(error.message || "No fue posible cargar las rutas de transporte.");
      }
      setRoutes([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadUsers = async () => {
    if (!isActive || !isAdmin) return;

    try {
      const response = await apiFetch("/users");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        throw new Error(data.message || "No fue posible cargar los usuarios para transporte.");
      }

      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      showAlert?.(error.message || "No fue posible cargar los usuarios para transporte.");
      setUsers([]);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    loadRoutes();
    if (isAdmin) {
      loadUsers();
    }
  }, [isActive, isAdmin]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const refresh = () => {
      if (document.visibilityState === "visible") {
        loadRoutes({ silent: true });
      }
    };

    const intervalId = window.setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !session?.token || !WS_URL) {
      return undefined;
    }

    const socket = new WebSocket(`${WS_URL}/ws/transport?token=${encodeURIComponent(session.token)}`);
    socketRef.current = socket;
    setSocketState("Conectando...");

    socket.addEventListener("open", () => {
      setSocketState("Tiempo real activo");
    });

    socket.addEventListener("message", (event) => {
      let payload = null;

      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = null;
      }

      if (!payload?.type) {
        return;
      }

      if (payload.type === "transport.connected") {
        setSocketState("Tiempo real activo");
        return;
      }

      if (payload.type === "transport.route_alert") {
        setTrackingMessage("Alerta en vivo: el vehiculo se esta saliendo de la calle autorizada.");
      }

      if (payload.type.startsWith("transport.")) {
        void loadRoutes({ silent: true });
      }
    });

    socket.addEventListener("close", () => {
      setSocketState("Tiempo real desconectado");
    });

    socket.addEventListener("error", () => {
      setSocketState("Tiempo real con falla");
    });

    const pingId = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "transport.ping", ts: Date.now() }));
      }
    }, 20000);

    return () => {
      window.clearInterval(pingId);
      socket.close();
      socketRef.current = null;
    };
  }, [isActive, session?.token]);

  useEffect(() => {
    if (!isAdmin) return;

    if (!selectedRoute) {
      setRouteForm(emptyRouteForm);
      return;
    }

    setRouteForm({
      id: selectedRoute.id,
      name: selectedRoute.name || "",
      description: selectedRoute.description || "",
      assigned_user_id: selectedRoute.assigned_user_id || "",
      allowed_deviation_meters: selectedRoute.allowed_deviation_meters || 35,
      route_path: selectedRoute.route_path || []
    });
  }, [isAdmin, selectedRoute]);

  useEffect(() => () => {
    if (watchIdRef.current != null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simulationTimerRef.current != null) {
      window.clearTimeout(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setSimulationMode(null);
    if (simulationTimerRef.current != null) {
      window.clearTimeout(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
  }, [selectedRouteId]);

  const handleNewRoute = () => {
    setSelectedRouteId(null);
    setRouteForm(emptyRouteForm);
    setDrawEnabled(true);
  };

  const handleRouteFormChange = (event) => {
    const { name, value } = event.target;
    setRouteForm((current) => ({
      ...current,
      [name]: name === "allowed_deviation_meters" ? Number(value) : value
    }));
  };

  const handleAddRoutePoint = (point) => {
    setRouteForm((current) => ({
      ...current,
      route_path: [...current.route_path, point]
    }));
  };

  const handleRemoveLastPoint = () => {
    setRouteForm((current) => ({
      ...current,
      route_path: current.route_path.slice(0, -1)
    }));
  };

  const handleClearRoutePath = () => {
    setRouteForm((current) => ({
      ...current,
      route_path: []
    }));
  };

  const handleSaveRoute = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await apiFetch(routeForm.id ? `/transport/${routeForm.id}` : "/transport", {
        method: routeForm.id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(routeForm)
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        throw new Error(data.message || "No fue posible guardar la ruta.");
      }

      await loadRoutes({ silent: true });
      setSelectedRouteId(data.id);
      setDrawEnabled(false);
      showAlert?.(routeForm.id ? "Ruta de transporte actualizada." : "Ruta de transporte creada.");
    } catch (error) {
      showAlert?.(error.message || "No fue posible guardar la ruta.");
    } finally {
      setSaving(false);
    }
  };

  const callRouteAction = async (routeId, action, successMessage) => {
    try {
      const response = await apiFetch(`/transport/${routeId}/${action}`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return null;
        }

        throw new Error(data.message || "No fue posible actualizar la ruta.");
      }

      await loadRoutes({ silent: true });
      if (successMessage) {
        showAlert?.(successMessage);
      }
      return data;
    } catch (error) {
      showAlert?.(error.message || "No fue posible actualizar la ruta.");
      return null;
    }
  };

  const sendPosition = async (coords) => {
    if (!selectedRoute) return;

    setSavingPosition(true);

    try {
      const response = await apiFetch(`/transport/${selectedRoute.id}/positions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy_meters: coords.accuracy ?? coords.accuracy_meters ?? ""
        })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        throw new Error(data.message || "No fue posible enviar la ubicacion actual.");
      }

      lastSentMsRef.current = Date.now();
      setLastSentAt(new Date().toISOString());
      setTrackingMessage(
        data.is_on_route
          ? "Ubicacion enviada. El recorrido sigue dentro de la calle autorizada."
          : `Alerta: el vehiculo se salio ${formatDeviation(data.deviation_meters)} de la ruta.`
      );
      await loadRoutes({ silent: true });
    } catch (error) {
      setTrackingMessage(error.message || "No fue posible enviar la ubicacion.");
      showAlert?.(error.message || "No fue posible enviar la ubicacion.");
    } finally {
      setSavingPosition(false);
    }
  };

  const handleStartTracking = async () => {
    if (!selectedRoute) {
      showAlert?.("Selecciona una ruta asignada antes de iniciar el seguimiento.");
      return;
    }

    const started = await callRouteAction(selectedRoute.id, "start", "Seguimiento de transporte iniciado.");
    if (!started || !navigator.geolocation) {
      if (!navigator.geolocation) {
        showAlert?.("Este dispositivo no permite geolocalizacion.");
      }
      return;
    }

    setTrackingActive(true);
    setTrackingMessage("Seguimiento activo. Enviando ubicaciones del vehiculo...");

    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentMsRef.current < 6000) {
          return;
        }

        sendPosition(position.coords);
      },
      (error) => {
        setTrackingMessage(error.message || "No fue posible leer la ubicacion del dispositivo.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  };

  const handleStopTracking = async () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTrackingActive(false);
    setTrackingMessage("Seguimiento detenido desde el dispositivo.");
  };

  const handleManualPosition = async () => {
    if (!selectedRoute) {
      showAlert?.("Selecciona una ruta para marcar tu ubicacion.");
      return;
    }

    if (!navigator.geolocation) {
      showAlert?.("Este dispositivo no permite geolocalizacion.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        sendPosition(position.coords);
      },
      (error) => {
        showAlert?.(error.message || "No fue posible obtener la ubicacion actual.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
      }
    );
  };

  const stopSimulation = (message = "Simulacion detenida.") => {
    if (simulationTimerRef.current != null) {
      window.clearTimeout(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    setSimulationMode(null);
    setTrackingMessage(message);
  };

  const runSimulation = async (mode) => {
    if (!selectedRoute?.route_path?.length) {
      showAlert?.("La ruta debe tener puntos trazados para poder simular el recorrido.");
      return;
    }

    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const started = await callRouteAction(selectedRoute.id, "start", "Simulacion de transporte iniciada.");
    if (!started) {
      return;
    }

    setTrackingActive(false);
    setSimulationMode(mode);
    setTrackingMessage(
      mode === "off-route"
        ? "Simulacion activa: enviando puntos con desvio para probar la alerta."
        : "Simulacion activa: enviando puntos sobre la calle autorizada."
    );

    const basePath = selectedRoute.route_path.map((point, index) => {
      if (mode !== "off-route") {
        return {
          latitude: toNumber(point.latitude),
          longitude: toNumber(point.longitude),
          accuracy: 4
        };
      }

      const shouldDrift = index >= Math.max(1, Math.floor(selectedRoute.route_path.length / 2));
      return shouldDrift ? offsetPoint(point, 0.00032, 0.00028) : {
        latitude: toNumber(point.latitude),
        longitude: toNumber(point.longitude),
        accuracy: 4
      };
    });
    const simulationPath = expandSimulationPath(basePath);

    let pointIndex = 0;

    const dispatchNextPoint = async () => {
      const point = simulationPath[pointIndex];
      if (!point) {
        stopSimulation("Simulacion completada. Revisa el recorrido pintado en verde.");
        return;
      }

      await sendPosition(point);
      pointIndex += 1;

      if (pointIndex < simulationPath.length) {
        simulationTimerRef.current = window.setTimeout(dispatchNextPoint, SIMULATION_INTERVAL_MS);
        return;
      }

      stopSimulation("Simulacion completada. Revisa el recorrido pintado en verde.");
    };

    if (simulationTimerRef.current != null) {
      window.clearTimeout(simulationTimerRef.current);
    }

    simulationTimerRef.current = window.setTimeout(dispatchNextPoint, 250);
  };

  return (
    <section className="transport-workspace">
      <div className="transport-header">
        <div>
          <p className="sheet-kicker">{isAdmin ? "Control de transporte" : "Operacion en ruta"}</p>
          <h2><Icon name="transport" className="title-icon" />Transporte y recorrido</h2>
          <p className="workspace-title">
            {isAdmin
              ? "Traza la calle permitida, asigna al conductor y observa en tiempo real por donde va pasando el vehiculo."
              : "Sigue tu ruta asignada y comparte la ubicacion del vehiculo para que oficina vea el recorrido en tiempo real."}
          </p>
        </div>
        <div className="transport-header-badges">
          <span className="panel-pill">{routes.length} rutas</span>
          <span className="panel-pill">{socketState}</span>
          <span className={`panel-pill ${selectedRoute?.is_off_route ? "is-danger" : ""}`}>
            {selectedRoute ? statusLabel(selectedRoute.status) : "Sin seleccion"}
          </span>
        </div>
      </div>

      <div className="transport-layout">
        <aside className="transport-sidebar">
          <div className="transport-route-list-head">
            <h3>Rutas registradas</h3>
            {isAdmin ? (
              <button type="button" className="button-secondary" onClick={handleNewRoute}>
                <Icon name="plus" />
                Nueva ruta
              </button>
            ) : null}
          </div>

          <div className="transport-route-list">
            {loading ? (
              <div className="empty-state">
                <h3>Cargando transporte</h3>
                <p>Estamos consultando las rutas y el recorrido del vehiculo.</p>
              </div>
            ) : routes.length ? (
              routes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  className={`transport-route-card ${Number(selectedRouteId) === Number(route.id) ? "is-active" : ""} ${route.is_off_route ? "is-alert" : ""}`}
                  onClick={() => setSelectedRouteId(route.id)}
                >
                  <div className="transport-route-card-top">
                    <strong>{route.name}</strong>
                    <span className="record-badge">{statusLabel(route.status)}</span>
                  </div>
                  <p>{route.description || "Sin descripcion operativa."}</p>
                  <small>
                    {route.assigned_user_name || "Sin conductor asignado"} · {route.tracked_path?.length ?? 0} puntos
                  </small>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <h3>Sin rutas de transporte</h3>
                <p>{isAdmin ? "Crea la primera calle autorizada para el recorrido." : "Todavia no te han asignado una ruta."}</p>
              </div>
            )}
          </div>
        </aside>

        <div className="transport-main">
          {isAdmin ? (
            <form className="sheet transport-form-card" onSubmit={handleSaveRoute}>
              <div className="admin-section-head">
                <div>
                  <p className="sheet-kicker">Configuracion operativa</p>
                  <h3>{routeForm.id ? "Editar calle autorizada" : "Nueva calle autorizada"}</h3>
                </div>
                <span className="panel-pill">{routeForm.route_path.length} puntos</span>
              </div>
              <div className="form-grid">
                <label>
                  <span>Nombre de ruta</span>
                  <input name="name" value={routeForm.name} onChange={handleRouteFormChange} placeholder="Ej. Recoleccion colonia El Centro" />
                </label>
                <label>
                  <span>Conductor asignado</span>
                  <select name="assigned_user_id" value={routeForm.assigned_user_id} onChange={handleRouteFormChange}>
                    <option value="">Sin asignar</option>
                    {transportUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.full_name || user.username}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Tolerancia de desvio (m)</span>
                  <input
                    name="allowed_deviation_meters"
                    type="number"
                    min="5"
                    max="250"
                    value={routeForm.allowed_deviation_meters}
                    onChange={handleRouteFormChange}
                  />
                </label>
                <label className="transport-form-span">
                  <span>Descripcion</span>
                  <textarea
                    name="description"
                    value={routeForm.description}
                    onChange={handleRouteFormChange}
                    rows="3"
                    placeholder="Describe la colonia, calle o tramo que el camion debe cubrir."
                  />
                </label>
              </div>
              <div className="transport-form-actions">
                <button type="button" className={drawEnabled ? "" : "button-secondary"} onClick={() => setDrawEnabled((current) => !current)}>
                  <Icon name="map" />
                  {drawEnabled ? "Dejar de trazar" : "Trazar calle"}
                </button>
                <button type="button" className="button-secondary" onClick={handleRemoveLastPoint}>
                  <Icon name="arrowLeft" />
                  Quitar ultimo punto
                </button>
                <button type="button" className="button-secondary" onClick={handleClearRoutePath}>
                  <Icon name="refresh" />
                  Limpiar trazo
                </button>
                <button type="submit" disabled={saving}>
                  <Icon name="success" />
                  {saving ? "Guardando..." : routeForm.id ? "Actualizar ruta" : "Guardar ruta"}
                </button>
              </div>
            </form>
          ) : (
            <article className="preview-panel transport-control-card">
              <div className="admin-section-head">
                <div>
                  <p className="sheet-kicker">Seguimiento del vehiculo</p>
                  <h3>{selectedRoute?.name || "Sin ruta asignada"}</h3>
                </div>
                <span className={`panel-pill ${selectedRoute?.is_off_route ? "is-danger" : ""}`}>
                  {selectedRoute ? statusLabel(selectedRoute.status) : "Pendiente"}
                </span>
              </div>
              <p className="workspace-title">{selectedRoute?.description || "Cuando te asignen una ruta la veras aqui con su calle autorizada."}</p>
              <div className="transport-form-actions">
                <button type="button" onClick={handleStartTracking} disabled={!canTrackRoute || trackingActive}>
                  <Icon name="transport" />
                  Iniciar seguimiento
                </button>
                <button type="button" className="button-secondary" onClick={handleManualPosition} disabled={!canTrackRoute || savingPosition}>
                  <Icon name="map" />
                  Marcar mi ubicacion
                </button>
                <button type="button" className="button-secondary" onClick={handleStopTracking} disabled={!trackingActive}>
                  <Icon name="warning" />
                  Detener seguimiento
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => callRouteAction(selectedRoute.id, "complete", "Ruta marcada como completada.")}
                  disabled={!selectedRoute}
                >
                  <Icon name="success" />
                  Cerrar recorrido
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => runSimulation("on-route")}
                  disabled={!selectedRoute || simulationMode != null || savingPosition}
                >
                  <Icon name="map" />
                  Simular ruta
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => runSimulation("off-route")}
                  disabled={!selectedRoute || simulationMode != null || savingPosition}
                >
                  <Icon name="warning" />
                  Simular desvio
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => stopSimulation("Simulacion detenida manualmente.")}
                  disabled={simulationMode == null}
                >
                  <Icon name="refresh" />
                  Detener simulacion
                </button>
              </div>
              <p className="helper-text">{trackingMessage}</p>
              <p className="helper-text">Ultimo envio: {formatDateTime(lastSentAt)}</p>
              <p className="helper-text">Canal en vivo: {socketState}</p>
              <p className="helper-text">
                Pruebas desde oficina: usa "Simular ruta" para mover el vehiculo sobre la calle y "Simular desvio" para forzar alerta.
              </p>
            </article>
          )}

          <article className="preview-panel transport-map-card">
            <div className="admin-section-head">
              <div>
                <p className="sheet-kicker">Monitoreo en tiempo real</p>
                <h3>{selectedRoute?.name || "Mapa de transporte"}</h3>
              </div>
              <span className="panel-pill">
                {selectedRoute?.latest_position ? `Ultimo reporte ${formatDateTime(selectedRoute.latest_position.captured_at)}` : "Sin reportes"}
              </span>
            </div>
            <TransportMap
              drawEnabled={drawEnabled}
              editable={isAdmin}
              focusKey={isAdmin ? `admin:${selectedRoute?.id ?? routeForm.id ?? "new"}` : `transport:${selectedRoute?.id ?? "none"}`}
              latestPosition={selectedRoute?.latest_position ?? null}
              onMapAddPoint={handleAddRoutePoint}
              plannedPath={plannedPathForMap}
              trackedPath={selectedRoute?.tracked_path ?? []}
            />
          </article>

          <article className="preview-panel transport-summary-card">
            <div className="transport-summary-grid">
              <div className="transport-summary-item">
                <span>Conductor</span>
                <strong>{selectedRoute?.assigned_user_name || session?.user?.full_name || "--"}</strong>
              </div>
              <div className="transport-summary-item">
                <span>Desvio maximo</span>
                <strong>{selectedRoute ? `${selectedRoute.allowed_deviation_meters} m` : "--"}</strong>
              </div>
              <div className="transport-summary-item">
                <span>Puntos reportados</span>
                <strong>{selectedRoute?.tracked_path?.length ?? 0}</strong>
              </div>
              <div className="transport-summary-item">
                <span>Alertas</span>
                <strong>{selectedRoute?.off_route_count ?? 0}</strong>
              </div>
            </div>

            {selectedRoute ? (
              <div className={`transport-live-banner ${selectedRoute.is_off_route ? "is-alert" : "is-ok"}`}>
                <span className="transport-live-icon"><Icon name={selectedRoute.is_off_route ? "warning" : "success"} /></span>
                <div>
                  <strong>
                    {selectedRoute.is_off_route
                      ? "El vehiculo se salio de la calle autorizada."
                      : "El vehiculo sigue dentro de la ruta esperada."}
                  </strong>
                  <p>
                    Desvio actual: {formatDeviation(latestPosition?.deviation_meters)} · Ultima lectura: {formatDateTime(latestPosition?.captured_at)}
                  </p>
                </div>
              </div>
            ) : null}
          </article>
        </div>
      </div>
    </section>
  );
}

export default TransportWorkspace;
