// Banco de prueba del armazón (encabezado y menú lateral) con datos de mentira:
// monta la App real con una sesión falsa y respuestas vacías, sin backend.
// ?rol=admin|operator|validadora_campo|transport elige el perfil y ?vista= la pantalla.
import "../styles.css";
import "../components/sidebar/sidebar.css";
import "../styles/audit-console.css";
import { Component } from "react";
import { API_URL } from "../config/api";
import { AUTH_STORAGE_KEY } from "../constants/storageKeys";
import { computeFechaLimite } from "../modules/clandestinos/avisoPlazo";

const params = new URLSearchParams(window.location.search);
const rol = params.get("rol") || "admin";
// ?vista=/entregas abre esa pantalla: la App elige la vista por la ruta.
if (params.get("vista")) window.history.replaceState(null, "", params.get("vista"));
const usuario = { id: 1, username: "qa", full_name: "Usuario QA", email: "qa@local.test", role: rol, force_password_change: false };
window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: "qa-token", user: usuario }));

// "Vacío universal": una lista vacía que además acepta cualquier campo (y el
// campo de un campo), para que cada módulo arme su pantalla sin datos sin caerse.
// Como todo campo existe, los permisos (config.permissions.can_*) quedan encendidos
// y se ve la pantalla más cargada.
// Los hijos se guardan para que la misma ruta dé siempre el mismo objeto.
const SIN_VALOR = new Set(["then", "toJSON", "error", "errors", "message", "detail", "warning"]);
const hijos = new WeakMap();
const vacio = () => {
  const lista = [];
  hijos.set(lista, new Map());
  return new Proxy(lista, {
    get(target, key, receiver) {
      if (typeof key === "symbol" || key in target) return Reflect.get(target, key, receiver);
      if (SIN_VALOR.has(key) || /^\d+$/.test(key)) return undefined;
      // Si el módulo lo trata como texto (fecha.split, nombre.trim...), responde como "".
      if (key in String.prototype) return (...args) => String.prototype[key].apply("", args);
      const cache = hijos.get(target);
      if (!cache.has(key)) cache.set(key, vacio());
      return cache.get(key);
    }
  });
};
const MARCA_VACIA = "\"__qa_vacio__\"";
const parseOriginal = JSON.parse;
JSON.parse = (texto, ...resto) => (texto === MARCA_VACIA ? vacio() : parseOriginal(texto, ...resto));
const respuesta = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const fetchOriginal = window.fetch.bind(window);
// ?fichas=N: fichas clandestinas de mentira (claves y nombres inventados) para
// probar la bandeja y el lote de avisos sin backend.
const BARRIOS = ["Barrio Cabañas", "Barrio El Centro", "Barrio Brisas Del Sur", "Barrio Alegría", "Barrio El Estruendo"];
const TECNICOS = ["Técnico A", "Técnico B", "Técnico C"];
const fichasQa = Array.from({ length: Number(params.get("fichas")) || 0 }, (_, index) => ({
  id: 9000 + index,
  clave_catastral: index % 7 === 6 ? "" : `${String(10 + (index % 40)).padStart(2, "0")}-${String(10 + index).padStart(2, "0")}-${String(1 + (index % 30)).padStart(2, "0")}`,
  abonado: "",
  nombre_catastral: `Prueba ${index + 1}`,
  inquilino: "",
  barrio_colonia: BARRIOS[index % BARRIOS.length],
  levantamiento_datos: TECNICOS[index % TECNICOS.length],
  accion_inspeccion: "Ficha de prueba del banco QA",
  estado_padron: "clandestino",
  estado_operativo: "pending",
  conexion_agua: "Si",
  conexion_alcantarillado: index % 3 ? "Si" : "No",
  recoleccion_desechos: "No",
  foto_path: "",
  fecha_aviso: null,
  firmante_aviso: "",
  cargo_firmante: "",
  aviso_plazo_tipo: index % 5 === 0 ? "dias" : null,
  aviso_plazo_valor: index % 5 === 0 ? 7 : null,
  fecha_limite_aviso: index % 5 === 0 ? "2026-10-13" : null,
  printed_at: null,
  created_at: new Date(Date.now() - (index % 4) * 86400000).toISOString(),
  updated_at: new Date().toISOString()
}));
const candidatoQa = (id, extra) => ({ id, origen: "qfield", origen_ref: String(700 + id), clave_catastral: "", dictamen: "clandestino", motivo_dictamen: "No aparece en Aguas; sí en Alcaldía", estado: "pendiente", barrio_colonia: "Barrio El Centro", agua: true, alcantarillado: true, desechos: false, lote_baldio: false, latitude: 13.3, longitude: -87.19, comentario_campo: "", alcaldia_propietario: "PROPIETARIO DE PRUEBA", alcaldia_clave: "", aguas_clave: "", aguas_abonado: "", asignado_a: null, asignado_nombre: "", duplicados: 0, ...extra });
const bancoQa = [
  candidatoQa(1, { clave_catastral: "01-05-30", comentario_campo: "Casa esquinera, portón negro", duplicados: 2 }),
  candidatoQa(2, { clave_catastral: "01-05-21", dictamen: "sin_determinar", aguas_clave: "01-05-10-03", aguas_abonado: "25", motivo_dictamen: "Posible desmembración: PROPIETARIO DE PRUEBA ya tiene cuenta en Aguas en la misma manzana (01-05-10-03 · abonado 25); confirmar en campo si es el mismo predio" }),
  candidatoQa(3, { clave_catastral: "01-07-02", comentario_campo: "Conexión directa a la red" })
];
// ?banco=equipo: el banco con carga real (unos 40 candidatos repartidos entre
// técnicos inventados), para ver el reparto y la carga de cada uno.
const TECNICOS_BANCO = [[11, "Técnico Uno", 21, 3, 0], [12, "Técnica Dos", 21, 2, 2], [13, "Técnico Tres", 19, 1, 1], [14, "Técnica Cuatro", 18, 1, 0], [15, "Técnico Cinco", 18, 2, 0], [16, "Técnica Seis", 20, 4, 2], [17, "Técnico Siete", 18, 6, 2], [18, "Técnica Ocho", 20, 9, 2], [0, "Usuario QA", 6, 2, 0]];
const asignacionesQa = TECNICOS_BANCO.map(([id, nombre, total, enviados, descartados]) => {
  const pendientes = total - enviados - descartados;
  return { id: id || 1, nombre, total, enviados, descartados, trabajados: enviados + descartados, pendientes, avance: Math.round(((enviados + descartados) / total) * 100) };
});
const bancoEquipoQa = Array.from({ length: 42 }, (_, index) => {
  const tecnico = index < 30 ? asignacionesQa[index % asignacionesQa.length] : null;
  return candidatoQa(100 + index, {
    clave_catastral: `59-${index < 24 ? "09" : "12"}-${String(5 + (index % 24)).padStart(2, "0")}`,
    barrio_colonia: "Colonia Maria Milgrosa",
    dictamen: index % 6 === 5 ? "sin_determinar" : "clandestino",
    motivo_dictamen: "Clave de Alcaldía sin coincidencia en Aguas (Consultas del padrón)",
    alcaldia_propietario: ["OLMAN PORFIRIO REYES", "DENISE JANETH CRUZ", "FELIX AMADO GALEAS", "LORET SANCHEZ", "CESAR ARMANDO PAZ", "DAMASO DAVID SOTO"][index % 6],
    agua: index % 3 !== 0, alcantarillado: index % 4 === 0, latitude: index % 5 ? null : 13.3,
    comentario_campo: index % 7 === 2 ? "Medidor retirado; conexión directa desde la acera" : "",
    asignado_a: tecnico ? tecnico.id : null, asignado_nombre: tecnico ? tecnico.nombre : "", asignado_at: tecnico ? "2026-10-05T15:00:00Z" : null
  });
}).sort((a, b) => (a.asignado_a == null) - (b.asignado_a == null) || a.asignado_nombre.localeCompare(b.asignado_nombre, "es")); // como ORDEN_BANCO
const equipoTotales = { pendiente: 373, enviado: 30, descartado: 11 };
const cuerpo = (init) => { try { return JSON.parse(init?.body || "{}"); } catch { return {}; } };
const deLasQa = (ids = []) => fichasQa.filter((ficha) => ids.map(Number).includes(ficha.id));

// Usuarios de mentira para la pantalla de Usuarios (uno con solo su nombre).
const usuariosQa = [
  { id: 501, full_name: "elmer", username: "elmerprueba", email: "elmer@prueba.test", role: "operator", active_sessions: 1, is_online: true, force_password_change: false, last_login_at: new Date().toISOString(), created_at: "2026-05-11T15:54:00Z", updated_at: "2026-09-30T20:33:00Z" },
  { id: 502, full_name: "Técnica de Prueba Dos", username: "tecnicados", email: "dos@prueba.test", role: "validadora_campo", active_sessions: 0, is_online: false, force_password_change: true, last_login_at: null, created_at: "2026-06-01T15:00:00Z", updated_at: "2026-06-01T15:00:00Z" },
  { id: 503, full_name: "Admin de Prueba", username: "adminqa", email: "admin@prueba.test", role: "admin", active_sessions: 2, is_online: true, force_password_change: false, last_login_at: new Date().toISOString(), created_at: "2026-01-10T15:00:00Z", updated_at: "2026-09-01T15:00:00Z" }
];

// ?entregas=1: Control de entregas con lotes de mentira. El lote #31 es del usuario
// y está abierto, para probar el cierre (también como técnico con ?rol=tecnico).
const hoyQa = (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
const gestorQa = ["admin", "operator"].includes(rol);
const loteQa = (id, extra) => ({ id, fecha: hoyQa, responsable_id: 7, responsable_nombre: "Técnico A", responsable_user_id: 1, barrio_codigo: "14-04", barrio_nombre: "Barrio El Centro", tipo_documento: "FACTURA", total_asignadas: 120, total_entregadas: 0, total_sobrantes: 0, total_detalle: 0, pendientes: 0, efectividad: 0, estado: "ABIERTO", observacion_responsable: "", no_entregadas: [], ...extra });
const lotesQa = [
  loteQa(31),
  loteQa(30, { responsable_id: 8, responsable_nombre: "Técnico B", barrio_nombre: "Barrio Cabañas", total_asignadas: 96, total_entregadas: 91, total_sobrantes: 5, pendientes: 5, efectividad: 94.8, estado: "CERRADO" })
];
const entregasQa = (url, init) => {
  const ruta = new URL(url).pathname.replace(/^.*\/entregas/, "");
  const metodo = init?.method || "GET";
  if (ruta === "/config") return { tipos_documento: ["FACTURA", "NOTA_COBRO"], jornada: { fecha: hoyQa, zona_horaria: "America/Tegucigalpa", fin: "17:00", recordatorios: false }, estados_lote: ["ABIERTO", "CERRADO", "REVISADO"], estados_no_entregada: ["PENDIENTE", "REENTREGADA", "NO_LOCALIZADA", "CANCELADA", "VENCIDA"], estados_en_seguimiento: ["PENDIENTE"], resultados_intento: ["SIN_RESPUESTA", "CASA_CERRADA", "NO_LOCALIZADO", "ENTREGADO", "OTRO"], tipos_personal: ["TECNICO", "COBRADOR", "ENTREGA_FACTURAS", "OTRO"], motivos: [{ codigo: "CASA_CERRADA", nombre: "Casa cerrada", requiere_observacion: false }, { codigo: "NO_LOCALIZADO", nombre: "No localizado", requiere_observacion: false }], barrios: [{ codigo: "14-04", barrio: "Barrio El Centro" }, { codigo: "14-05", barrio: "Barrio Cabañas" }, { codigo: "14-06", barrio: "Barrio Alegría" }], barrios_por_responsable: gestorQa ? null : { 7: ["14-04"], 9: ["14-05", "14-06"] }, semana_actual: { fecha_inicio: hoyQa, fecha_fin: hoyQa }, ciclo: null, personal_vinculado: { id: 7, nombre_completo: "Técnico A", tipo_personal: "TECNICO" }, permissions: { can_manage_personal: rol === "admin", can_create_lote: true, can_edit_lote: true, can_close_own_lote: true, can_force_close: rol === "admin", can_reopen_lote: rol === "admin", can_delete_lote: rol === "admin", can_close_ciclo: rol === "admin", can_manage_seguimiento: true, can_generate_report: gestorQa, can_manage_reparto: gestorQa, can_correct_report: rol === "admin", can_view_all: gestorQa } };
  if (ruta === "/resumen") {
    const cerrados = lotesQa.filter((lote) => lote.estado !== "ABIERTO");
    const asignadas = lotesQa.reduce((sum, lote) => sum + lote.total_asignadas, 0);
    const entregadas = cerrados.reduce((sum, lote) => sum + lote.total_entregadas, 0);
    return { periodo: { fecha_inicio: hoyQa, fecha_fin: hoyQa }, periodo_anterior: { fecha_inicio: hoyQa, fecha_fin: hoyQa }, lotes: lotesQa.length, lotes_abiertos: lotesQa.length - cerrados.length, asignadas, entregadas, sobrantes: cerrados.reduce((sum, lote) => sum + lote.total_sobrantes, 0), pendientes: 5, reentregadas: 1, no_localizadas: 0, vencidas: 0, pendientes_mas_3_dias: 2, pendientes_mas_7_dias: 0, efectividad: asignadas ? Math.round((entregadas / asignadas) * 1000) / 10 : 0, comparativo: { asignadas: 0, entregadas: 0, pendientes: 0, reentregadas: 0, no_localizadas: 0, vencidas: 0, efectividad: 0 }, por_barrio: [], por_dia: [{ fecha: hoyQa, asignadas, entregadas, no_entregadas: 5 }] };
  }
  if (ruta === "/personal") return [{ id: 7, nombre_completo: "Técnico A", tipo_personal: "TECNICO", activo: true, tiene_acceso: true }, ...(gestorQa ? [{ id: 8, nombre_completo: "Técnico B", tipo_personal: "TECNICO", activo: true, tiene_acceso: true }] : []), { id: 9, nombre_completo: "Pedro (sin usuario)", tipo_personal: "TECNICO", activo: true, tiene_acceso: false }];
  const cerrar = ruta.match(/^\/lotes\/(\d+)\/cerrar$/);
  if (cerrar && metodo === "POST") {
    const lote = lotesQa.find((item) => item.id === Number(cerrar[1]));
    const sobrantes = Number(cuerpo(init).total_sobrantes || 0);
    Object.assign(lote, { estado: "CERRADO", total_sobrantes: sobrantes, total_entregadas: lote.total_asignadas - sobrantes, efectividad: Math.round(((lote.total_asignadas - sobrantes) / lote.total_asignadas) * 1000) / 10 });
    return lote;
  }
  if (ruta === "/lotes" && metodo === "POST") {
    const datos = cuerpo(init);
    const nombres = { 7: "Técnico A", 8: "Técnico B", 9: "Pedro (sin usuario)" };
    const nuevo = loteQa(Math.max(...lotesQa.map((item) => item.id)) + 1, { responsable_id: Number(datos.responsable_id), responsable_nombre: nombres[datos.responsable_id], responsable_user_id: Number(datos.responsable_id) === 9 ? null : 1, barrio_codigo: datos.barrio_codigo, barrio_nombre: { "14-04": "Barrio El Centro", "14-05": "Barrio Cabañas", "14-06": "Barrio Alegría" }[datos.barrio_codigo], total_asignadas: Number(datos.total_asignadas), tipo_documento: datos.tipo_documento });
    lotesQa.unshift(nuevo);
    return nuevo;
  }
  const uno = ruta.match(/^\/lotes\/(\d+)$/);
  if (uno) return lotesQa.find((item) => item.id === Number(uno[1])) || {};
  if (ruta === "/lotes") {
    const query = new URL(url).searchParams;
    const items = lotesQa.filter((lote) => (!query.get("estado") || lote.estado === query.get("estado")) && (!query.get("fecha_hasta") || lote.fecha <= query.get("fecha_hasta")) && (!query.get("fecha_desde") || lote.fecha >= query.get("fecha_desde")));
    const abiertos = items.filter((lote) => lote.estado === "ABIERTO").length;
    return { items, total: items.length, page: 1, total_pages: 1, resumen: { responsables: 2, asignadas: items.reduce((sum, lote) => sum + lote.total_asignadas, 0), abiertos, entregadas: 0, efectividad: 0 } };
  }
  if (ruta === "/no-entregadas") return { items: [], total: 0, page: 1, total_pages: 1 };
  return {};
};

window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (fichasQa.length && url.startsWith(API_URL)) {
    if (/\/clandestinos\/fichas\?/.test(url)) return Promise.resolve(respuesta({ items: fichasQa, counts: { pending: fichasQa.length }, total: fichasQa.length, page: 1, total_pages: 1, service_stats: {} }));
    if (url.includes("/clandestinos/fichas/por-ids")) return Promise.resolve(respuesta({ items: deLasQa(cuerpo(init).ids), skipped: [] }));
    if (url.includes("/clandestinos/fichas/aviso-lote")) {
      const datos = cuerpo(init);
      const items = deLasQa(datos.ids).map((ficha) => Object.assign(ficha, { fecha_aviso: datos.fecha_aviso, aviso_plazo_tipo: datos.plazo.tipo, aviso_plazo_valor: datos.plazo.tipo === "fecha" ? null : datos.plazo.valor, fecha_limite_aviso: computeFechaLimite(datos.fecha_aviso, datos.plazo), firmante_aviso: datos.firmante_aviso, cargo_firmante: datos.cargo_firmante }));
      return Promise.resolve(respuesta({ items, skipped: [] }));
    }
    if (url.includes("/clandestinos/fichas/avisos-impresos")) return Promise.resolve(respuesta({ updated: cuerpo(init).ids?.length || 0 }));
    const marcar = url.match(/\/inmuebles\/(\d+)\/mark-printed/);
    if (marcar) { const ficha = deLasQa([marcar[1]])[0]; if (ficha) Object.assign(ficha, { printed_at: new Date().toISOString(), estado_padron: "reportada" }); return Promise.resolve(respuesta(ficha || {})); }
  }
  if (!url.startsWith(API_URL)) return fetchOriginal(input, init);
  if (url.includes("/auth/me")) return Promise.resolve(respuesta({ user: usuario }));
  if (/\/users(\?|$)/.test(url) && (!init?.method || init.method === "GET")) return Promise.resolve(respuesta(usuariosQa));
  const renombrar = url.match(/\/users\/(\d+)\/name$/);
  if (renombrar) {
    const target = usuariosQa.find((item) => item.id === Number(renombrar[1]));
    if (target) Object.assign(target, { full_name: cuerpo(init).full_name, updated_at: new Date().toISOString() });
    return Promise.resolve(respuesta({ user: target, fichas: 3, personal: 1, fichasOmitidas: false }));
  }
  // ?banco=1: candidatos de mentira (con copias y con posible desmembración).
  if (params.get("banco") === "equipo") {
    if (url.includes("/clandestinos/banco/tecnicos")) return Promise.resolve(respuesta(asignacionesQa.map((item) => ({ id: item.id, nombre: item.nombre, role: "operator", pendientes: item.pendientes }))));
    if (url.includes("/clandestinos/banco/asignar")) {
      const datos = cuerpo(init);
      const elegidos = asignacionesQa.filter((item) => datos.tecnico_ids?.includes(item.id));
      const parte = Math.ceil((datos.ids?.length || 0) / Math.max(1, elegidos.length));
      return Promise.resolve(respuesta({ asignables: datos.ids?.length || 0, omitidos: 0, plan: elegidos.map((item, index) => ({ tecnico: { id: item.id, nombre: item.nombre }, total: Math.max(0, Math.min(parte, (datos.ids?.length || 0) - parte * index)), barrios: [{ barrio: "Colonia Maria Milgrosa", total: parte }], reasignados: 0 })) }));
    }
    if (/\/clandestinos\/banco(\?|$)/.test(url)) {
      const query = new URL(url).searchParams;
      const asignado = query.get("asignado") || "";
      const items = bancoEquipoQa.filter((item) => (asignado === "none" ? item.asignado_a == null : asignado === "mine" ? item.asignado_a === 1 : asignado ? String(item.asignado_a) === asignado : true));
      return Promise.resolve(respuesta({ items, counts: { clandestino: 33, sin_determinar: 9, registrado: 0 }, estados: equipoTotales, total: items.length, page: 1, total_pages: 1, barrios: ["Colonia Maria Milgrosa"], barrio_counts: [{ barrio: "Barrio El Centro", total: 94, clandestino: 72, sin_determinar: 6, registrado: 16 }, { barrio: "Colonia Maria Milgrosa", total: 42, clandestino: 33, sin_determinar: 9, registrado: 0 }], asignaciones: asignacionesQa, sin_asignar: 255 }));
    }
  }
  if (params.get("banco") && /\/clandestinos\/banco(\?|$)/.test(url)) {
    return Promise.resolve(respuesta({ items: bancoQa, counts: { clandestino: 2, sin_determinar: 1, registrado: 0 }, estados: { pendiente: 3, enviado: 0, descartado: 2 }, total: bancoQa.length, page: 1, total_pages: 1, barrios: ["Barrio El Centro"], barrio_counts: [], asignaciones: [], sin_asignar: 3 }));
  }
  if (params.get("entregas") && url.includes("/entregas/")) return Promise.resolve(respuesta(entregasQa(url, init)));
  // Las listas paginadas se copian con {...datos}: necesitan sus campos de verdad.
  if (/\/(clandestinos\/fichas|clandestinos\/banco)(\?|$)/.test(url)) {
    return Promise.resolve(respuesta({ items: [], counts: {}, total: 0, page: 1, total_pages: 1, service_stats: {} }));
  }
  const vacia = respuesta([]);
  vacia.json = async () => vacio();
  // readJsonResponse lee el texto y lo pasa por JSON.parse: esta marca vuelve como vacío.
  vacia.text = async () => MARCA_VACIA;
  return Promise.resolve(vacia);
};

class SocketMudo extends EventTarget {
  readyState = 3;
  send() {}
  close() {}
}
window.WebSocket = SocketMudo;

// La App se importa después de preparar sesión y fetch; los estilos van arriba,
// en el mismo orden que main.jsx (sidebar.css debe ganarle a styles.css).
const [{ default: ReactDOM }, { default: App }] = await Promise.all([import("react-dom/client"), import("../App")]);

// Si un módulo no tolera los datos de mentira, se ve el error en vez de una pantalla negra.
class Captura extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? <pre id="qa-error" style={{ whiteSpace: "pre-wrap", padding: 16 }}>{String(this.state.error?.stack || this.state.error)}</pre> : this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<Captura><App /></Captura>);
