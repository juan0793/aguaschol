import { useMemo } from "react";
import { MOBILE_MAP_POINT_LIMIT } from "../../constants/workspace";
import { getMapDiaryDateKey } from "../../utils/datesAndBusiness";
import { getTodayMapDiaryKey } from "../../utils/mapDiary";

export function useFieldMapPoints({ activeMapDiaryDateKey, isCompactMapView, mapPointListLimit, safeMapPoints, selectedMapPointId }) {
  const visibleMapPoints = useMemo(
    () => safeMapPoints.filter((point) => getMapDiaryDateKey(point) === activeMapDiaryDateKey),
    [activeMapDiaryDateKey, safeMapPoints]
  );
  // El menú mostraba "N puntos hoy" aunque la jornada visible fuera de otro día.
  const puntosJornadaLabel = activeMapDiaryDateKey === getTodayMapDiaryKey()
    ? `${visibleMapPoints.length} puntos hoy`
    : `${visibleMapPoints.length} puntos · ${new Date(`${activeMapDiaryDateKey}T12:00:00`).toLocaleDateString("es-HN", { day: "numeric", month: "short" })}`;
  const mapPointsForCanvas = useMemo(
    () => (isCompactMapView ? visibleMapPoints.slice(0, MOBILE_MAP_POINT_LIMIT) : visibleMapPoints),
    [isCompactMapView, visibleMapPoints]
  );
  const listedMapPoints = useMemo(
    () => visibleMapPoints.slice(0, mapPointListLimit),
    [mapPointListLimit, visibleMapPoints]
  );
  const hiddenMapPointCount = Math.max(0, visibleMapPoints.length - listedMapPoints.length);
  const hiddenCanvasPointCount = Math.max(0, visibleMapPoints.length - mapPointsForCanvas.length);
  const selectedMapPoint = visibleMapPoints.find((point) => point.id === selectedMapPointId) ?? null;

  return {
    visibleMapPoints,
    puntosJornadaLabel,
    mapPointsForCanvas,
    listedMapPoints,
    hiddenMapPointCount,
    hiddenCanvasPointCount,
    selectedMapPoint
  };
}
