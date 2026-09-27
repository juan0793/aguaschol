import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  MAP_DIARY_WEEKDAYS,
  getMapDiaryCalendarDays,
  getTodayMapDiaryKey,
  parseMapDiaryDate,
  shiftMapDiaryMonth
} from "../utils/mapDiary";
import { formatMapDiaryLabel } from "../utils/datesAndBusiness";
import { useEffect, useMemo, useState } from "react";

export const MapDiaryArchiveCalendar = ({ groups, selectedDateKey, loading, onSelectDate }) => {
  const monthKeys = useMemo(
    () => Array.from(new Set(groups.map((group) => group.key.slice(0, 7)))).sort(),
    [groups]
  );
  const selectedMonthKey = selectedDateKey?.slice(0, 7) || monthKeys.at(-1) || getTodayMapDiaryKey().slice(0, 7);
  const [monthKey, setMonthKey] = useState(selectedMonthKey);

  useEffect(() => {
    if (selectedDateKey) setMonthKey(selectedDateKey.slice(0, 7));
  }, [selectedDateKey]);

  const monthGroups = groups.filter((group) => group.key.startsWith(`${monthKey}-`));
  const monthPoints = monthGroups.reduce((total, group) => total + Number(group.total || 0), 0);
  const rawMonthLabel = parseMapDiaryDate(`${monthKey}-01`)?.toLocaleDateString("es-HN", {
    month: "long",
    year: "numeric"
  }) || "";
  const monthLabel = `${rawMonthLabel.charAt(0).toUpperCase()}${rawMonthLabel.slice(1)}`;
  const firstMonth = monthKeys[0];
  const lastMonth = monthKeys.at(-1);

  return (
    <section className="map-diary-archive-calendar" aria-label="Calendario de jornadas trabajadas">
      <div className="map-diary-archive-calendar-title">
        <span><CalendarDays size={20} /></span>
        <div><strong>Jornadas trabajadas</strong><small>{groups.length} fechas registradas</small></div>
      </div>
      <div className="map-diary-archive-month-nav">
        <button
          type="button"
          onClick={() => setMonthKey((current) => shiftMapDiaryMonth(current, -1))}
          disabled={!firstMonth || monthKey <= firstMonth}
          aria-label="Mes anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <strong>{monthLabel}</strong>
        <button
          type="button"
          onClick={() => setMonthKey((current) => shiftMapDiaryMonth(current, 1))}
          disabled={!lastMonth || monthKey >= lastMonth}
          aria-label="Mes siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="map-diary-archive-calendar-grid" aria-hidden="true">
        {MAP_DIARY_WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="map-diary-archive-calendar-grid">
        {getMapDiaryCalendarDays(`${monthKey}-01`, groups).map((day) =>
          day.blank ? (
            <span key={day.key} className="is-blank" />
          ) : (
            <button
              key={day.key}
              type="button"
              className={`${day.total ? "has-work" : ""} ${selectedDateKey === day.key ? "is-active" : ""}`}
              onClick={() => day.total && onSelectDate(day.key)}
              disabled={!day.total || loading}
              aria-label={day.total ? `${formatMapDiaryLabel(day.key)}, ${day.total} puntos` : formatMapDiaryLabel(day.key)}
            >
              <span>{day.day}</span>
              {day.total ? <small>{day.total}</small> : null}
            </button>
          )
        )}
      </div>
      <div className="map-diary-archive-calendar-summary">
        <div><strong>{monthGroups.length}</strong><span>jornadas</span></div>
        <div><strong>{monthPoints}</strong><span>puntos</span></div>
      </div>
    </section>
  );
};
