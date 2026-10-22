import React from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import InspeccionesPage from "../modules/inspecciones/pages/InspeccionesPage";

// Banco de pruebas de Inspecciones: resumen, bandeja "Requieren acción" y Nueva inspección.
// Datos de mentira con la forma real de la API; ninguna clave ni nombre es del padrón.
// Abre `qa-inspecciones.html`.

const hoy = new Date();
const haceDias = (n) => new Date(hoy.getTime() - n * 86400000).toISOString();
const tecnicos = [
  { id: 11, full_name: "Técnica Prueba Uno", role: "validadora_campo" },
  { id: 12, full_name: "Técnico Prueba Dos", role: "operator" },
  { id: 13, full_name: "Técnico Prueba Tres", role: "operator" }
];
const base = (id, clave, estado, dias, extra = {}) => ({
  id,
  numero_inspeccion: `INS-2026-${String(id).padStart(5, "0")}`,
  clave_catastral: clave,
  inspeccion_general: false,
  abonado_numero: String(10000 + id),
  abonado_nombre_snapshot: `ABONADO DE PRUEBA ${id}`,
  barrio_snapshot: ["Bo. de Prueba Norte", "Col. Ficticia", "Bo. Ejemplo Sur"][id % 3],
  motivo: id % 2 ? "Verificación de conexión" : "Revisión solicitada",
  estado,
  tecnico_responsable_id: tecnicos[id % 3].id,
  tecnico_responsable_nombre: tecnicos[id % 3].full_name,
  fecha_asignacion: haceDias(dias),
  fecha_finalizacion: estado === "FINALIZADA" ? haceDias(dias - 2) : null,
  created_at: haceDias(dias),
  ...extra
});
const todas = [
  base(26, "99-01-01-01", "ASIGNADA", 6),
  base(29, "99-02-03-04", "ASIGNADA", 6),
  base(30, "99-02-03-04", "ASIGNADA", 6, { abonado_nombre_snapshot: "OTRO ABONADO DE PRUEBA" }),
  base(31, "99-03-01-02", "ASIGNADA", 6),
  base(32, "99-04-02-01", "EN_PROCESO", 1),
  base(33, "99-05-05-05", "ASIGNADA", 0, { inspeccion_general: true, abonado_numero: "", abonado_nombre_snapshot: "" }),
  base(34, "99-01-01-01", "ASIGNADA", 0, { abonado_numero: "10026", abonado_nombre_snapshot: "ABONADO DE PRUEBA 26" }),
  base(35, "99-06-01-09", "SEGUIMIENTO", 0),
  base(12, "99-03-01-02", "FINALIZADA", 40),
  base(14, "99-06-01-09", "FINALIZADA", 20)
];
const ABIERTAS = ["ASIGNADA", "EN_PROCESO", "SEGUIMIENTO"];
const general = (item) => item.inspeccion_general || !item.abonado_numero;
const mismaCuenta = (a, b) => general(a) || general(b) || a.abonado_numero === b.abonado_numero;
const repeticion = (item) => {
  const mismas = todas.filter((otra) => otra.id !== item.id && otra.clave_catastral === item.clave_catastral);
  if (!mismas.length) return null;
  const resumen = (otra) => ({ id: otra.id, numero_inspeccion: otra.numero_inspeccion, estado: otra.estado, abonado_numero: general(otra) ? "" : otra.abonado_numero, inspeccion_general: general(otra), tecnico_responsable_nombre: otra.tecnico_responsable_nombre, fecha: otra.fecha_finalizacion || otra.fecha_asignacion });
  const abiertas = mismas.filter((otra) => ABIERTAS.includes(otra.estado));
  const fin = mismas.find((otra) => otra.estado === "FINALIZADA" && mismaCuenta(item, otra));
  return { repetidas: abiertas.filter((otra) => mismaCuenta(item, otra)).map(resumen), otras_cuentas: abiertas.filter((otra) => !mismaCuenta(item, otra)).map(resumen), ultima_finalizada: fin ? resumen(fin) : null, total: mismas.length };
};
const mes = hoy.toISOString().slice(0, 7);
const resumen = {
  asignadas: 6, en_proceso: 1, seguimiento: 1, finalizadas_mes: 2, finalizadas_mes_anterior: 3, total: todas.length, mas_antigua_asignada_dias: 6,
  hoy: hoy.toISOString().slice(0, 10), mes, mes_actual: mes, mes_anterior: mes, rango: { desde: `${mes}-01`, hasta: hoy.toISOString().slice(0, 10) },
  creadas_mes: 8, creadas_mes_anterior: 5, creadas_finalizadas: 0, distribucion_creadas: { ASIGNADA: 6, EN_PROCESO: 1, SEGUIMIENTO: 1, FINALIZADA: 0 },
  carga_tecnicos: tecnicos.map((t) => ({ tecnico_id: t.id, nombre: t.full_name, activas: todas.filter((i) => i.tecnico_responsable_id === t.id && ABIERTAS.includes(i.estado)).length })),
  bandeja: todas.filter((i) => ABIERTAS.includes(i.estado)).map((i) => ({ ...i, fecha_estado: i.fecha_asignacion, antiguedad_dias: Math.round((hoy - new Date(i.fecha_asignacion)) / 86400000), repeticion: repeticion(i) }))
    .sort((a, b) => new Date(a.fecha_estado) - new Date(b.fecha_estado) || a.id - b.id),
  actividad: []
};

const responder = (data) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
const apiFetch = async (ruta) => {
  await new Promise((resolve) => window.setTimeout(resolve, 150));
  const url = new URL(ruta, "http://qa.local");
  if (url.pathname === "/inspecciones/config") return responder({ permissions: { can_create: true, can_view_stats: false }, motivos: [], estados: ABIERTAS });
  if (url.pathname === "/inspecciones/tecnicos") return responder(tecnicos);
  if (url.pathname === "/inspecciones/resumen") return responder(resumen);
  if (url.pathname === "/inspecciones/sugerencia-tecnico") return responder({ sugerencias: [] });
  if (url.pathname === "/claves/search") {
    const clave = url.searchParams.get("clave") || "";
    const existe = /^99-/.test(clave);
    return responder({ exists: existe, normalized_query: clave, matches: existe ? [{ clave_catastral: clave, abonado: "20001", inquilino: "ABONADO DE PRUEBA", barrio_colonia: "Bo. de Prueba Norte" }] : [] });
  }
  if (url.pathname === "/inspecciones") {
    const clave = url.searchParams.get("clave") || "";
    const items = todas.filter((i) => !clave || i.clave_catastral.includes(clave));
    return responder({ items, total: items.length, page: 1, limit: 50, total_pages: 1 });
  }
  return responder({});
};

const session = { user: { id: 1, role: "admin", full_name: "Administración de prueba" } };
ReactDOM.createRoot(document.getElementById("root")).render(<InspeccionesPage apiFetch={apiFetch} session={session} showAlert={() => {}} />);
