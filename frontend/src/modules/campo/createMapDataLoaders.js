import { readJsonResponse } from "../../utils/appShell";

export function createMapDataLoaders({
  apiFetch,
  archivedMapDiaryGroups,
  clearSession,
  isAdmin,
  isAuthenticated,
  mapPointsRequestRef,
  safeMapPoints,
  selectedArchiveMapDiaryGroup,
  selectedArchiveMapDiaryKey,
  selectedRegulatorDiaryKeys,
  setArchiveMapDiaryPoints,
  setLoadingArchiveMapDiaryPoints,
  setLoadingMapContexts,
  setLoadingMapPoints,
  setMapDiaryDateKey,
  setMapDiaryGroupsSummary,
  setMapPointContexts,
  setMapPoints,
  setMapReportPage,
  setMapStatus,
  setRegulatorReportDiaryKeys,
  setSelectedArchiveMapDiaryKey,
  setSelectedMapPointId,
  setShowMapDiaryArchiveModal,
  showAlert
}) {
  const loadMapDiaryGroups = async ({ silent = false } = {}) => {
    if (!isAuthenticated) return;

    try {
      const response = await apiFetch("/map-points/diary-groups");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar las jornadas del mapa.");
      }

      setMapDiaryGroupsSummary(Array.isArray(data.groups) ? data.groups : []);
    } catch (error) {
      if (!silent) {
        showAlert(error.message || "No fue posible cargar las jornadas del mapa.");
      }
    }
  };

  const loadMapPoints = async ({ silent = false, date = "" } = {}) => {
    if (!isAuthenticated) return;

    if (!silent) {
      setLoadingMapPoints(true);
    }

    mapPointsRequestRef.current.controller?.abort();
    const controller = new AbortController();
    const requestId = mapPointsRequestRef.current.id + 1;
    mapPointsRequestRef.current = { id: requestId, controller };

    try {
      const query = date ? `?date=${encodeURIComponent(date)}` : "";
      const response = await apiFetch(`/map-points${query}`, { signal: controller.signal, revalidate: true });
      const data = await response.json();

      if (mapPointsRequestRef.current.id !== requestId) {
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar los puntos del mapa.");
      }

      const nextPoints = Array.isArray(data) ? data : [];
      setMapPoints(nextPoints);
      setSelectedMapPointId((current) => (nextPoints.some((point) => point.id === current) ? current : null));
      setMapStatus("Sincronizado");
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      if (!silent) {
        showAlert(error.message || "No fue posible cargar los puntos del mapa.");
      }
      setMapStatus("Sin conexion");
    } finally {
      if (mapPointsRequestRef.current.id === requestId) {
        mapPointsRequestRef.current.controller = null;
      }
      if (!silent) {
        setLoadingMapPoints(false);
      }
    }
  };

  const loadArchivedMapDiaryPoints = async (dateKey) => {
    if (!isAuthenticated || !dateKey) return;

    setLoadingArchiveMapDiaryPoints(true);
    try {
      const response = await apiFetch(`/map-points?date=${encodeURIComponent(dateKey)}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar la jornada seleccionada.");
      }

      setArchiveMapDiaryPoints(Array.isArray(data) ? data : []);
      setSelectedArchiveMapDiaryKey(dateKey);
    } catch (error) {
      showAlert(error.message || "No fue posible cargar la jornada seleccionada.");
    } finally {
      setLoadingArchiveMapDiaryPoints(false);
    }
  };

  const openMapDiaryArchiveModal = () => {
    if (!archivedMapDiaryGroups.length) return;
    const nextKey = selectedArchiveMapDiaryGroup?.key || archivedMapDiaryGroups[0].key;
    setShowMapDiaryArchiveModal(true);
    loadArchivedMapDiaryPoints(nextKey);
  };

  const handleUseArchivedMapDiary = () => {
    const nextKey = selectedArchiveMapDiaryGroup?.key || selectedArchiveMapDiaryKey;
    if (!nextKey) return;
    setMapDiaryDateKey(nextKey);
    setMapReportPage(1);
    setShowMapDiaryArchiveModal(false);
  };

  const loadMapPointContexts = async (points = safeMapPoints) => {
    if (!isAuthenticated || !isAdmin) return;

    const payloadPoints = Array.isArray(points) ? points : [];
    if (!payloadPoints.length) {
      setMapPointContexts({});
      return;
    }

    setLoadingMapContexts(true);

    try {
      const response = await apiFetch("/map-points/context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          points: payloadPoints.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude
          }))
        })
      }).catch(() => {
        throw new Error("No se pudo conectar con la API. Revisa que el backend este disponible.");
      });
      const data = await readJsonResponse(
        response,
        "La API no devolvio JSON. Revisa que el backend este disponible y que la base de datos este lista."
      );

      if (!response.ok) {
        throw new Error(data.message || "No fue posible consultar las zonas del levantamiento.");
      }

      const nextContexts = Object.fromEntries(
        (Array.isArray(data.contexts) ? data.contexts : []).map((context) => [context.key, context])
      );
      setMapPointContexts(nextContexts);
    } catch (error) {
      showAlert(error.message || "No fue posible consultar las zonas del levantamiento.");
    } finally {
      setLoadingMapContexts(false);
    }
  };

  const handleToggleRegulatorDiaryKey = (dateKey) => {
    setRegulatorReportDiaryKeys((current) => {
      const baseline = current.length ? current : selectedRegulatorDiaryKeys;
      if (baseline.includes(dateKey)) {
        const next = baseline.filter((key) => key !== dateKey);
        return next.length ? next : baseline;
      }

      return [...baseline, dateKey].slice(0, 5);
    });
  };

  return {
    loadMapDiaryGroups,
    loadMapPoints,
    loadArchivedMapDiaryPoints,
    openMapDiaryArchiveModal,
    handleUseArchivedMapDiary,
    loadMapPointContexts,
    handleToggleRegulatorDiaryKey
  };
}
