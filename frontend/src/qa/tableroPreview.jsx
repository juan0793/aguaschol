import React from "react";
import ReactDOM from "react-dom/client";
import DashboardWorkspace from "../modules/dashboard/DashboardWorkspace";
import "../styles.css";

// Banco de pruebas del tablero: tarjetas compactas, pulsación de las acciones
// rápidas y paneles que se pliegan. Datos de mentira con la forma real.

// La forma la fija debtRankingAll: barrio_colonia, deuda, servicios, total_registros.
const barrio = (nombre, total, deudores, criticos, registros) => ({
  barrio_colonia: nombre,
  total_registros: registros,
  deuda: { capital: total * 0.5, intereses: total * 0.5, total, deudores, criticos },
  servicios: [
    { field: "agua", label: "Agua", active: registros, inactive: 0, unknown: 0, deuda: { total: total * 0.6 } },
    { field: "recoleccion", label: "Recolección de desechos", active: registros, inactive: 0, unknown: 0, deuda: { total: total * 0.4 } }
  ]
});

const model = {
  navigate: () => {},
  refresh: () => {},
  refreshing: false,
  connectionStatus: "live",
  syncLabel: "Sincronizado hace 2 segundos",
  padronTotals: { records: 25158, barrios: 127 },
  onlineUsers: [
    { id: 1, full_name: "Ana Díaz", roleLabel: "Administradora" },
    { id: 2, full_name: "Diego Andino", roleLabel: "Técnico" },
    { id: 3, full_name: "Elena López", roleLabel: "Validadora" },
    { id: 4, full_name: "Luis Herrera", roleLabel: "Técnico" }
  ],
  metrics: [
    { key: "records", label: "Fichas activas", value: 55, helper: "0 movimientos hoy", icon: "records", tone: "" },
    { key: "gps", label: "Puntos GPS", value: 5394, helper: "0 puntos registrados hoy", icon: "map", tone: "is-map" },
    { key: "users", label: "Usuarios en línea", value: 7, helper: "10 usuarios registrados", icon: "users", tone: "is-live" },
    { key: "alerts", label: "Alertas", value: 10, helper: "Pendientes con plazo crítico", icon: "warning", tone: "is-critical" }
  ],
  attention: [
    { key: "a", level: "critical", title: "Fichas con plazo crítico", detail: "10 fichas están en alerta o vencidas por regla de 7 días hábiles.", icon: "warning", action: () => {} },
    { key: "b", level: "pending", title: "Fichas sin foto", detail: "36 fichas visibles aún no tienen evidencia fotográfica asociada.", icon: "records", action: () => {} }
  ],
  debtSummary: { capital: 115357814.1, intereses: 116561243.32, total: 231919057.42, deudores: 19106, criticos: 12925 },
  debtBarrios: [
    barrio("COL. JULIO MIDENCE", 12302140.29, 812, 610, 900),
    barrio("BO. CABAÑAS", 12016609.79, 790, 560, 850),
    barrio("BO. LA LIBERTAD", 11094120.99, 701, 512, 810),
    barrio("RESIDENCIAL MONTELIMAR 1 Y 2", 10683188.14, 655, 480, 700),
    barrio("BO. EL CENTRO", 10105923.67, 640, 455, 690)
  ],
  // Responde como el endpoint /claves/services/accounts.
  fetchServiceAccounts: async (field) =>
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            ok: true,
            field,
            total_cuentas: 42,
            cuentas: [
              { clave_catastral: "14-02-06-03", abonado: "10233", nombre: "INDUSTRIAS DEL SUR S. DE R.L.", barrio_colonia: "BO. EL CENTRO", deuda: 184320.55 },
              { clave_catastral: "43-19-06", abonado: "20981", nombre: "HOSPITAL DEL VALLE", barrio_colonia: "COL. VENECIA", deuda: 96210.1 },
              { clave_catastral: "21-08-11", abonado: "30114", nombre: "TALLER MECÁNICO LA ESPERANZA", barrio_colonia: "BO. CABAÑAS", deuda: 45980.33 }
            ]
          }),
        250
      )
    ),
  feed: [
    { key: 1, title: "Ficha 0301-0012-0045 actualizada", detail: "admin · hace 4 minutos", icon: "records" },
    { key: 2, title: "Punto GPS registrado en COL. VENECIA", detail: "Melisa maradiaga · hace 12 minutos", icon: "map" }
  ]
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DashboardWorkspace model={model} />
  </React.StrictMode>
);
