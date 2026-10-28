import React from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import "../modules/clandestinos/styles/clandestinos.css";
import EntregasPage from "../modules/entregas/pages/EntregasPage";

// Banco de pruebas de Descartes en Control de entregas. Datos de mentira con la forma
// real de GET /api/entregas/descartes: ningún nombre, abonado ni clave es del padrón
// (claves 99-…). Abre `qa-descartes.html` (entra a #entregas/descartes).
// - ?documentos=1500 arma un ciclo grande (por defecto 260).
// - window.__registro cuenta las consultas a /entregas/descartes.
// - window.__redibujar() vuelve a dibujar la app con props nuevas, como hace App.
const parametros = new URLSearchParams(location.search);
const TOTAL = Number(parametros.get("documentos")) || 260;
const HOY = "2026-10-27";
const motivos = [
  ["CASA_CERRADA", "Casa cerrada"], ["DIRECCION_NO_ENCONTRADA", "Dirección no encontrada"], ["PREDIO_DESHABITADO", "Predio deshabitado"],
  ["ABONADO_NO_LOCALIZADO", "Abonado no localizado"], ["RECHAZO_RECEPCION", "Rechazo de recepción"], ["OTRO", "Otro"]
].map(([codigo, etiqueta]) => ({ codigo, etiqueta, requiere_observacion: codigo === "OTRO" }));
const tecnicos = ["Técnico Prueba Uno", "Técnica Prueba Dos", "Técnico Prueba Tres", "Técnica Prueba Cuatro", "Técnico Prueba Cinco", "Técnico Prueba Zaldaña"].map((nombre, i) => ({ id: 30 + i, nombre }));
const barrios = ["Bo. Ficticio Norte", "Bo. de Prueba", "Col. Ejemplo", "Res. Imaginaria", "Bo. Ensayo Sur", "Col. Muestra", "Bo. Simulado", "Col. Demostración con Nombre Largo", "Bo. Prototipo", "Col. Borrador", "Bo. Maqueta", "Col. Patrón", "Bo. Modelo", "Col. Boceto"].map((nombre, i) => ({ codigo: String(80 + i), nombre }));
const dias = ["2026-10-27", "2026-10-26", "2026-10-23", "2026-10-22", "2026-10-21", "2026-10-20", "2026-10-19", "2026-10-16", "2026-10-15", "2026-10-14", "2026-10-13", "2026-10-12"];
const estados = ["PENDIENTE", "PENDIENTE", "PENDIENTE", "REENTREGADA", "NO_LOCALIZADA"];
// Pseudoaleatorio fijo: el banco sale igual en cada recarga.
let semilla = 7;
const azar = (n) => { semilla = (semilla * 16807) % 2147483647; return semilla % n; };
const items = Array.from({ length: TOTAL }, (_, i) => {
  const tecnico = tecnicos[azar(tecnicos.length)];
  // Cada técnico reparte sobre todo sus dos o tres barrios.
  const propio = (tecnico.id - 30) * 2 + azar(3);
  const barrio = barrios[propio < barrios.length ? propio : azar(barrios.length)];
  const fecha = dias[azar(dias.length)];
  const repetido = azar(10) < 4;
  const clave = `99-${barrio.codigo}-0${i % 9}-${String(i % 97).padStart(2, "0")}`;
  const anteriores = repetido ? Array.from({ length: 1 + azar(4) }, (_, k) => ({
    id: 90000 + i * 10 + k, lote_id: 50 + k, fecha_lote: ["2026-09-21", "2026-09-21", "2026-08-28", "2026-07-30"][k], motivo: motivos[azar(motivos.length)].codigo,
    estado: "VENCIDA", numero_abonado: String(20000 + i), clave_catastral: clave
  })) : [];
  const sinResponsable = i % 41 === 0;
  return {
    id: 1000 + i,
    lote_id: 100 + dias.indexOf(fecha) * 6 + (tecnico.id - 30),
    numero_abonado: i % 23 === 0 ? "" : String(20000 + i),
    clave_catastral: clave,
    abonado_nombre: i % 31 === 0 ? "" : `ABONADO DE PRUEBA ${i + 1}${i % 5 === 0 ? " (COMERCIO FICTICIO)" : ""}`,
    motivo: motivos[azar(motivos.length)].codigo,
    observacion: i % 7 === 0 ? "Nota de prueba del técnico" : "",
    estado: estados[azar(estados.length)],
    fecha_lote: fecha,
    tipo_documento: i % 6 === 0 ? "NOTA_COBRO" : "FACTURA",
    barrio_codigo: barrio.codigo,
    barrio_nombre: barrio.nombre,
    responsable_id: sinResponsable ? null : tecnico.id,
    responsable_nombre: sinResponsable ? "" : tecnico.nombre,
    repetido,
    ciclos_anteriores: new Set(anteriores.map((anterior) => anterior.fecha_lote.slice(0, 7))).size,
    anteriores
  };
}).sort((a, b) => (a.fecha_lote === b.fecha_lote ? Number(b.repetido) - Number(a.repetido) || a.id - b.id : a.fecha_lote < b.fecha_lote ? 1 : -1));

const grupos = items.filter((item) => item.repetido).map((item) => ({
  llave: item.numero_abonado || `CLAVE:${item.clave_catastral}`,
  numero_abonado: item.numero_abonado, clave_catastral: item.clave_catastral, abonado_nombre: item.abonado_nombre,
  barrio_nombre: item.barrio_nombre, responsable_nombre: item.responsable_nombre, ultima_fecha: item.fecha_lote,
  ciclos_anteriores: item.ciclos_anteriores, ciclo_actual: [item], anteriores: item.anteriores
})).sort((a, b) => b.ciclos_anteriores - a.ciclos_anteriores);
const ciclo = { fecha_inicio: "2026-10-01", fecha_fin: HOY, corte_anterior: "2026-09-30", cerrado: false };

const descartes = (fecha) => {
  const delDia = items.filter((item) => item.fecha_lote === fecha);
  return {
    fecha, ciclo,
    resumen: { documentos: items.length, documentos_repetidos: grupos.length, abonados_repetidos: grupos.length, documentos_dia: delDia.length, repetidos_dia: delDia.filter((item) => item.repetido).length },
    dias: [], dia: { fecha, items: delDia }, items, repetidos: grupos
  };
};
const config = {
  tipos_documento: ["FACTURA", "NOTA_COBRO"], jornada: { fecha: HOY }, estados_lote: ["ABIERTO", "CERRADO"], estados_no_entregada: ["PENDIENTE", "REENTREGADA", "NO_LOCALIZADA", "CANCELADA", "VENCIDA"],
  estados_en_seguimiento: ["PENDIENTE"], resultados_intento: [], tipos_personal: [], motivos, barrios: barrios.map((barrio) => ({ codigo: barrio.codigo, nombre: barrio.nombre })),
  semana_actual: { fecha_inicio: "2026-10-26", fecha_fin: "2026-11-01" }, ciclo: { ...ciclo, dias_abierto: 27 }, personal_vinculado: null, barrios_por_responsable: {}, plantillas_aviso: [],
  permissions: { can_manage_personal: true, can_create_lote: true, can_edit_lote: true, can_close_own_lote: true, can_force_close: true, can_reopen_lote: true, can_delete_lote: true, can_close_ciclo: true, can_view_descartes: true, can_manage_seguimiento: true, can_generate_report: true, can_manage_reparto: true, can_correct_report: true, can_view_all: true, can_view_saldo: false, can_send_aviso: false }
};

window.__registro = { descartes: 0, otras: [] };
const respuesta = (cuerpo) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { "Content-Type": "application/json" } });
const apiFetch = async (ruta = "") => {
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  const [camino, consulta = ""] = String(ruta).split("?");
  if (camino === "/entregas/config") return respuesta(config);
  if (camino === "/entregas/descartes") {
    window.__registro.descartes += 1;
    return respuesta(descartes(new URLSearchParams(consulta).get("fecha") || HOY));
  }
  window.__registro.otras.push(camino);
  if (camino === "/entregas/resumen") return respuesta({ periodo: { fecha_inicio: "2026-10-26", fecha_fin: "2026-11-01" }, por_dia: [], totales: {} });
  if (camino === "/entregas/personal") return respuesta([]);
  const documento = camino.match(/^\/entregas\/no-entregadas\/(\d+)$/);
  if (documento) return respuesta({ ...items.find((item) => item.id === Number(documento[1])), intentos: [], avisos: [] });
  return respuesta({ items: [], total: 0 });
};

if (!location.hash) location.hash = "#entregas/descartes";
const raiz = ReactDOM.createRoot(document.getElementById("root"));
const dibujar = () => raiz.render(<EntregasPage apiFetch={apiFetch} session={{ user: { id: 1, role: "admin", full_name: "Administración de prueba" } }} showAlert={(mensaje) => console.log("[aviso]", mensaje)} />);
window.__redibujar = dibujar;
dibujar();
