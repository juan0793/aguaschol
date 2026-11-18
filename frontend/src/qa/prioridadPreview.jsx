import React from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import "../modules/clandestinos/styles/clandestinos.css";
import EntregasPage from "../modules/entregas/pages/EntregasPage";
import { armarPrioridad, moraPorBarrio } from "../../../backend/src/services/entregasPrioridadRules.js";

// Banco de pruebas del Resumen de la oficina y de Barrios por prioridad. Datos de
// mentira (barrios "Ficticio", claves 99-…), con la forma real de las respuestas.
// Abre `qa-prioridad.html` (entra al Resumen) o `qa-prioridad.html#entregas/prioridad`.
// - ?rol=tecnico: técnico con el acceso adicional (sin montos); &alcance=propios, solo lo suyo.
// - ?rol=tecnico&sin=1: técnico sin el acceso (la pestaña no aparece).
const parametros = new URLSearchParams(location.search);
const tecnico = parametros.get("rol") === "tecnico";
const alcance = parametros.get("alcance") === "propios" ? "propios" : "todos";
const sinAcceso = parametros.has("sin");
const HOY = "2026-11-18";
const PROXIMA = "2026-11-19";

const personas = ["Técnico Prueba Uno", "Técnica Prueba Dos", "Técnico Prueba Tres", "Técnica Prueba Cuatro", "Técnico Prueba Cinco"].map((nombre, i) => ({ id: 30 + i, nombre_completo: nombre }));
const nombres = ["Bo. Ficticio Norte", "Bo. de Prueba", "Col. Ejemplo", "Res. Imaginaria", "Bo. Ensayo Sur", "Col. Muestra", "Bo. Simulado", "Col. Demostración con Nombre Largo", "Bo. Prototipo", "Col. Borrador", "Bo. Maqueta", "Col. Patrón", "Bo. Modelo", "Col. Boceto", "Bo. Esbozo", "Col. Ensayo", "Res. Ejemplar", "Bo. Plantilla"];
let semilla = 11;
const azar = (n) => { semilla = (semilla * 16807) % 2147483647; return semilla % n; };
const estados = ["entregado", "entregado", "entregado", "pendiente", "pendiente", "en_curso"];
const barrios = nombres.map((nombre, i) => {
  const responsable = personas[i % personas.length];
  const estado = i === 7 ? "pendiente" : estados[azar(estados.length)];
  const documentos = 120 + azar(1100);
  return {
    codigo: String(80 + i), nombre, claves: documentos + 30, responsable_id: responsable.id, responsable_nombre: responsable.nombre_completo,
    orden_ruta: Math.floor(i / personas.length) + 1, estado, lotes: estado === "pendiente" ? 0 : 1, lotes_cerrados: estado === "entregado" ? [200 + i] : [], lotes_abiertos: estado === "en_curso" ? [300 + i] : [],
    asignadas: estado === "pendiente" ? 0 : documentos, entregadas: estado === "entregado" ? documentos - 4 : 0,
    carga: i % 6 === 5 ? { documentos: documentos + 30, ultimo: null, ciclos: 0, jornadas: null, fuente: "padron" } : { documentos, ultimo: documentos + 12, ciclos: 3, jornadas: 1.5, fuente: "historial" },
    plan: [3, 9, 12].includes(i) && estado !== "entregado" ? { fecha: PROXIMA, responsable_id: responsable.id, anotado_por_nombre: responsable.nombre_completo } : null
  };
});
const contar = (estado) => barrios.filter((barrio) => barrio.estado === estado).length;
const mes = {
  desde: "2026-10-31", hasta: HOY, total: barrios.length, entregados: contar("entregado"), en_curso: contar("en_curso"), pendientes: contar("pendiente"),
  porcentaje: Math.round((contar("entregado") / barrios.length) * 1000) / 10, documentos_entregados: barrios.reduce((s, b) => s + b.entregadas, 0),
  barrios, ritmo_tecnicos: personas.map((p) => ({ responsable_id: p.id, jornadas: 12, documentos_por_jornada: 380, maximo_jornada: 520, barrios_por_jornada: 1.4 })),
  documentos_asignados: 0, hoy: { lotes: 3, abiertos: 1, asignadas: 980, entregadas: 560 }, ciclo_declarado: true, proxima_jornada: PROXIMA
};
const ultimas = new Map(barrios.map((barrio, i) => [barrio.codigo, i === 7 ? null : `2026-10-${String(10 + (i * 7) % 20).padStart(2, "0")}`]).filter(([, fecha]) => fecha));
const padron = barrios.flatMap((barrio, i) => Array.from({ length: 8 }, (_, k) => ({ clave_catastral: `${barrio.codigo}-0${k}-01-01`, intereses: (i + 1) * 1530.75 + k * 210 })));
const mora = moraPorBarrio(padron);
const textoPlan = (plan) => (plan.fecha === PROXIMA ? "Anotado para mañana" : `Anotado para el ${plan.fecha}`);

const prioridad = (criterio) => {
  const conMora = !tecnico;
  const propios = tecnico && alcance === "propios" ? barrios.filter((b) => b.responsable_id === 31) : barrios;
  const filas = armarPrioridad({ barrios: propios, ultimas, mora: conMora ? mora : null, hoy: HOY, criterio, textoPlan });
  const tecnicos = [...new Map(filas.map((f) => [f.responsable_id, f.responsable_nombre]))].map(([id, nombre]) => ({ id, nombre }));
  return {
    hoy: HOY, desde: mes.desde, ciclo_declarado: true, proxima_jornada: PROXIMA, criterio: conMora || criterio !== "mora" ? criterio : "combinado", con_mora: conMora, alcance: tecnico ? alcance : "todos", propio_id: tecnico ? 31 : null,
    totales: { barrios_ciclo: propios.length, entregados: propios.filter((b) => b.estado === "entregado").length, faltan: filas.length, en_curso: filas.filter((f) => f.estado === "en_curso").length, documentos: 0, mora: null },
    tecnicos, ritmo_tecnicos: mes.ritmo_tecnicos, barrios: filas
  };
};

const lotesHoy = [
  { id: 501, responsable_id: 30, responsable_nombre: personas[0].nombre_completo, barrio_nombre: "Bo. Ficticio Norte", estado: "ABIERTO", total_asignadas: 410, total_sobrantes: 0 },
  { id: 502, responsable_id: 31, responsable_nombre: personas[1].nombre_completo, barrio_nombre: "Bo. de Prueba", estado: "CERRADO", total_asignadas: 392, total_sobrantes: 4 },
  { id: 503, responsable_id: 33, responsable_nombre: personas[3].nombre_completo, barrio_nombre: "Res. Imaginaria", estado: "CERRADO", total_asignadas: 178, total_sobrantes: 9 }
];

const permisos = tecnico
  ? { can_create_lote: true, can_edit_lote: true, can_close_own_lote: true, can_manage_seguimiento: true, can_view_all: false, can_view_saldo: false, can_view_prioridad: !sinAcceso, prioridad_alcance: sinAcceso ? null : alcance, prioridad_vence: sinAcceso ? null : "2026-11-30" }
  : { can_manage_personal: true, can_create_lote: true, can_edit_lote: true, can_close_own_lote: true, can_force_close: true, can_reopen_lote: true, can_delete_lote: true, can_close_ciclo: true, can_view_descartes: true, can_manage_exclusiones: true, can_manage_seguimiento: true, can_generate_report: true, can_manage_reparto: true, can_correct_report: true, can_view_all: true, can_view_saldo: true, can_send_aviso: true, can_view_prioridad: true, prioridad_alcance: "todos", prioridad_vence: null };
const config = {
  tipos_documento: ["FACTURA", "NOTA_COBRO"], jornada: { fecha: HOY }, estados_lote: ["ABIERTO", "CERRADO"], estados_no_entregada: ["PENDIENTE"], estados_en_seguimiento: ["PENDIENTE"],
  resultados_intento: [], tipos_personal: [], motivos: [], barrios: barrios.map(({ codigo, nombre }) => ({ codigo, nombre })), semana_actual: { fecha_inicio: "2026-11-16", fecha_fin: "2026-11-20" },
  ciclo: { fecha_inicio: "2026-10-31", dias_abierto: 18 }, personal_vinculado: tecnico ? { id: 31, nombre_completo: personas[1].nombre_completo } : null, barrios_por_responsable: {}, plantillas_aviso: [], exclusiones: [], permissions: permisos
};
const resumen = {
  periodo: { fecha_inicio: "2026-11-16", fecha_fin: "2026-11-20" }, periodo_anterior: { fecha_inicio: "2026-11-09", fecha_fin: "2026-11-11", parcial: true },
  lotes: 9, lotes_abiertos: 1, asignadas: 1879, entregadas: 1831, sobrantes: 48, pendientes: 48, reentregadas: 0, no_localizadas: 0, vencidas: 0, pendientes_mas_3_dias: 0, pendientes_mas_7_dias: 0, efectividad: 97.5,
  comparativo: { asignadas: 1850, entregadas: 1788, pendientes: 52, reentregadas: 0, no_localizadas: 0, vencidas: 0, efectividad: 96.6 },
  por_barrio: [["Bo. Ficticio Norte", 25, 4.6], ["Col. Ejemplo", 9, 8.7], ["Col. Muestra", 5, 2.0], ["Res. Imaginaria", 4, 3.9], ["Bo. Simulado", 2, 0.9]].map(([barrio_nombre, sobrantes, tasa], i) => ({ barrio_codigo: String(80 + i), barrio_nombre, sobrantes, tasa_sobrante: tasa, asignadas: Math.round(sobrantes / tasa * 100), entregadas: 0, lotes: 1, pendientes: sobrantes })),
  por_dia: [["2026-11-16", 980, 38], ["2026-11-17", 851, 8], ["2026-11-18", 0, 0], ["2026-11-19", 0, 0], ["2026-11-20", 0, 0]].map(([fecha, entregadas, no_entregadas]) => ({ fecha, entregadas, no_entregadas, asignadas: entregadas + no_entregadas }))
};

window.__registro = [];
const respuesta = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
const apiFetch = async (ruta = "") => {
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  const [camino, consulta = ""] = String(ruta).split("?");
  window.__registro.push(camino);
  const q = new URLSearchParams(consulta);
  if (camino === "/entregas/config") return respuesta(config);
  if (camino === "/entregas/resumen") return respuesta(resumen);
  if (camino === "/entregas/avance-mes") return tecnico ? respuesta({ message: "Solo quien ve a todo el equipo consulta el avance del mes." }, 403) : respuesta(mes);
  if (camino === "/entregas/prioridad") return tecnico && sinAcceso ? respuesta({ message: "No tienes acceso a Barrios por prioridad." }, 403) : respuesta(prioridad(q.get("criterio") || "combinado"));
  if (camino === "/entregas/personal") return respuesta(personas.map((p) => ({ ...p, activo: 1, tipo_personal: "TECNICO" })));
  if (camino === "/entregas/lotes" && q.get("fecha_desde") === HOY && q.get("fecha_hasta") === HOY) return respuesta({ items: lotesHoy, total: lotesHoy.length, resumen: null });
  return respuesta({ items: [], total: 0 });
};

const raiz = ReactDOM.createRoot(document.getElementById("root"));
raiz.render(<EntregasPage apiFetch={apiFetch} session={{ user: { id: tecnico ? 9 : 1, role: tecnico ? "validadora_campo" : "admin", full_name: tecnico ? personas[1].nombre_completo : "Administración de prueba" } }} showAlert={(mensaje) => console.log("[aviso]", mensaje)} />);
