import { CalendarDays, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "../../components/Icon";
import { MapDiaryArchiveCalendar } from "../../components/MapDiaryArchiveCalendar";
import { formatCoordinate, getMapPointTypeLabel } from "../../utils/mapField";
import { formatDateTime, formatMapDiaryLabel } from "../../utils/datesAndBusiness";
import { getMapPointReferenceNote, getMapPointTechnicalDescription } from "../../utils/mapReport";

export default function MapDiaryArchiveDialog({ model }) {
  const {
    archiveMapDiaryPoints,
    archivedMapDiaryGroups,
    handleUseArchivedMapDiary,
    loadArchivedMapDiaryPoints,
    loadingArchiveMapDiaryPoints,
    selectedArchiveMapDiaryGroup,
    setShowMapDiaryArchiveModal,
    setSidebarCollapsed,
    showMapDiaryArchiveModal,
    sidebarCollapsed
  } = model;

  return (
    <Dialog open={showMapDiaryArchiveModal} onOpenChange={setShowMapDiaryArchiveModal}>
      <DialogContent className="map-diary-archive-modal shadcn-print-dialog max-h-[calc(100vh-1rem)] overflow-hidden sm:max-w-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Calendario de jornadas trabajadas</DialogTitle>
          <DialogDescription>Selecciona una fecha trabajada para revisar sus puntos.</DialogDescription>
        </DialogHeader>
        <div className="map-diary-archive-toolbar">
          <button type="button" className="button-secondary map-diary-sidebar-toggle" onClick={() => setSidebarCollapsed((current) => !current)}>
            <Icon name="arrowLeft" />
            {sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
          </button>
        </div>
        <div className="map-diary-archive-layout">
          <MapDiaryArchiveCalendar
            groups={archivedMapDiaryGroups}
            selectedDateKey={selectedArchiveMapDiaryGroup?.key}
            loading={loadingArchiveMapDiaryPoints}
            onSelectDate={loadArchivedMapDiaryPoints}
          />
          <section className="map-diary-archive-detail">
            <div className="map-diary-archive-detail-head">
              <div>
                <span className="sheet-kicker"><CalendarDays size={14} /> Jornada seleccionada</span>
                <h3>{selectedArchiveMapDiaryGroup ? formatMapDiaryLabel(selectedArchiveMapDiaryGroup.key) : "Sin jornada"}</h3>
                <p className="map-diary-archive-points"><MapPin size={15} /> {selectedArchiveMapDiaryGroup?.total || 0} {(selectedArchiveMapDiaryGroup?.total || 0) === 1 ? "punto guardado" : "puntos guardados"}</p>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={handleUseArchivedMapDiary}
                disabled={!selectedArchiveMapDiaryGroup}
              >
                <Icon name="map" />
                Abrir jornada
              </button>
            </div>
            <div className="map-diary-archive-table-wrap">
              <table className="map-diary-archive-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tipo</th>
                    <th>Referencia</th>
                    <th>Descripción</th>
                    <th>Coordenadas</th>
                    <th>Precisión</th>
                    <th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingArchiveMapDiaryPoints ? (
                    <tr>
                      <td colSpan="7">Cargando datos guardados…</td>
                    </tr>
                  ) : archiveMapDiaryPoints.length ? (
                    archiveMapDiaryPoints.map((point, index) => (
                      <tr key={point.id || `${point.latitude}-${point.longitude}-${index}`}>
                        <td data-label="#">{index + 1}</td>
                        <td data-label="Tipo">{getMapPointTypeLabel(point.point_type)}</td>
                        <td data-label="Referencia">{getMapPointReferenceNote(point) || "--"}</td>
                        <td data-label="Descripción">{getMapPointTechnicalDescription(point) || "--"}</td>
                        <td data-label="Coordenadas">{formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}</td>
                        <td data-label="Precisión">{point.accuracy_meters ? `${point.accuracy_meters} m` : "--"}</td>
                        <td data-label="Hora">{formatDateTime(point.created_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7">Selecciona una jornada para ver los datos guardados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
