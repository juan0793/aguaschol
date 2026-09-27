import { getMapDiaryDateKey } from "./datesAndBusiness";

export const MAP_DIARY_WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export const parseMapDiaryDate = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const getMapDiaryCalendarDays = (activeDateKey, groups = []) => {
  const activeDate = parseMapDiaryDate(activeDateKey) || new Date();
  const year = activeDate.getFullYear();
  const month = activeDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalsByKey = new Map(groups.map((group) => [group.key, Number(group.total || 0)]));
  const blanks = Array.from({ length: firstWeekday }, (_, index) => ({ key: `blank-${index}`, blank: true }));
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { key, day, total: totalsByKey.get(key) || 0 };
  });
  return blanks.concat(days);
};

export const shiftMapDiaryMonth = (monthKey, amount) => {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  const nextDate = new Date(year, month - 1 + amount, 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
};

export const getTodayMapDiaryKey = () => getMapDiaryDateKey(new Date());
