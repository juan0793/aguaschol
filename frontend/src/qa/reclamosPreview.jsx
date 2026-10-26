import React from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import ReclamosWorkspace from "../modules/reclamos/ReclamosWorkspace";

// Banco de pruebas de Reclamos de entrega (vista de la oficina). Datos de mentira con la forma
// real de /api/entregas/reclamos; ningún nombre ni clave es del padrón. Abre `qa-reclamos.html`.

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
const data = {
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
const apiFetch = async (ruta = "") => {
  await new Promise((resolve) => window.setTimeout(resolve, 150));
  const cuerpo = respuestas[String(ruta).split("?")[0]] || data;
  return new Response(JSON.stringify(cuerpo), { status: 200, headers: { "Content-Type": "application/json" } });
};
const session = { user: { id: 1, role: "admin", full_name: "Administración de prueba" } };
ReactDOM.createRoot(document.getElementById("root")).render(<ReclamosWorkspace apiFetch={apiFetch} session={session} showAlert={() => {}} />);
