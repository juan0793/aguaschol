import React from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import PozosWorkspace from "../modules/pozos/PozosWorkspace";

// Banco de pruebas de Pozos. Todos los nombres y claves son ficticios; cubre cada estado legal.
// Abre `qa-pozos.html`.

const colonias = ["Colonia Ensayo Norte", "Barrio Muestra", "Sector Prueba Sur", "Loma Simulada", "Campo Modelo"];
const estadosLegales = ["al_dia", "por_vencer", "vencido", "sin_permiso", "no_requiere", "por_definir", "en_tramite"];
const usosLegales = ["industrial_comercial", "purificadora", "agroforestal", "industrial_comercial", "domiciliario", "sin_dato", "comunitario", "sanitario"];

const legalDe = (i) => {
  const estado = estadosLegales[i % estadosLegales.length];
  const uso = usosLegales[i % usosLegales.length];
  const esProductivo = !["domiciliario", "comunitario", "sin_dato"].includes(uso);
  const vence = estado === "vencido" ? "2025-08-15" : estado === "por_vencer" ? "2027-02-15" : "2031-06-15";
  const caudal = Number((0.7 + (i % 5) * 0.35).toFixed(2));
  const volumen = Math.round(caudal * 3.6 * (4 + (i % 4)) * 22 * 12);
  return {
    uso,
    tamano_empresa: esProductivo ? (i % 2 ? "micro_pequena" : "mediana_grande") : "no_aplica",
    clave_catastral: i % 3 === 0 ? `QA-POZO-${String(i + 1).padStart(3, "0")}` : "",
    titular: `Titular ficticio ${i + 1}`,
    permiso_tipo: estado === "en_tramite" ? "en_tramite" : estado === "sin_permiso" ? "ninguno" : estado === "por_definir" ? "sin_dato" : estado === "no_requiere" ? "ninguno" : estado === "por_vencer" ? "licencia_municipal" : "permiso_municipal",
    permiso_numero: ["sin_permiso", "por_definir", "no_requiere"].includes(estado) ? "" : `QA-PERM-${100 + i}`,
    permiso_fecha: ["sin_permiso", "por_definir", "no_requiere"].includes(estado) ? null : "2021-06-15",
    permiso_vence: ["sin_permiso", "por_definir", "no_requiere"].includes(estado) ? null : vence,
    caudal_autorizado_lps: esProductivo ? caudal : null,
    caudal_lps: caudal,
    horas_bombeo_dia: 4 + (i % 4),
    dias_mes: 22,
    volumen_declarado_m3: i % 5 === 0 ? null : volumen - 120,
    anio_declarado: i % 5 === 0 ? null : 2026,
    notas: "Registro ficticio para revisión visual.",
    actualizado_por: "Administración de prueba",
    actualizado_at: "2026-11-04T12:00:00.000Z",
    estado: i === 7 ? "por_definir" : estado,
    falta_declaracion: i % 5 === 0,
    articulo: estado === "no_requiere" ? "Art. 135" : estado === "por_vencer" ? "Art. 157" : estado === "sin_permiso" ? "Arts. 136 y 152–161" : "Arts. 57, 135 y 140",
    // Como el servidor: vence escrito aparte del que rige; el pozo 8 trae un registro de otro pozo.
    permiso_vence_manual: i % 2 ? null : (["sin_permiso", "por_definir", "no_requiere", "en_tramite"].includes(estado) ? null : vence),
    pozo_codigo: `Pchol.-${String((i % 11) + 1).padStart(3, "0")}`,
    desfasado: i === 7,
    registrado_para: i === 7 ? { codigo: "Pchol.-021", nombre: "Pozo de prueba anterior" } : null,
    uso_sugerido: i % 4 === 1 ? "industrial_comercial" : uso,
    volumen_estimado_m3: volumen,
    canon_estimado_l: Number((volumen * 0.0025).toFixed(2))
  };
};
const pozos = Array.from({ length: 14 }, (_, i) => {
  const valida = i !== 9;
  const lat = 13.296 + (i % 5) * 0.004 + Math.floor(i / 5) * 0.0015;
  const lng = -87.195 + (i % 4) * 0.005 + Math.floor(i / 4) * 0.002;
  return {
    id: i + 1,
    codigo: `Pchol.-${String((i % 11) + 1).padStart(3, "0")}`,
    nombre: i % 3 === 0 ? `Pozo de prueba ${i + 1} con un nombre bastante largo para ver el corte` : `Pozo de prueba ${i + 1}`,
    colonia: colonias[i % colonias.length],
    municipio: "Municipio de prueba",
    utm_x: 479000 + i * 120,
    utm_y: valida ? 1470200 + i * 90 : 14702443,
    elevacion_m: i % 4 ? 40 + i : null,
    latitud: valida ? lat : null,
    longitud: valida ? lng : null,
    coordenada_valida: valida,
    codigo_repetido: i >= 11,
    en_uso: i % 5 === 4 ? null : true,
    profundidad_m: i % 3 ? 20 + i * 1.5 : null,
    nivel_freatico_m: i % 2 ? 10 + i * 0.4 : null,
    diametro_pulg: i % 2 ? 6 : 4,
    tipo_bomba: i % 2 ? "Sumergible, 2 hp" : "Bomba de mecate (prueba)",
    temperatura_c: i % 2 ? 31.5 + i * 0.1 : null,
    ph: i % 2 ? [5.4, 6.9, 7.2, 8.9, 6.6][i % 5] : null,
    tds_g_l: i % 2 ? [0.22, 0.57, 1.31, 0.78, 0.4][i % 5] : null,
    salinidad: i % 2 ? 0.16 + i * 0.02 : null,
    oxigeno_disuelto: i % 2 ? 60 + i : null,
    conductividad: i % 2 ? "386/345" : null,
    cloro_residual: i % 2 ? 0.05 : null,
    observaciones: i % 2 ? "Dato de prueba: pozo usado para limpieza, sellado en la parte superior. Encuestado ficticio." : null,
    legal: legalDe(i)
  };
});

// Se repiten los 14 pozos (con id nuevo) para tener más de una página en el listado.
const inventario = [0, 1, 2].flatMap((vuelta) => pozos.map((pozo) => ({ ...pozo, id: pozo.id + vuelta * 100, codigo: `Pchol.-${String(Number(pozo.codigo.slice(-3)) + vuelta * 14).padStart(3, "0")}` })));
let actualizado = "2026-11-04T12:00:00.000Z";
const respuesta = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiFetch = async (url, options = {}) => {
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  const method = (options.method || "GET").toUpperCase();
  if (url.startsWith("/claves/search")) {
    const clave = new URL(url, window.location.origin).searchParams.get("clave") || "";
    const pozo = inventario.find((item) => item.legal?.clave_catastral === clave);
    const matches = pozo ? [{
      clave_catastral: clave,
      abonado: `QA-${pozo.id}`,
      inquilino: `Abonado ficticio ${pozo.id}`,
      barrio_colonia: pozo.colonia,
      agua: pozo.id % 2 ? "N" : "S"
    }] : [];
    return respuesta({ ok: true, query: clave, normalized_query: clave, field: "clave", total_matches: matches.length, exists: Boolean(matches.length), matches });
  }
  const match = url.match(/^\/pozos\/(\d+)\/legal$/);
  if (method === "PUT" && match) {
    const indice = inventario.findIndex((pozo) => pozo.id === Number(match[1]));
    if (indice < 0) return respuesta({ message: "Pozo de prueba no encontrado." }, 404);
    const payload = options.body ? JSON.parse(options.body) : {};
    const manual = payload.permiso_vence || null;
    const vence = manual || (payload.permiso_fecha ? `${Number(String(payload.permiso_fecha).slice(0, 4)) + 10}${String(payload.permiso_fecha).slice(4, 10)}` : null);
    const pozo = { ...inventario[indice], legal: { ...inventario[indice].legal, ...payload, permiso_vence: vence, permiso_vence_manual: manual, desfasado: false, registrado_para: null, estado: payload.permiso_tipo === "en_tramite" ? "en_tramite" : inventario[indice].legal.estado, actualizado_at: new Date().toISOString() } };
    inventario[indice] = pozo;
    actualizado = new Date().toISOString();
    return respuesta(pozo);
  }
  if (url === "/pozos") return respuesta({ fuente: "datos de prueba (QA)", actualizado, resumen: {}, pozos: inventario });
  return respuesta({ message: "Ruta QA no encontrada." }, 404);
};

ReactDOM.createRoot(document.getElementById("root")).render(<PozosWorkspace apiFetch={apiFetch} isAdmin />);
