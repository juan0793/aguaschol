import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import CierreLoteDialog from "../modules/entregas/components/CierreLoteDialog";
import "../styles.css";
import "../modules/clandestinos/styles/clandestinos.css";
import "../modules/entregas/styles/entregas.css";

// Datos sintéticos solo para QA: el cierre de un lote de 40 facturas con la API simulada.
// ?sobrantes=3 escribe esa cantidad al abrir para revisar las filas de no entregadas.
const motivos = [
  ["CASA_CERRADA", "Casa cerrada"], ["DIRECCION_NO_ENCONTRADA", "Dirección no encontrada"], ["PREDIO_DESHABITADO", "Predio deshabitado"],
  ["ABONADO_NO_LOCALIZADO", "Abonado no localizado"], ["DATOS_INCONSISTENTES", "Datos inconsistentes"], ["RECHAZO_RECEPCION", "Rechazo de recepción"], ["OTRO", "Otro"]
].map(([codigo, etiqueta]) => ({ codigo, etiqueta, requiere_observacion: codigo === "OTRO" }));
const config = { motivos, permissions: { can_close_own_lote: true } };
const lote = { id: 141, estado: "ABIERTO", responsable_nombre: "Melissa", barrio_nombre: "BO. EL ESTADIO", tipo_documento: "FACTURA", fecha: "2026-10-13", total_asignadas: 40, no_entregadas: [], observacion_responsable: "" };
let siguiente = 1;
const api = {
  buscarClave: async () => ({ matches: [] }),
  agregarNoEntregadas: async (_id, { items }) => ({ no_entregadas: items.map((item) => ({ ...item, id: siguiente++, estado: "PENDIENTE" })) }),
  eliminarNoEntregada: async () => ({}),
  cerrarLote: async () => ({ ...lote, estado: "CERRADO" })
};

function Vista() {
  const [abierto, setAbierto] = useState(true);
  return abierto
    ? <CierreLoteDialog api={api} config={config} lote={lote} sessionUserId={1} notify={(m) => console.log(m)} onClose={() => setAbierto(false)} onSaved={() => setAbierto(false)} />
    : <p style={{ padding: 20 }}>Lote cerrado (QA).</p>;
}

try { window.sessionStorage.clear(); } catch { /* sin almacenamiento */ }
ReactDOM.createRoot(document.getElementById("root")).render(<Vista />);
const sobrantes = new URLSearchParams(location.search).get("sobrantes");
if (sobrantes) setTimeout(() => {
  const input = document.querySelector('input[aria-label="No entregadas"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, sobrantes);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}, 600);
