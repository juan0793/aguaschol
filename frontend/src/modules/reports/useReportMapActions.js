import { ALERT_MAP_POINT_TYPE, COMMERCIAL_MAP_POINT_TYPE, emptyMapReportDraft } from "../../constants/formsAndUi";
import { buildMapReportDraftFromPoint } from "../../utils/mapField";
import { fileToDataUrl, optimizeImageForUpload } from "../../utils/imageUtils";
import {
  getDefaultMapPointColor,
  getMapReportTechnicians,
  normalizeHousingUnitsInput,
  normalizeMapReportStaff
} from "../../utils/mapReport";
import { getMapDiaryDateKey, syncMapDiaryGroups } from "../../utils/datesAndBusiness";
import { withReferenceBarrioPrefix } from "../../utils/barrioCodes";

export function useReportMapActions({
  apiFetch,
  clearSession,
  editingReportMapPointId,
  reportMapCaptureRef,
  reportMapDraft,
  safeBarrioCodes,
  safeMapPoints,
  setEditingReportMapPointId,
  setMapDiaryDateKey,
  setMapDiaryGroupsSummary,
  setMapPoints,
  setMapReportSettings,
  setMapReportStaff,
  setReportMapDraft,
  setSavingReportMapPoint,
  showAlert,
  visibleMapPoints
}) {
  const resetReportMapDraft = () => {
    setEditingReportMapPointId(null);
    setReportMapDraft({ ...emptyMapReportDraft });
  };

  const handleReportMapDraftChange = (event) => {
    const { name, value, type, checked } = event.target;
    setReportMapDraft((current) =>
      withReferenceBarrioPrefix(
        {
          ...current,
          [name]: type === "checkbox" ? checked : name === "housing_units" ? normalizeHousingUnitsInput(value) : value,
          ...(name === "point_type" && [COMMERCIAL_MAP_POINT_TYPE, ALERT_MAP_POINT_TYPE].includes(value)
            ? { marker_color: getDefaultMapPointColor(value) }
            : {})
        },
        safeBarrioCodes
      )
    );
  };

  const handleMapReportStaffChange = (event) => {
    const { name, value } = event.target;
    setMapReportStaff((current) => normalizeMapReportStaff({
      ...current,
      [name]: value
    }));
  };

  const handleMapReportTechnicianChange = (index, value) => {
    setMapReportStaff((current) => {
      const technicians = getMapReportTechnicians(current);
      technicians[index] = value;
      return normalizeMapReportStaff({
        ...current,
        field_technician_names: technicians
      });
    });
  };

  const addMapReportTechnician = () => {
    setMapReportStaff((current) => normalizeMapReportStaff({
      ...current,
      field_technician_names: [...getMapReportTechnicians(current), ""]
    }));
  };

  const removeMapReportTechnician = (index) => {
    setMapReportStaff((current) => {
      const technicians = getMapReportTechnicians(current);
      if (technicians.length <= 1) return normalizeMapReportStaff(current);
      return normalizeMapReportStaff({
        ...current,
        field_technician_names: technicians.filter((_, itemIndex) => itemIndex !== index)
      });
    });
  };

  const handleMapReportSettingsChange = (event) => {
    const { name, value } = event.target;
    setMapReportSettings((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleMapReportImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showAlert("Selecciona una imagen valida para el mapa.");
      return;
    }

    try {
      const optimizedMap = await optimizeImageForUpload(file);
      const dataUrl = await fileToDataUrl(optimizedMap);
      setMapReportSettings((current) => ({
        ...current,
        map_image_data_url: dataUrl,
        map_image_name: optimizedMap.name
      }));
      showAlert("Mapa adjunto listo para el reporte.");
    } catch (error) {
      showAlert(error.message || "No fue posible preparar el mapa.");
    } finally {
      event.target.value = "";
    }
  };

  const clearMapReportImage = () => {
    setMapReportSettings((current) => ({
      ...current,
      map_image_data_url: "",
      map_image_name: ""
    }));
  };

  const captureReportMapImage = async () => {
    if (!reportMapCaptureRef.current) {
      return "";
    }

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(reportMapCaptureRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#edf3f9",
        scale: Math.min(window.devicePixelRatio || 1, 2)
      });
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  };

  const handleEditReportMapPoint = (pointId) => {
    const point = visibleMapPoints.find((item) => item.id === pointId) ?? safeMapPoints.find((item) => item.id === pointId);
    if (!point) {
      return;
    }

    setEditingReportMapPointId(point.id);
    setReportMapDraft(withReferenceBarrioPrefix(buildMapReportDraftFromPoint(point), safeBarrioCodes));
  };

  const handleSaveReportMapPoint = async (event) => {
    event.preventDefault();

    const latitude = Number(reportMapDraft.latitude);
    const longitude = Number(reportMapDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      showAlert("Define la ubicacion del punto en el mapa o escribiendo las coordenadas.");
      return;
    }

    setSavingReportMapPoint(true);

    try {
      const isEditing = Boolean(editingReportMapPointId);
      const enrichedReportMapDraft = withReferenceBarrioPrefix(reportMapDraft, safeBarrioCodes);
      const response = await apiFetch(isEditing ? `/map-points/${editingReportMapPointId}` : "/map-points", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy_meters: Number(reportMapDraft.accuracy_meters) || null,
          point_type: enrichedReportMapDraft.point_type,
          description: enrichedReportMapDraft.description,
          reference: enrichedReportMapDraft.reference,
          housing_units: enrichedReportMapDraft.housing_units,
          marker_color: enrichedReportMapDraft.marker_color,
          is_terminal_point: enrichedReportMapDraft.is_terminal_point
        })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible guardar el punto del reporte.");
      }

      const previousPoint = safeMapPoints.find((point) => point.id === editingReportMapPointId) ?? null;
      setMapPoints((current) =>
        isEditing ? current.map((point) => (point.id === data.id ? data : point)) : [data, ...current]
      );
      setMapDiaryGroupsSummary((current) => syncMapDiaryGroups(current, data, previousPoint));
      setMapDiaryDateKey(getMapDiaryDateKey(data.created_at) || getMapDiaryDateKey(new Date()));
      setEditingReportMapPointId(null);
      setReportMapDraft({ ...emptyMapReportDraft });
      showAlert(isEditing ? "Punto del reporte actualizado." : "Punto agregado desde reportes de campo.");
    } catch (error) {
      showAlert(error.message || "No fue posible guardar el punto del reporte.");
    } finally {
      setSavingReportMapPoint(false);
    }
  };

  return {
    resetReportMapDraft,
    handleReportMapDraftChange,
    handleMapReportStaffChange,
    handleMapReportTechnicianChange,
    addMapReportTechnician,
    removeMapReportTechnician,
    handleMapReportSettingsChange,
    handleMapReportImageChange,
    clearMapReportImage,
    captureReportMapImage,
    handleEditReportMapPoint,
    handleSaveReportMapPoint
  };
}
