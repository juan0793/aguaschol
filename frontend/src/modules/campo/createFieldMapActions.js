import { useCallback } from "react";
import {
  GEOLOCATION_FALLBACK_OPTIONS,
  GEOLOCATION_OPTIONS,
  getCurrentPosition,
  getGeolocationErrorMessage,
  getGeolocationUnavailableMessage,
  isLocalSecureHost
} from "../../utils/geolocation";
import { buildExternalMapUrl, formatCoordinate } from "../../utils/mapField";
import { emptyMapDraft } from "../../constants/formsAndUi";
import { getDefaultMapPointColor, normalizeHousingUnitsInput } from "../../utils/mapReport";
import { getMapDiaryDateKey, syncMapDiaryGroups } from "../../utils/datesAndBusiness";
import { getTodayMapDiaryKey } from "../../utils/mapDiary";
import { withReferenceBarrioPrefix } from "../../utils/barrioCodes";
import { isOutboxId } from "./mapPointOutbox";
import { clearMapPointEditDraft, loadMapPointEditDraft, saveMapPointEditDraft } from "./mapPointEditRecovery";
import { getPointTypeStyle } from "./pointTypes";

const markerColorFor = (pointType, fallback) => getDefaultMapPointColor(pointType, fallback || getPointTypeStyle(pointType).color);
const isNetworkError = (error) => error instanceof TypeError;
const getSessionStorage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function createFieldMapActions({
  apiFetch,
  clearSession,
  discardPendingMapPoint,
  editingMapPointId,
  enqueueMapPoint,
  outboxPoints = [],
  updatePendingMapPoint,
  isAdmin,
  mapDraft,
  safeBarrioCodes,
  safeMapPoints,
  session,
  setEditingMapPointId,
  setLocatingUser,
  setMapDiaryDateKey,
  setMapDiaryGroupsSummary,
  setMapDraft,
  setMapFocusRequest,
  setMapLocationHelp,
  setMapPoints,
  setMapStatus,
  setSavingMapPoint,
  setSelectedMapPointId,
  showAlert,
  visibleMapPoints
}) {
  const findPoint = (pointId) =>
    outboxPoints.find((item) => item.id === pointId)
    ?? visibleMapPoints.find((item) => item.id === pointId)
    ?? safeMapPoints.find((item) => item.id === pointId);

  const handleMapDraftChange = (event) => {
    const { name, value } = event.target;
    if (["latitude", "longitude"].includes(name) && value) {
      setMapLocationHelp("");
    }
    setMapDraft((current) =>
      withReferenceBarrioPrefix(
        {
          ...current,
          [name]: name === "housing_units" ? normalizeHousingUnitsInput(value) : value
        },
        safeBarrioCodes
      )
    );
  };

  const adjustMapDraftHousingUnits = (delta) => {
    setMapDraft((current) => ({
      ...current,
      housing_units: normalizeHousingUnitsInput(Number(current.housing_units || 1) + delta)
    }));
  };

  const handleMapDraftFromMap = useCallback((updater) => {
    setMapLocationHelp("");
    setMapStatus("Punto marcado");
    setMapDraft(updater);
  }, []);

  const handleLocateUser = async () => {
    if (!navigator.geolocation) {
      const message = getGeolocationUnavailableMessage();
      setMapLocationHelp(message);
      showAlert(message);
      setMapStatus("Sin GPS");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext && !isLocalSecureHost()) {
      const message = getGeolocationUnavailableMessage();
      setMapLocationHelp(message);
      showAlert(message);
      setMapStatus("HTTPS requerido");
      return;
    }

    setLocatingUser(true);
    setMapStatus("Buscando");
    setMapLocationHelp("Solicitando permiso de ubicación. En iPhone confirma el permiso de Safari si aparece.");

    try {
      let position;
      try {
        position = await getCurrentPosition(GEOLOCATION_OPTIONS);
      } catch (error) {
        if (error?.code !== error?.TIMEOUT && error?.code !== 3) {
          throw error;
        }
        setMapLocationHelp("El GPS tardó en responder; intentando una lectura compatible con iPhone…");
        position = await getCurrentPosition(GEOLOCATION_FALLBACK_OPTIONS);
      }

        const nextDraft = {
          latitude: Number(position.coords.latitude).toFixed(6),
          longitude: Number(position.coords.longitude).toFixed(6),
          accuracy_meters: Math.round(position.coords.accuracy || 0),
          point_type: mapDraft.point_type,
          description: mapDraft.description,
          reference: mapDraft.reference
        };

        setMapDraft(withReferenceBarrioPrefix(nextDraft, safeBarrioCodes));
        setMapStatus("GPS listo");
        setMapLocationHelp("");
        setMapFocusRequest({
          latitude: Number(nextDraft.latitude),
          longitude: Number(nextDraft.longitude),
          zoom: 18.5,
          key: Date.now()
        });
    } catch (error) {
      const message = getGeolocationErrorMessage(error);
      setMapStatus(error?.code === 1 ? "Sin permiso" : "GPS pendiente");
      setMapLocationHelp(message);
      showAlert(message);
    } finally {
      setLocatingUser(false);
    }
  };

  const resetMapDraft = () => {
    if (editingMapPointId && !isOutboxId(editingMapPointId)) {
      clearMapPointEditDraft(getSessionStorage(), session?.user?.id, editingMapPointId);
    }
    setEditingMapPointId(null);
    setMapLocationHelp("");
    setMapDraft({ ...emptyMapDraft });
  };

  const handleSaveMapPoint = async (event) => {
    event.preventDefault();

    const latitude = Number(mapDraft.latitude);
    const longitude = Number(mapDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      const message = "Define la ubicación del punto con GPS, moviendo el mapa o escribiendo latitud y longitud.";
      setMapLocationHelp(message);
      showAlert(message);
      return;
    }

    setSavingMapPoint(true);
    let fields;

    try {
      const isEditing = Boolean(editingMapPointId);
      const editingPoint = safeMapPoints.find((point) => point.id === editingMapPointId) ?? null;
      const markerColor = markerColorFor(mapDraft.point_type, editingPoint?.marker_color);
      const enrichedMapDraft = withReferenceBarrioPrefix(mapDraft, safeBarrioCodes);
      fields = {
        latitude,
        longitude,
        accuracy_meters: Number(mapDraft.accuracy_meters) || null,
        point_type: enrichedMapDraft.point_type,
        description: enrichedMapDraft.description,
        reference: enrichedMapDraft.reference,
        housing_units: enrichedMapDraft.housing_units,
        marker_color: markerColor,
        is_terminal_point: Boolean(editingPoint?.is_terminal_point)
      };

      // Punto todavía en el celular: se corrige ahí y sale con el próximo envío.
      if (isEditing && isOutboxId(editingMapPointId)) {
        const updated = await updatePendingMapPoint?.(editingMapPointId, fields);
        if (!updated) {
          showAlert("No se pudieron guardar los detalles en el celular. El formulario conserva tus cambios; inténtalo de nuevo.");
          return;
        }
        setEditingMapPointId(null);
        setMapStatus("Detalles guardados");
        showAlert("Detalles guardados en el celular; se enviarán con el punto.");
        resetMapDraft();
        return;
      }

      // Punto nuevo: siempre pasa por la cola, así no se pierde si no hay señal.
      if (!isEditing && enqueueMapPoint) {
        const { item, stored } = await enqueueMapPoint(fields);
        if (!stored) {
          showAlert("El celular no pudo guardar este punto. Libera espacio e inténtalo de nuevo; el formulario conserva tus datos.");
          return;
        }
        setSelectedMapPointId(item.localId);
        setMapDiaryDateKey(getTodayMapDiaryKey());
        setMapStatus("Punto guardado");
        showAlert("Punto guardado. Se envía solo cuando hay señal.");
        resetMapDraft();
        return;
      }

      const response = await apiFetch(isEditing ? `/map-points/${editingMapPointId}` : "/map-points", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(fields)
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesión venció. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible guardar el punto.");
      }

      setMapPoints((current) =>
        isEditing ? current.map((point) => (point.id === data.id ? data : point)) : [data, ...current]
      );
      if (isEditing) clearMapPointEditDraft(getSessionStorage(), session?.user?.id, editingMapPointId);
      setMapDiaryGroupsSummary((current) => syncMapDiaryGroups(current, data, editingPoint));
      const savedDateKey = getMapDiaryDateKey(data.diary_date || data.created_at) || getTodayMapDiaryKey();
      setMapDiaryDateKey(savedDateKey);
      setSelectedMapPointId(data.id);
      setEditingMapPointId(null);
      setMapStatus(isEditing ? "Punto actualizado" : "Punto guardado");
      setMapFocusRequest({
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        zoom: 19,
        key: Date.now()
      });
      showAlert(isEditing ? "Punto de campo actualizado." : "Punto de campo guardado correctamente.");
      resetMapDraft();
    } catch (error) {
      if (isNetworkError(error) && editingMapPointId && !isOutboxId(editingMapPointId)) {
        const saved = saveMapPointEditDraft(getSessionStorage(), session?.user?.id, editingMapPointId, fields ?? mapDraft);
        showAlert(saved
          ? "Sin señal: no se confirmó el guardado. El borrador quedó en esta pestaña; vuelve a abrir este punto para recuperarlo y reintenta con conexión."
          : "No se confirmó el guardado. El formulario conserva tus datos; vuelve a intentarlo con conexión y no lo cierres.");
      } else {
        showAlert(error.message || "No fue posible guardar el punto.");
      }
    } finally {
      setSavingMapPoint(false);
    }
  };

  // Marca un punto con solo tipo y ubicación (la mira del visor). Queda en el
  // celular al instante y se envía cuando hay señal; los detalles van después.
  const handleMarkPoint = async ({ latitude, longitude, accuracy = null, pointType }) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      showAlert("No hay una ubicación para marcar. Usa tu ubicación o mueve el mapa.");
      return null;
    }
    const { item, stored } = await enqueueMapPoint({
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      accuracy_meters: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
      point_type: pointType,
      description: "",
      reference: "",
      housing_units: 1,
      marker_color: markerColorFor(pointType),
      is_terminal_point: false
    });
    if (!stored) {
      showAlert("El celular no pudo guardar el punto. Libera espacio e inténtalo de nuevo.");
      return null;
    }
    setSelectedMapPointId(item.localId);
    setMapDiaryDateKey(getTodayMapDiaryKey());
    setMapStatus("Punto marcado");
    return item.localId;
  };

  const handleDeleteMapPoint = async (pointId) => {
    if (isOutboxId(pointId)) {
      if (!(await discardPendingMapPoint?.(pointId))) {
        showAlert("No se pudo descartar el punto guardado en el celular. Inténtalo de nuevo.");
        return false;
      }
      setSelectedMapPointId((current) => (current === pointId ? null : current));
      setEditingMapPointId((current) => (current === pointId ? null : current));
      return true;
    }
    if (!isAdmin) {
      showAlert("Solo administradores pueden eliminar puntos guardados.");
      return;
    }

    const deletedPoint = safeMapPoints.find((point) => point.id === pointId) ?? null;
    try {
      const response = await apiFetch(`/map-points/${pointId}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No fue posible eliminar el punto.");
      }

      setMapPoints((current) => current.filter((point) => point.id !== pointId));
      setMapDiaryGroupsSummary((current) => syncMapDiaryGroups(current, null, deletedPoint));
      setSelectedMapPointId((current) => (current === pointId ? null : current));
      showAlert("Punto eliminado del mapa.");
    } catch (error) {
      showAlert(error.message || "No fue posible eliminar el punto.");
    }
  };

  const handleSelectMapPoint = (pointId) => {
    setSelectedMapPointId(pointId);
    const point = findPoint(pointId);
    if (!point) return;

    setMapFocusRequest({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      zoom: 18.5,
      key: Date.now()
    });
  };

  const handleEditMapPoint = (pointId, event) => {
    event?.stopPropagation();
    const point = findPoint(pointId);
    if (!point) return;

    setSelectedMapPointId(point.id);
    setEditingMapPointId(point.id);
    setMapLocationHelp("");
    const recovery = loadMapPointEditDraft(getSessionStorage(), session?.user?.id, point.id);
    setMapDraft(withReferenceBarrioPrefix(recovery ?? {
      latitude: formatCoordinate(point.latitude),
      longitude: formatCoordinate(point.longitude),
      accuracy_meters: point.accuracy_meters ?? "",
      point_type: point.point_type || "caja_registro",
      description: point.description || "",
      reference: point.reference_note || "",
      housing_units: point.housing_units ?? 1,
      marker_color: point.marker_color || "#1576d1"
    }, safeBarrioCodes));
    setMapStatus("Edición activa");
    setMapFocusRequest({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      zoom: 19,
      key: Date.now()
    });
  };

  const handleOpenPointInMaps = (point, event) => {
    event?.stopPropagation();
    const url = buildExternalMapUrl(point.latitude, point.longitude);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyCoordinates = async (point, event) => {
    event?.stopPropagation();

    try {
      await navigator.clipboard.writeText(`${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}`);
      showAlert("Coordenadas copiadas.");
    } catch {
      showAlert("No fue posible copiar las coordenadas.");
    }
  };

  return {
    handleMapDraftChange,
    adjustMapDraftHousingUnits,
    handleMapDraftFromMap,
    handleLocateUser,
    resetMapDraft,
    handleSaveMapPoint,
    handleDeleteMapPoint,
    handleSelectMapPoint,
    handleEditMapPoint,
    handleOpenPointInMaps,
    handleCopyCoordinates,
    handleMarkPoint
  };
}
