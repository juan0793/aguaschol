import React from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import ReclamosWorkspace from "../modules/reclamos/ReclamosWorkspace";

// Banco de pruebas de Reclamos de entrega. Datos de mentira con la forma real de
// /api/entregas/reclamos; ningún nombre ni clave es del padrón. Abre `qa-reclamos.html`:
//   (sin parámetro) oficina · ?rol=tecnico técnico de campo · ?rol=vista "Ver como técnico" (solo lectura)
//   · ?vacio=1 sin reclamos.
const parametros = new URLSearchParams(window.location.search);
const rol = parametros.get("rol") || "";

const ahora = Date.now();
const hace = (dias) => new Date(ahora - dias * 86400000).toISOString();
const tecnicos = ["Técnica Prueba Uno", "Técnico Prueba Dos", "Técnico Prueba Tres", "Técnica Prueba Cuatro", "Técnico Prueba Cinco", "Técnica Prueba Seis"];
const items = Array.from({ length: 6 }, (_, i) => ({
  id: 100 + i,
  estado: "SIN_RESPUESTA",
  abonado_nombre: `ABONADO DE PRUEBA ${i + 1}`,
  clave_catastral: `99-0${i + 1}-001-0${i + 1}`,
  numero_abonado: String(20000 + i),
  barrio_nombre: ["Col. Ficticia", "Bo. de Prueba Norte", "Bo. Ejemplo Sur"][i % 3],
  motivo_etiqueta: i % 2 ? "No le llegó" : "Otro",
  cantidad: 1,
  tipo_documento: "FACTURA",
  detalle: i % 2 ? "" : "Dice que la factura llegó a otra casa de la misma calle (texto de prueba).",
  responsable: { id: 10 + (i % 3), nombre: tecnicos[i % 3] },
  responsable_origen: i % 2 ? "LOTE" : "REPARTO",
  lote: i % 2 ? { id: 40 + i, fecha: hace(9).slice(0, 10) } : null,
  created_at: hace(7 - i),
  created_by_nombre: "Oficina de prueba"
}));
// El técnico ve los activos: atrasados, recientes, uno respondido y textos en mayúsculas
// como los escribe la oficina.
const itemsCampo = [
  { ...items[0], id: 201, created_at: hace(6), detalle: "LE ESTÁ LLEGANDO LA FACTURA CADA DOS MESES. DICE QUE EL MES PASADO NO LE DEJARON NADA (TEXTO DE PRUEBA).", motivo_etiqueta: "No le llegó" },
  { ...items[1], id: 202, created_at: hace(2), detalle: "" },
  { ...items[2], id: 203, created_at: new Date(ahora - 40 * 60000).toISOString(), cantidad: 2, tipo_documento: "NOTA_COBRO", detalle: "La nota llegó a nombre del dueño anterior (texto de prueba)." },
  { ...items[3], id: 204, estado: "RESPONDIDO", created_at: hace(4), respuesta: "La dejé el lunes con la vecina de la casa 12; mañana confirmo con el abonado (texto de prueba).", respondido_por_nombre: "Técnico Prueba Dos", respondido_en: hace(1) }
];
const vacio = parametros.get("vacio") === "1";
const data = rol ? {
  items: vacio ? [] : itemsCampo,
  total: vacio ? 0 : itemsCampo.length,
  por_pagina: 30,
  resumen: vacio ? { sin_respuesta: 0, respondido: 0, cerrado_ciclo: 0, mas_antiguo_sin_respuesta: null } : { sin_respuesta: 3, respondido: 1, cerrado_ciclo: 5, mas_antiguo_sin_respuesta: hace(6) },
  ciclo_desde: hace(16).slice(0, 10),
  por_tecnico: [],
  motivos: [],
  permisos: { registrar: false, responder: rol === "tecnico", cerrar: false, archivo: false },
  estado: "ABIERTOS"
} : {
  items,
  total: items.length,
  por_pagina: 30,
  resumen: { sin_respuesta: 6, respondido: 0, cerrado_ciclo: 5, mas_antiguo_sin_respuesta: hace(7) },
  ciclo_desde: hace(16).slice(0, 10),
  por_tecnico: tecnicos.map((nombre, i) => ({ id: 10 + i, nombre, sin_respuesta: [4, 1, 1, 0, 0, 0][i], respondido: 0, cerrado: [0, 0, 2, 1, 1, 1][i] })),
  motivos: [{ codigo: "NO_LLEGO", etiqueta: "No le llegó" }, { codigo: "OTRO", etiqueta: "Otro" }],
  permisos: { registrar: true, responder: true, cerrar: true, archivo: true },
  estado: "ABIERTOS"
};

// La ficha impresa pide además dónde queda cada clave (sin SIG aquí) y el documento sobrante:
// los reclamos 101 y 103 quedaron como sobrante en un lote.
const respuestas = {
  "/entregas/reclamos/ubicaciones": { ubicaciones: {} },
  "/entregas/reclamos/sobrantes": { sobrantes: { 101: { id: 7, lote_id: 41, fecha: hace(9).slice(0, 10), motivo: "Casa cerrada" }, 103: { id: 9, lote_id: 43, fecha: hace(12).slice(0, 10), motivo: "Dirección incorrecta" } } }
};
const apiFetch = async (ruta = "", opciones = {}) => {
  await new Promise((resolve) => window.setTimeout(resolve, 150));
  const respuesta = String(ruta).match(/^\/entregas\/reclamos\/(\d+)\/respuesta$/);
  if (respuesta && opciones.method === "POST") {
    const item = data.items.find((fila) => fila.id === Number(respuesta[1]));
    Object.assign(item, { estado: "RESPONDIDO", respuesta: JSON.parse(opciones.body).respuesta, respondido_por_nombre: session.user.full_name, respondido_en: new Date().toISOString() });
    return new Response(JSON.stringify(item), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const cuerpo = respuestas[String(ruta).split("?")[0]] || data;
  return new Response(JSON.stringify(cuerpo), { status: 200, headers: { "Content-Type": "application/json" } });
};
const session = { user: rol
  ? { id: 2, role: "operator", full_name: "Técnico Prueba Dos", preview: rol === "vista" }
  : { id: 1, role: "admin", full_name: "Administración de prueba" } };
ReactDOM.createRoot(document.getElementById("root")).render(<ReclamosWorkspace apiFetch={apiFetch} session={session} showAlert={() => {}} />);
