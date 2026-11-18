import { cargaDe, jornadasNecesarias } from "./avanceMes.js";

// Plan del día siguiente: qué barrios ofrecer, cuánto pesan juntos y cómo nombrar el día.

// Lo que falta del ciclo va primero (lo que tiene lote abierto antes) y en su orden de
// ruta; lo ya entregado solo aparece si ya estaba anotado.
const PESO_ESTADO = { en_curso: 0, pendiente: 1, entregado: 2 };
export const opcionesPlan = (barrios = []) => barrios
  .filter((barrio) => barrio.estado !== "entregado" || barrio.anotado)
  .sort((a, b) => (PESO_ESTADO[a.estado] ?? 1) - (PESO_ESTADO[b.estado] ?? 1)
    || (a.orden_ruta ?? 9999) - (b.orden_ruta ?? 9999)
    || String(a.nombre).localeCompare(String(b.nombre), "es"));

// Documentos y jornadas de lo elegido, y una pista para decidir si cabe otro barrio.
export const resumenPlan = (elegidos = [], barrios = [], ritmo = null) => {
  const marcados = new Set(elegidos.map(String));
  const documentos = barrios.filter((barrio) => marcados.has(String(barrio.codigo))).reduce((suma, barrio) => suma + cargaDe(barrio), 0);
  const jornadas = jornadasNecesarias(documentos, ritmo);
  const pista = !jornadas ? "" : jornadas > 1.25 ? "Es más de una jornada." : jornadas <= 0.75 ? "Cabe otro barrio." : "";
  return { documentos, jornadas, pista };
};

const DIA = new Intl.DateTimeFormat("es-HN", { weekday: "long", day: "numeric", timeZone: "UTC" });
const sumarDia = (iso) => {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
};
// "mañana" si es el día siguiente; si no, "el lunes 23".
export const textoFechaPlan = (fecha, hoy) => {
  if (!fecha) return "mañana";
  if (fecha === hoy) return "hoy";
  if (hoy && fecha === sumarDia(hoy)) return "mañana";
  return `el ${DIA.format(new Date(`${fecha}T00:00:00Z`))}`;
};

export const mismoPlan = (a = [], b = []) => a.length === b.length && a.every((codigo) => b.includes(codigo));
