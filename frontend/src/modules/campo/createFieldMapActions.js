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

export function createFieldMapActions({
  apiFetch,
  clearSession,
  editingMapPointId,
  isAdmin,
  mapDraft,
  safeBarrioCodes,
  safeMapPoints,
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
    setMapLocationHelp("Solicitando permiso de ubicacion. En iPhone confirma el permiso de Safari si aparece.");

    try {
      let position;
      try {
        position = await getCurrentPosition(GEOLOCATION_OPTIONS);
      } catch (error) {
        if (error?.code !== error?.TIMEOUT && error?.code !== 3) {
          throw error;
        }
        setMapLocationHelp("El GPS tardo en responder; intentando lectura compatible para iPhone...");
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
    setEditingMapPointId(null);
    setMapLocationHelp("");
    setMapDraft({ ...emptyMapDraft });
  };

  const handleSaveMapPoint = async (event) => {
    event.preventDefault();

    const latitude = Number(mapDraft.latitude);
    const longitude = Number(mapDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      const message = "Define la ubicacion del punto usando GPS, tocando el mapa o escribiendo latitud y longitud.";
      setMapLocationHelp(message);
      showAlert(message);
      return;
    }

    setSavingMapPoint(true);

    try {
      const isEditing = Boolean(editingMapPointId);
      const editingPoint = safeMapPoints.find((point) => point.id === editingMapPointId) ?? null;
      const markerColor = getDefaultMapPointColor(mapDraft.point_type, editingPoint?.marker_color || "#1576d1");
      const enrichedMapDraft = withReferenceBarrioPrefix(mapDraft, safeBarrioCodes);
      const response = await apiFetch(isEditing ? `/map-points/${editingMapPointId}` : "/map-points", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy_meters: Number(mapDraft.accuracy_meters) || null,
          point_type: enrichedMapDraft.point_type,
          description: enrichedMapDraft.description,
          reference: enrichedMapDraft.reference,
          housing_units: enrichedMapDraft.housing_units,
          marker_color: markerColor,
          is_terminal_point: Boolean(editingPoint?.is_terminal_point)
        })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible guardar el punto.");
      }

      setMapPoints((current) =>
        isEditing ? current.map((point) => (point.id === data.id ? data : point)) : [data, ...current]
      );
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
      showAlert(error.message || "No fue posible guardar el punto.");
    } finally {
      setSavingMapPoint(false);
    }
  };

  const handleDeleteMapPoint = async (pointId) => {
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
    const point = visibleMapPoints.find((item) => item.id === pointId) ?? safeMapPoints.find((item) => item.id === pointId);
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
    const point = visibleMapPoints.find((item) => item.id === pointId) ?? safeMapPoints.find((item) => item.id === pointId);
    if (!point) return;

    setSelectedMapPointId(point.id);
    setEditingMapPointId(point.id);
    setMapLocationHelp("");
    setMapDraft(withReferenceBarrioPrefix({
      latitude: formatCoordinate(point.latitude),
      longitude: formatCoordinate(point.longitude),
      accuracy_meters: point.accuracy_meters ?? "",
      point_type: point.point_type || "caja_registro",
      description: point.description || "",
      reference: point.reference_note || "",
      marker_color: point.marker_color || "#1576d1"
    }, safeBarrioCodes));
    setMapStatus("Edicion activa");
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
    handleCopyCoordinates
  };
}
