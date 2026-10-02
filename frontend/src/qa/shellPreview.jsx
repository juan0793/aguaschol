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
const cuerpo = (init) => { try { return JSON.parse(init?.body || "{}"); } catch { return {}; } };
const deLasQa = (ids = []) => fichasQa.filter((ficha) => ids.map(Number).includes(ficha.id));

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
