import React from "react";
import ReactDOM from "react-dom/client";
import App from "../App";
import { qaManagerReport } from "./gerenciaReportsFixture.js";
import "../styles.css";
import "../components/sidebar/sidebar.css";
import "../styles/audit-console.css";

// Fixtures exclusivamente para esta página QA; ninguna petición sale al backend.
const user = { id: 9999, role: "gerente", full_name: "Ana Prueba", username: "gerencia.qa", is_active: true };
if (new URLSearchParams(location.search).has("actualizacion")) window.__controlAguasForceUpdate = true;
if (new URLSearchParams(location.search).has("bienvenida")) sessionStorage.setItem("aguaschol-bienvenida", "9999");
if (new URLSearchParams(location.search).has("admin")) Object.assign(user, { role: "admin", full_name: "Administración de prueba", username: "admin.qa" });
if (new URLSearchParams(location.search).has("role-preview")) user.preview = { original_role: "admin", read_only: true, expires_at: new Date(Date.now() + 15 * 60000).toISOString(), expired: false };
const session = { token: "qa-gerencia-local", user };
const previousAuth = localStorage.getItem("aguaschol-auth");
localStorage.setItem("aguaschol-auth", JSON.stringify(session));
addEventListener("pagehide", () => {
  if (previousAuth && !previousAuth.includes("qa-gerencia-local")) localStorage.setItem("aguaschol-auth", previousAuth);
  else localStorage.removeItem("aguaschol-auth");
});
// Mantiene la página QA durante recargas de Vite y cambios de vista del shell.
const qaPath = location.pathname;
const replaceHistory = history.replaceState.bind(history);
history.replaceState = (state, title, url) => replaceHistory(state, title, `${qaPath}${new URL(url || location.href, location.href).hash}`);
let failReads = false;
const barrio = (name, count) => ({ barrio_colonia: name, total_registros: count, deuda: { capital: 6000, intereses: 3000, total: 9000, deudores: 6, criticos: 2 }, servicios: [{ field: "agua", label: "Agua potable", active: count, inactive: 0, unknown: 0, deuda: { total: 9000 } }] });
const data = {
  "/auth/me": { user },
  "/claves/services/report": { summary: { total_records: 20, total_barrios: 2, deuda: { capital: 12000, intereses: 6000, total: 18000, deudores: 12, criticos: 4 } }, barrios: [barrio("Barrio de prueba A", 10), barrio("Barrio de prueba B", 10)] },
  "/claves/meta": { updated_at: "2026-10-10T12:00:00Z" },
  "/inspecciones/resumen": { creadas_mes: 12, finalizadas_mes: 8, creadas_mes_anterior: 9, finalizadas_mes_anterior: 10, seguimiento: 2, carga_tecnicos: [{ tecnico_id: 1, nombre: "Técnico de prueba A", activas: 7 }, { tecnico_id: 2, nombre: "Técnico de prueba B", activas: 3 }] },
  "/entregas/resumen": { entregadas: 142, pendientes: 18, vencidas: 3, lotes_abiertos: 2, por_dia: Array.from({ length: 12 }, (_, i) => ({ fecha: `2026-10-${String(i + 1).padStart(2, "0")}`, asignadas: 20, entregadas: 12, no_entregadas: 3 })) },
  "/clandestinos/fichas": { total: 64, items: [] },
  "/map-points/diary-groups": { groups: [{ key: "2026-10-10", total: 142 }] },
  "/admin/team-activity": { items: [{ id: 1, summary: "Inspección finalizada — prueba", actor_name: "Técnico de prueba" }], total: 1, tecnicos: [], categorias: {}, dias: [] },
  "/railway/summary": { period: { start: "2026-10-09T06:00:00Z", end: "2026-11-09T06:00:00Z", updatedAt: new Date().toISOString() }, currentUsage: 2.36, estimatedUsage: 18.4 },
  "/barrios": [], "/claves/services/accounts": { cuentas: [], total_cuentas: 0 }
};
window.fetch = async (url, options = {}) => {
  if (options.signal?.aborted) throw new DOMException("Cancelado", "AbortError");
  const path = new URL(String(url), location.origin).pathname.replace(/^\/api/, "");
  if (failReads && path !== "/auth/me") return new Response(JSON.stringify({ message: "Fallo de lectura simulado en QA." }), { status: 503, headers: { "Content-Type": "application/json" } });
  if (path === "/reports/manager" && options.method === "POST") {
    const filters = JSON.parse(options.body);
    return new Response(JSON.stringify(qaManagerReport(filters)), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  if (/^\/reports\/manager\/RPT-.*\/events$/.test(path)) return new Response("{\"ok\":true}", { status: 200, headers: { "Content-Type": "application/json" } });
  const result = data[path];
  if (path === "/entregas/resumen") {
    const params = new URL(String(url), location.origin).searchParams;
    const from = params.get("fecha_desde");
    const to = params.get("fecha_hasta");
    const days = Number(to?.slice(-2)) || 12;
    return new Response(JSON.stringify({ ...result, asignadas: days * 20, entregadas: days * 12, por_dia: Array.from({ length: days }, (_, i) => ({ fecha: `${from?.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`, asignadas: 20, entregadas: 12, no_entregadas: 3 })) }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify(result ?? { message: "Ruta fuera del fixture QA." }), { status: result == null ? 503 : 200, headers: { "Content-Type": "application/json" } });
};
ReactDOM.createRoot(document.getElementById("root")).render(<><div style={{ background: "#fff2cd", padding: "5px 12px", fontSize: 12 }}>QA local · Datos sintéticos. <button type="button" onClick={() => { failReads = true; }}>Simular error de lectura</button> <button type="button" onClick={() => { failReads = false; }}>Restablecer API de prueba</button></div><App /></>);
// QA: ?vista=informes&informe=<tipo>&pestana=<texto> abre Consultas e informes con los mismos clics de una persona.
const qaParams = new URLSearchParams(location.search);
if (qaParams.get("vista") === "informes") {
  const click = (selector, text) => [...document.querySelectorAll(selector)].find((node) => !text || node.textContent.includes(text))?.click();
  setTimeout(() => click(".manager-reports-link"), 1200);
  if (qaParams.get("informe")) setTimeout(() => click(".mr-index button", qaParams.get("informe")), 1800);
  if (qaParams.get("pestana")) setTimeout(() => click(".mr-tabs button", qaParams.get("pestana")), 2600);
}
