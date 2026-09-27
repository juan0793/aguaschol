import React from "react";
import ReactDOM from "react-dom/client";
import RailwayUsageWorkspace from "../components/RailwayUsageWorkspace";
import "../styles.css";

// Banco de pruebas de "Uso en Railway". Datos de mentira con la forma real de
// /admin/railway/usage: 30 días horarios de CPU y memoria para cuatro servicios.
// ?estado=cargando | error | sin-series para revisar los otros estados.

const HOUR = 3600;
const END = Date.UTC(2026, 8, 27, 5) / 1000; // 26 sept, 23:00 en Tegucigalpa
const START = END - 30 * 24 * HOUR;

let seed = 7;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// Carga base + jornada de oficina (lunes a viernes, 8 a 17 h locales) + ruido.
const series = (base, workday, noise, gap) => {
  const points = [];
  for (let ts = START; ts <= END; ts += HOUR) {
    if (gap && ts > END - gap[0] * HOUR && ts <= END - gap[1] * HOUR) continue;
    const local = new Date((ts - 6 * HOUR) * 1000);
    const day = local.getUTCDay();
    const hour = local.getUTCHours();
    const office = day >= 1 && day <= 5 && hour >= 8 && hour <= 17;
    const value = base + (office ? workday * (0.6 + random() * 0.4) : 0) + random() * noise;
    points.push([ts, Math.round(value * 10000) / 10000]);
  }
  return points;
};

const services = [
  { serviceId: "763b", service: "aguaschol", cpu: [0.004, 0.011, 0.003], mem: [1.18, 0.42, 0.18] },
  { serviceId: "380f", service: "MySQL", cpu: [0.002, 0.004, 0.001], mem: [0.46, 0.08, 0.04], gap: [60, 54] },
  { serviceId: "b7c1", service: "PostGIS", cpu: [0.001, 0.002, 0.001], mem: [0.31, 0.05, 0.03] },
  { serviceId: "ca33", service: "heroic-ambition", cpu: [0.0004, 0.0008, 0.0003], mem: [0.08, 0.01, 0.01] }
];

const seriesRows = services.flatMap(({ serviceId, service, cpu, mem, gap }) => [
  { measurement: "CPU_USAGE", serviceId, service, points: series(...cpu, gap) },
  { measurement: "MEMORY_USAGE_GB", serviceId, service, points: series(...mem, gap) }
]);

const peaks = Object.fromEntries(["CPU_USAGE", "MEMORY_USAGE_GB"].map((measurement) => [
  measurement,
  seriesRows
    .filter((row) => row.measurement === measurement)
    .flatMap((row) => row.points.map(([ts, value]) => ({
      serviceId: row.serviceId,
      service: row.service,
      value,
      timestamp: new Date(ts * 1000).toISOString()
    })))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
]));

const params = new URLSearchParams(window.location.search);
const state = params.get("estado");

const fixture = {
  period: { start: "2026-09-09T06:00:00.000Z", end: "2026-10-09T06:00:00.000Z", updatedAt: "2026-09-27T05:34:00.000Z" },
  currentUsage: 8.68,
  estimatedUsage: 15.62,
  resourceUsage: { CPU_USAGE: 0.07, MEMORY_USAGE_GB: 8.07, NETWORK_TX_GB: 0.43, DISK_USAGE_GB: 0.1, BACKUP_USAGE_GB: 0.01 },
  estimatedResourceUsage: { CPU_USAGE: 0.13, MEMORY_USAGE_GB: 14.55, NETWORK_TX_GB: 0.74, DISK_USAGE_GB: 0.18, BACKUP_USAGE_GB: 0.02 },
  serviceUsage: [
    { serviceId: "763b", service: "aguaschol", cost: 4.81 },
    { serviceId: "380f", service: "MySQL", cost: 2.21 },
    { serviceId: "b7c1", service: "PostGIS", cost: 1.38 },
    { serviceId: "ca33", service: "heroic-ambition", cost: 0.28 }
  ],
  series: state === "sin-series" ? undefined : seriesRows,
  peaks
};

const apiFetch = async () => {
  if (state === "cargando") return new Promise(() => {});
  if (state === "error") return { ok: false, json: async () => ({ message: "Falta configurar la conexión de Railway en el backend." }) };
  return { ok: true, json: async () => fixture };
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <main className="railway-usage-layout" style={{ padding: "24px 16px", background: "#f3f6f9", minHeight: "100vh" }}>
      <RailwayUsageWorkspace apiFetch={apiFetch} />
    </main>
  </React.StrictMode>
);
