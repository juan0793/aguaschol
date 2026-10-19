import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import "../modules/reports/reports.css";
import ReportsWorkspace from "../modules/reports/ReportsWorkspace";

// Banco de pruebas del diálogo "Generar documento" de Reportes GPS. Datos de mentira con
// la forma real: barrios, jornadas y puntos inventados, sin padrón. `?abrir=1` abre el
// diálogo al cargar.

const zona = (overrideKey, displayName, total) => ({
  zone: overrideKey,
  overrideKey,
  displayName,
  displayKicker: "Zona",
  items: Array.from({ length: total }, (_, indice) => ({ id: `${overrideKey}-${indice}`, point_type: "caja_registro", latitude: 13.3 + indice * 0.0001, longitude: -87.19 }))
});

const ZONAS = [
  zona("113", "113 - Sin nombre en el catálogo", 93),
  zona("114", "114 - Lotificacion Beel", 1),
  zona("sin", "Zona no especificada", 4)
];

const DIAS = [
  { key: "2026-10-19", total: 0 },
  { key: "2026-10-16", total: 331 },
  { key: "2026-10-15", total: 83 },
  { key: "2026-10-14", total: 94 },
  { key: "2026-08-31", total: 338 },
  { key: "2026-08-27", total: 1 },
  { key: "2026-08-13", total: 125 },
  { key: "2026-08-07", total: 51 }
];

const sinAccion = () => {};
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function Preview() {
  const [settings, setSettings] = useState({
    title: "Reporte de levantamiento de campo",
    subtitle: "Aguas de Choluteca, S.A. de C.V.",
    description: "Consolidado institucional de coordenadas, totales y puntos registrados por el equipo técnico.",
    manual_barrio: "",
    manual_location: "",
    report_notes: ""
  });
  const model = {
    activeDateKey: "2026-10-14",
    apiFetch: async () => ({ ok: true, json: async () => [] }),
    data: { zones: ZONAS, totalPoints: 98, totalZones: 3, totalsByType: { "Caja de registro": 98 } },
    days: DIAS,
    debtChart: { topRows: [] },
    debtSummary: {},
    debtReport: null,
    settings,
    staff: { data_engineer: "" },
    technicians: [""],
    regulatorDays: [],
    selectedRegulatorDays: [],
    reportDraft: {},
    loadingPoints: false,
    loadingContexts: false,
    loadingDebt: false,
    savingPoint: false,
    generatingRegulator: false,
    onSettingsChange: (event) => setSettings((actual) => ({ ...actual, [event.target.name]: event.target.value })),
    onLoadJornadas: async (claves) => {
      await esperar(700);
      return claves.map((dateKey) => ({ dateKey, data: { zones: ZONAS, totalPoints: 98 } }));
    },
    onDownloadTechnical: async ({ onProgreso } = {}) => { onProgreso?.("Dibujando los mapas…"); await esperar(900); onProgreso?.("Armando el PDF…"); await esperar(600); },
    onDownloadCensus: async () => esperar(600),
    onDownloadBrief: async () => esperar(600),
    onDownloadRegulator: async () => esperar(600),
    onPrintTechnical: sinAccion,
    onPrintCensus: sinAccion,
    onPrintBrief: sinAccion,
    notify: sinAccion,
    onSelectDay: sinAccion,
    onRefresh: sinAccion
  };
  return <ReportsWorkspace model={new Proxy(model, { get: (destino, clave) => (clave in destino ? destino[clave] : sinAccion) })} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Preview />);

if (new URLSearchParams(window.location.search).get("abrir") === "1") {
  setTimeout(() => [...document.querySelectorAll("button")].find((boton) => boton.textContent.trim() === "Generar documento")?.click(), 300);
}
