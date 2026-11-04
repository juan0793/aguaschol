import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import PadronRequestsWorkspace from "../modules/requests/PadronRequestsWorkspace";

// Banco de pruebas de Consultas del padrón. Datos de mentira con la forma real de
// GET /claves/services/report (incluidas las combinaciones por barrio): ningún barrio,
// nombre ni clave es del padrón. Abre `qa-padron.html`; ?sinCombinaciones=1 simula un
// backend anterior.
const parametros = new URLSearchParams(location.search);
const CAMPOS = ["agua", "alcantarillado", "barrido", "recoleccion", "desechos_peligrosos"];
const ETIQUETAS = ["Agua potable", "Alcantarillado", "Barrido", "Recoleccion de desechos", "Desechos peligrosos"];
let semilla = 11;
const azar = (n) => { semilla = (semilla * 16807) % 2147483647; return semilla % n; };
const nombres = ["Bo. Ficticio Norte", "Bo. de Prueba", "Col. Ejemplo", "Res. Imaginaria", "Bo. Ensayo Sur", "Col. Muestra", "Bo. Simulado", "Col. Demostración con Nombre Largo", "Bo. Prototipo", "Col. Borrador", "Bo. Maqueta", "Col. Patrón", "Bo. Modelo", "Col. Boceto", "Lot. Ensayo", "Res. Esquema", "Bo. Plantilla", "Col. Croquis"];
const barrios = nombres.map((barrio_colonia, b) => {
  const total = 3 + azar(b < 4 ? 600 : 160);
  const grupos = new Map();
  const deuda = { capital: 0, intereses: 0, total: 0, deudores: 0, criticos: 0 };
  const servicios = Object.fromEntries(CAMPOS.map((field, i) => [field, { field, label: ETIQUETAS[i], active: 0, inactive: 0, unknown: 0, percentage: 0, deuda: { capital: 0, intereses: 0, total: 0, deudores: 0, criticos: 0 } }]));
  for (let u = 0; u < total; u += 1) {
    const agua = b % 5 === 4 ? azar(10) < 2 : azar(10) < 9;
    const flags = [agua, azar(10) < (b % 3 === 0 ? 2 : 6), azar(10) < 5, azar(10) < 7, azar(100) < 2];
    const clave = flags.map((f) => (f ? "1" : "0")).join("");
    const debe = azar(10) < 4 ? 100 + azar(4000) : 0;
    const capital = Math.round(debe * 0.85 * 100) / 100;
    const intereses = Math.round((debe - capital) * 100) / 100;
    const g = grupos.get(clave) || { clave, usuarios: 0, deudores: 0, criticos: 0, capital: 0, intereses: 0, total: 0 };
    g.usuarios += 1; g.capital += capital; g.intereses += intereses; g.total += debe; if (debe) g.deudores += 1; if (debe >= 1000) g.criticos += 1;
    grupos.set(clave, g);
    deuda.capital += capital; deuda.intereses += intereses; deuda.total += debe; if (debe) deuda.deudores += 1; if (debe >= 1000) deuda.criticos += 1;
    flags.forEach((f, i) => { const s = servicios[CAMPOS[i]]; if (f) { s.active += 1; s.deuda.total += debe; s.deuda.capital += capital; s.deuda.intereses += intereses; if (debe) s.deuda.deudores += 1; } else s.inactive += 1; });
  }
  return {
    barrio_colonia, total_registros: total, deuda,
    servicios: Object.values(servicios).map((s) => ({ ...s, percentage: Number(((s.active / total) * 100).toFixed(1)) })),
    ...(parametros.get("sinCombinaciones") ? {} : { combinaciones: [...grupos.values()] })
  };
});
const totalRecords = barrios.reduce((t, b) => t + b.total_registros, 0);
const services = CAMPOS.map((field, i) => {
  const active = barrios.reduce((t, b) => t + b.servicios[i].active, 0);
  return { field, label: ETIQUETAS[i], active, percentage: Number(((active / totalRecords) * 100).toFixed(1)), deuda: { total: barrios.reduce((t, b) => t + b.servicios[i].deuda.total, 0), deudores: barrios.reduce((t, b) => t + b.servicios[i].deuda.deudores, 0) } };
});
const deudaTotal = { total: barrios.reduce((t, b) => t + b.deuda.total, 0), deudores: barrios.reduce((t, b) => t + b.deuda.deudores, 0) };
const serviceReport = { source: { file_name: "LOTE-PRUEBA.DBF", updated_at: "2026-11-04T16:30:00Z" }, summary: { total_records: totalRecords, total_barrios: barrios.length, deuda: deudaTotal, profiles: { water_without_sewer: 0, sewer_without_water: 0 }, services }, barrios };
const apiFetch = async (url) => {
  const barrio = new URL(url, location.origin).searchParams.get("barrios");
  const fila = barrios.find((b) => b.barrio_colonia === barrio);
  let n = 0;
  const rows = (fila?.combinaciones || []).flatMap((g) => Array.from({ length: g.usuarios }, () => {
    n += 1;
    return { clave_catastral: `99-01-${String(n).padStart(2, "0")}`, abonado: String(70000 + n), nombre: `ABONADO DE PRUEBA ${n}`, barrio_colonia: barrio, valor: 0, intereses: 0, total: n % 3 ? 0 : 250, servicios: Object.fromEntries(CAMPOS.map((c, i) => [c, g.clave[i] === "1"])) };
  }));
  return { ok: true, json: async () => ({ barrios: [{ barrio, rows }] }) };
};

function Preview() {
  const [selected, setSelected] = useState([]);
  const model = {
    serviceReport,
    serviceData: { services, barrios, totalRecords, deuda: deudaTotal, profiles: { water_without_sewer: 0, sewer_without_water: 0 }, hasData: true },
    loadingServices: false, loadError: "", onRefresh: () => {},
    selectedBarrios: selected,
    onToggleBarrio: (name) => setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name])),
    onSetSelectedBarrios: setSelected,
    notify: (m) => console.log("notify:", m),
    apiFetch
  };
  return <PadronRequestsWorkspace model={model} />;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Preview />);
