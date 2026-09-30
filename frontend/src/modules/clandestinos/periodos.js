// Periodos de trabajo (día, semana, mes, año) para el ritmo y el listado de Fichas.
// Mismas claves que el backend: "2026-09-30" (día), lunes "2026-09-28" (semana),
// "2026-09" (mes) y "2026" (año). La fecha es la de levantamiento (creación).
export const GRANULARIDADES = [["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"], ["anio", "Año"]];
export const UNIDAD = { dia: "día", semana: "semana", mes: "mes", anio: "año" };

const pad = (value) => String(value).padStart(2, "0");
// Día local (Honduras en los equipos de la oficina) en formato ISO.
export const diaLocal = (value) => {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return "";
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
};
const deIso = (iso) => new Date(`${iso}T12:00:00`);
const sumarDias = (iso, dias) => { const fecha = deIso(iso); fecha.setDate(fecha.getDate() + dias); return diaLocal(fecha); };
export const lunesDe = (iso) => sumarDias(iso, -((deIso(iso).getDay() + 6) % 7));
export const periodoDe = (value, granularidad) => {
  const dia = diaLocal(value);
  if (!dia) return "";
  return granularidad === "semana" ? lunesDe(dia) : granularidad === "mes" ? dia.slice(0, 7) : granularidad === "anio" ? dia.slice(0, 4) : dia;
};

const fmt = (iso, opciones) => deIso(iso).toLocaleDateString("es-HN", opciones);
const capital = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Encabezado de un grupo del listado: "Hoy · martes 30 de septiembre", "Esta semana · 28 sep – 4 oct"…
export const etiquetaPeriodo = (periodo, granularidad, hoy = diaLocal(new Date())) => {
  if (!periodo) return "Sin fecha de levantamiento";
  const anioActual = hoy.slice(0, 4);
  if (granularidad === "anio") return periodo === anioActual ? `Este año · ${periodo}` : periodo;
  if (granularidad === "mes") {
    const texto = capital(fmt(`${periodo}-01`, { month: "long", year: "numeric" }));
    return periodo === hoy.slice(0, 7) ? `Este mes · ${texto}` : texto;
  }
  if (granularidad === "semana") {
    const fin = sumarDias(periodo, 6);
    const rango = `${fmt(periodo, { day: "numeric", month: "short" })} – ${fmt(fin, { day: "numeric", month: "short", ...(fin.slice(0, 4) !== anioActual ? { year: "numeric" } : {}) })}`;
    if (periodo === lunesDe(hoy)) return `Esta semana · ${rango}`;
    if (periodo === sumarDias(lunesDe(hoy), -7)) return `Semana pasada · ${rango}`;
    return `Semana del ${rango}`;
  }
  const texto = fmt(periodo, { weekday: "long", day: "numeric", month: "long", ...(periodo.slice(0, 4) !== anioActual ? { year: "numeric" } : {}) });
  if (periodo === hoy) return `Hoy · ${texto}`;
  if (periodo === sumarDias(hoy, -1)) return `Ayer · ${texto}`;
  return capital(texto);
};

// Rótulo corto para el eje del gráfico.
export const rotuloEje = (periodo, granularidad) => {
  if (granularidad === "anio") return periodo;
  if (granularidad === "mes") return fmt(`${periodo}-01`, { month: "short" }).replace(".", "");
  return fmt(periodo, { day: "numeric", month: "short" }).replace(".", "");
};
