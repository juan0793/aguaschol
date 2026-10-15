// Reglas del registro de fallas del equipo. Sin base de datos, para probarlas solas.
const ESCRITURAS = ["POST", "PUT", "PATCH", "DELETE"];
const MODULOS = {
  entregas: "Entregas", inspecciones: "Inspecciones", "map-points": "Puntos GPS", inmuebles: "Fichas",
  clandestinos: "Clandestinos", "field-validation": "Control territorial", transport: "Transporte",
  planos: "Planos", profile: "Perfil", notes: "Apuntes", claves: "Padrón", gis: "SIG"
};
const VERBOS = { POST: "Guardar", PUT: "Actualizar", PATCH: "Actualizar", DELETE: "Eliminar", GET: "Consultar" };

// Lo que hacía la persona, dicho como en la app.
const ACCIONES = [
  [/^POST \/api\/entregas\/lotes$/, () => "Crear lote de entregas"],
  [/^POST \/api\/entregas\/lotes\/(\d+)\/cerrar$/, (m) => `Cerrar lote #${m[1]}`],
  [/^POST \/api\/entregas\/lotes\/(\d+)\/reabrir$/, (m) => `Reabrir lote #${m[1]}`],
  [/^POST \/api\/entregas\/lotes\/(\d+)\/no-entregadas$/, (m) => `Registrar no entregadas del lote #${m[1]}`],
  [/^(?:PATCH|PUT) \/api\/entregas\/lotes\/(\d+)$/, (m) => `Editar lote #${m[1]}`],
  [/^POST \/api\/entregas\/no-entregadas\/(\d+)\/intentos$/, (m) => `Registrar intento de entrega #${m[1]}`],
  [/^(?:PATCH|PUT) \/api\/entregas\/no-entregadas\/(\d+)$/, (m) => `Editar documento no entregado #${m[1]}`],
  [/^POST \/api\/entregas\/reclamos\/(\d+)\/respuesta$/, (m) => `Responder el reclamo #${m[1]}`],
  [/^POST \/api\/inspecciones$/, () => "Crear inspección"],
  [/^POST \/api\/inspecciones\/(\d+)\/finalizar$/, (m) => `Finalizar inspección #${m[1]}`],
  [/^(?:POST|PATCH|PUT) \/api\/inspecciones\/(\d+)\/estado$/, (m) => `Cambiar estado de la inspección #${m[1]}`],
  [/^POST \/api\/inspecciones\/(\d+)\/gps$/, (m) => `Registrar GPS de la inspección #${m[1]}`],
  [/^(?:PATCH|PUT) \/api\/inspecciones\/(\d+)$/, (m) => `Actualizar la inspección #${m[1]}`],
  [/^POST \/api\/map-points$/, () => "Guardar punto GPS"],
  [/^(?:PATCH|PUT) \/api\/map-points\/(\d+)$/, (m) => `Editar punto GPS #${m[1]}`],
  [/^DELETE \/api\/map-points\/(\d+)$/, (m) => `Eliminar punto GPS #${m[1]}`],
  [/^POST \/api\/inmuebles$/, () => "Crear ficha clandestina"],
  [/^(?:PATCH|PUT) \/api\/inmuebles\/(\d+)$/, (m) => `Editar ficha #${m[1]}`],
  [/^POST \/api\/clandestinos\/banco\/(\d+)\/enviar$/, (m) => `Pasar a ficha el punto del banco #${m[1]}`],
  [/^POST \/api\/clandestinos\/banco\/(\d+)\/descartar$/, (m) => `Descartar el punto del banco #${m[1]}`],
  [/^(?:PATCH|PUT) \/api\/field-validation\/(\d+)$/, (m) => `Validar punto GPS #${m[1]}`]
];

export const normalizarRuta = (ruta = "") => {
  const limpia = String(ruta).split("?")[0].trim().replace(/\/+$/, "") || "/";
  const conApi = limpia.startsWith("/api/") || limpia === "/api" ? limpia : `/api${limpia.startsWith("/") ? "" : "/"}${limpia}`;
  return conApi.slice(0, 200);
};

export const accionDeRuta = (metodo = "", ruta = "") => {
  const clave = `${String(metodo).toUpperCase()} ${normalizarRuta(ruta)}`;
  for (const [patron, texto] of ACCIONES) {
    const match = clave.match(patron);
    if (match) return texto(match);
  }
  const modulo = normalizarRuta(ruta).split("/")[2] || "";
  return `${VERBOS[String(metodo).toUpperCase()] || "Acción"} en ${MODULOS[modulo] || "la app"}`;
};

export const tipoDeCodigo = (codigo) => (Number(codigo) >= 500 ? "error_servidor" : "rechazada");

// El servidor anota la falla de quien no es administración ni Gerencia (de solo lectura): toda acción que guarda algo
// y no se pudo (404, 409, 400…) y cualquier error del servidor. No cuenta la sesión
// vencida (401), la prueba de perfil ni el propio registro de fallas.
export const debeRegistrar = ({ metodo = "", ruta = "", codigo = 0, user = null } = {}) => {
  if (!user?.id || ["admin", "gerente"].includes(user.role) || user.preview) return false;
  const status = Number(codigo);
  if (status < 400 || status === 401) return false;
  // La sesión (ingresar, cambiar contraseña, prueba de perfil) no es trabajo del equipo que se pierda.
  if (/^\/api\/(fallas|auth)(\/|$)/.test(normalizarRuta(ruta))) return false;
  return status >= 500 || ESCRITURAS.includes(String(metodo).toUpperCase());
};

const MAX_EDAD_MS = 14 * 86400000;
// Fallas que el teléfono guardó sin señal y manda al volver la conexión.
export const validarFallasDispositivo = (cuerpo, ahora = Date.now()) => {
  const lista = Array.isArray(cuerpo?.fallas) ? cuerpo.fallas : null;
  if (!lista || !lista.length || lista.length > 50) throw Object.assign(new Error("Envía entre 1 y 50 fallas."), { status: 400 });
  return lista.map((falla) => {
    const metodo = String(falla?.metodo || "").toUpperCase();
    const ruta = String(falla?.ruta || "");
    const instante = Date.parse(falla?.ocurrido_en);
    if (!ESCRITURAS.includes(metodo) || !ruta.startsWith("/") || ruta.length > 300) throw Object.assign(new Error("Falla con acción no válida."), { status: 400 });
    if (!Number.isFinite(instante) || instante > ahora + 5 * 60000 || instante < ahora - MAX_EDAD_MS) throw Object.assign(new Error("Falla con fecha no válida."), { status: 400 });
    if (normalizarRuta(ruta).startsWith("/api/fallas")) throw Object.assign(new Error("Falla con acción no válida."), { status: 400 });
    return {
      metodo,
      ruta: normalizarRuta(ruta),
      accion: accionDeRuta(metodo, ruta),
      tipo: "sin_conexion",
      codigo: null,
      mensaje: String(falla?.mensaje || "Sin conexión con el servidor.").slice(0, 300),
      veces: Math.min(Math.max(Math.floor(Number(falla?.veces) || 1), 1), 500),
      ocurrido_en: new Date(instante)
    };
  });
};
