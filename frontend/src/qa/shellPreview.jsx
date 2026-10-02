// Banco de prueba del armazón (encabezado y menú lateral) con datos de mentira:
// monta la App real con una sesión falsa y respuestas vacías, sin backend.
// ?rol=admin|operator|validadora_campo|transport elige el perfil y ?vista= la pantalla.
import "../styles.css";
import "../components/sidebar/sidebar.css";
import "../styles/audit-console.css";
import { Component } from "react";
import { API_URL } from "../config/api";
import { AUTH_STORAGE_KEY } from "../constants/storageKeys";

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
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url;
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
