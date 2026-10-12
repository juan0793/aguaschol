import React from "react";
import ReactDOM from "react-dom/client";
import AvanceJornada from "../modules/entregas/components/AvanceJornada";
import "../styles.css";
import "../modules/entregas/styles/entregas.css";

// Datos sintéticos solo para QA: técnicos y barrios del reparto con estados de ejemplo.
const zonas = { "Carlos Osorto": 4, "Luis Fernando": 7, Alfredo: 6, "Diego Zaldaña": 8, "Oscar Álvarez": 11, Melissa: 7, Sayma: 12, "Elmer Gómez": 11, Sindy: 9 };
let codigo = 1;
const barrios = Object.entries(zonas).flatMap(([nombre, cantidad], persona) => Array.from({ length: cantidad }, (_, i) => {
  const estado = i < Math.round(cantidad * [0.75, 0.4, 0.5, 0.6, 0.3, 0.55, 0.45, 0.2, 0.35][persona]) ? "entregado" : i === cantidad - 1 && persona % 2 ? "en_curso" : "pendiente";
  const id = codigo++; return { codigo: String(id), nombre: `Barrio de prueba ${id}`, claves: 200, responsable_id: persona + 1, responsable_nombre: nombre, estado, lotes: estado === "pendiente" ? 0 : 1, asignadas: estado === "pendiente" ? 0 : 180, entregadas: estado === "entregado" ? 172 : 0, lotes_cerrados: estado === "entregado" ? [100 + id] : [], lotes_abiertos: estado === "en_curso" ? [200 + id] : [] };
}));
const contar = (estado) => barrios.filter((barrio) => barrio.estado === estado).length;
const mes = { desde: "2026-10-01", hasta: "2026-10-12", total: barrios.length, entregados: contar("entregado"), en_curso: contar("en_curso"), pendientes: contar("pendiente"), porcentaje: Math.round(contar("entregado") / barrios.length * 1000) / 10, documentos_entregados: contar("entregado") * 172, ciclo_declarado: false, barrios };
const lotesHoy = [
  { id: 41, fecha: "2026-10-12", responsable_id: 3, responsable_nombre: "Alfredo", barrio_nombre: "Barrio Suyapa", estado: "CERRADO", total_asignadas: 336, total_entregadas: 332, total_sobrantes: 4, pendientes: 0, tipo_documento: "FACTURA" },
  { id: 42, fecha: "2026-10-12", responsable_id: 7, responsable_nombre: "Sayma", barrio_nombre: "Colonia Isidro Pineda", estado: "CERRADO", total_asignadas: 107, total_entregadas: 101, total_sobrantes: 6, pendientes: 0, tipo_documento: "FACTURA" }
];
const model = { lotesHoy, resumenHoy: { lotes: 2, cerrados: 2, asignadas: 443, entregadas: 433, sobrantes: 10, en_ruta: 0 }, totalHoy: 2, anterior: null, totalAnterior: 0, desdeAnterior: "", loading: false, error: "", reload: () => {}, mes };
// QA: ?lista=todos abre la lista completa; ?lista=N la abre desde el tramo del técnico N.
const qaLista = new URLSearchParams(location.search).get("lista");
if (qaLista) setTimeout(() => (qaLista === "todos" ? document.querySelector(".ent-mes-pie button") : document.querySelectorAll(".ent-mes-grupo")[Number(qaLista)])?.click(), 800);
ReactDOM.createRoot(document.getElementById("root")).render(<main className="cl-module ent-module" style={{ maxWidth: 1280, margin: "24px auto", padding: "0 20px" }}><AvanceJornada model={model} fecha="2026-10-12" onVerAnteriores={() => {}} onAbrirLote={() => {}} /></main>);
