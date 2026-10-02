// Banco de prueba del armazón (encabezado y menú lateral) con datos de mentira:
// monta la App real con una sesión falsa y respuestas vacías, sin backend.
// ?rol=admin|operator|validadora_campo|transport elige el perfil y ?vista= la pantalla.
import "../styles.css";
import "../components/sidebar/sidebar.css";
import "../styles/audit-console.css";
import { API_URL } from "../config/api";
import { AUTH_STORAGE_KEY } from "../constants/storageKeys";

const params = new URLSearchParams(window.location.search);
const rol = params.get("rol") || "admin";
// ?vista=/entregas abre esa pantalla: la App elige la vista por la ruta.
if (params.get("vista")) window.history.replaceState(null, "", params.get("vista"));
const usuario = { id: 1, username: "qa", full_name: "Usuario QA", email: "qa@local.test", role: rol, force_password_change: false };
window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: "qa-token", user: usuario }));

const respuesta = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const fetchOriginal = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (!url.startsWith(API_URL)) return fetchOriginal(input, init);
  if (url.includes("/auth/me")) return Promise.resolve(respuesta({ user: usuario }));
  // Entregas espera objetos en su configuración y resumen.
  if (/\/entregas\/(config|resumen)/.test(url)) return Promise.resolve(respuesta({}));
  return Promise.resolve(respuesta([]));
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

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
