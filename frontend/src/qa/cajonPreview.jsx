import React from "react";
import ReactDOM from "react-dom/client";
import InspeccionDetallePanel from "../modules/inspecciones/components/InspeccionDetallePanel";
import "../styles.css";
import "../modules/clandestinos/styles/clandestinos.css";
import "../modules/inspecciones/styles/inspecciones.css";

// Banco de pruebas del cajón de detalle: se monta con una API de mentira para
// poder revisar jerarquía, íconos y transiciones sin sesión ni backend.

const INSPECCION = {
  id: 21,
  numero_inspeccion: "INS-2026-00021",
  clave_catastral: "43-19-06",
  abonado_nombre_snapshot: "CIPRIANO SANCHEZ FLORES",
  barrio_snapshot: "COL. VENECIA",
  motivo: "Verificación de conexión",
  estado: "ASIGNADA",
  fecha_asignacion: "2026-09-18",
  trabajo_solicitado: "VERIFICAR SI ES CASA DE HABITACIÓN O APARTAMENTOS.",
  informacion_encontrada: "",
  observaciones: "",
  requiere_seguimiento: false,
  updated_at: "2026-09-18T10:00:00Z",
  print_status: { ORDEN: { impreso: false }, REPORTE: { impreso: false } },
  participantes: [
    { id: 1, rol: "RESPONSABLE", tecnico_id: 7, tecnico_nombre: "Melisa maradiaga" },
    { id: 2, rol: "APOYO", tecnico_id: 9, tecnico_nombre: "Luis herrera" }
  ]
};

const HISTORIAL = [
  { resumen: "Inspección asignada a Melisa maradiaga", actor_name: "admin", created_at: "2026-09-18T10:02:00Z" },
  { resumen: "Se agregó a Luis herrera como apoyo", actor_name: "admin", created_at: "2026-09-18T10:05:00Z" }
];

const api = {
  detail: async () => INSPECCION,
  gps: async () => [],
  historial: async () => HISTORIAL,
  update: async (_id, patch) => ({ ...INSPECCION, ...patch, updated_at: new Date().toISOString() }),
  addGps: async () => ({}),
  corregirTexto: async (texto) => ({ text: texto })
};

const session = { user: { id: 1, role: "admin", full_name: "Administrador" } };

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InspeccionDetallePanel
      api={api}
      session={session}
      id={21}
      tecnicosElegibles={[{ id: 11, full_name: "Diego Andino" }, { id: 12, full_name: "Rosa Mejía" }]}
      notify={() => {}}
      onClose={() => {}}
      onChanged={() => {}}
    />
  </React.StrictMode>
);
