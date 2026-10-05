import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PadronRequestsWorkspace from '../src/modules/requests/PadronRequestsWorkspace.jsx';
import { createPadronReportPrinters } from '../src/modules/requests/createPadronReportPrinters.js';
import '../src/styles.css';

// Datos ficticios con la forma real del informe de servicios; solo para QA local, nunca van al servidor.
const NOMBRES = ['BO. CABAÑAS', 'RESIDENCIAL MONTELIMAR 1 Y 2', 'BO. LA LIBERTAD', 'BO. EL CENTRO', 'COL. SAN JOSE', 'BO. LOS MANGOS', 'COL. 21 DE FEBRERO', 'RES. LAS PALMERAS', 'BO. EL TAMARINDO', 'COL. VILLA SOL', 'BO. SAN MARTIN', 'COL. LOS ROBLES', 'ALDEA LA CEIBA', 'COL. NUEVA ESPERANZA'];
const CAMPOS = ['agua', 'alcantarillado', 'barrido', 'recoleccion', 'desechos_peligrosos'];
const barrios = NOMBRES.map((nombre, i) => {
  const total = 1460 - i * 97;
  const deudaTotal = 12016609 - i * 690000;
  const servicios = CAMPOS.map((field, j) => {
    const sinBarrido = field === 'barrido' && [1, 5, 9, 12].includes(i);
    const active = field === 'desechos_peligrosos' ? i % 4 : sinBarrido ? 0 : Math.round(total * (0.18 + ((i * 7 + j * 13) % 70) / 100));
    const share = active / total;
    return { field, label: field, active, inactive: total - active, unknown: 0, percentage: Number(((active / total) * 100).toFixed(1)), deuda: { capital: deudaTotal * share * 0.82, intereses: deudaTotal * share * 0.18, total: deudaTotal * share, deudores: Math.round(active * 0.7), criticos: 0 } };
  });
  return { barrio_colonia: nombre, total_registros: total, deuda: { capital: deudaTotal * 0.82, intereses: deudaTotal * 0.18, total: deudaTotal, deudores: Math.round(total * 0.75) }, servicios };
});
const totalRecords = barrios.reduce((sum, b) => sum + b.total_registros, 0);

function App() {
  const [selectedBarrios, setSelected] = useState([]);
  const [field, setField] = useState('agua');
  const log = (name) => (payload) => { window.__ultimoInforme = { name, payload }; document.title = `${name}: ${payload?.label || ''} ${payload?.rows?.length || 0} filas`; };
  // Los informes de un servicio usan los generadores reales; el aviso queda en window para revisarlo.
  const printers = createPadronReportPrinters({ padronServiceReport: { generated_at: new Date().toISOString(), source: { file_name: 'Lote de prueba' } }, setDownloadingAguasServicePdf: () => {}, showAlert: (message) => { window.__aviso = message; } });
  const model = {
    serviceReport: { summary: { total_barrios: barrios.length }, source: { file_name: 'Lote de prueba', updated_at: new Date().toISOString() } },
    serviceData: { barrios, hasData: true, totalRecords, deuda: { total: barrios.reduce((s, b) => s + b.deuda.total, 0), deudores: 15000 }, profiles: { water_without_sewer: 3436, sewer_without_water: 4143 } },
    loadingServices: false, loadError: '', onRefresh: () => {},
    selectedServiceField: field, onSelectService: setField,
    selectedBarrios, onSetSelectedBarrios: setSelected,
    onToggleBarrio: (name) => setSelected((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name])),
    onPrintServices: log('imprimir-todos'), onDownloadServicesPdf: log('pdf-todos'),
    onPrintServiceFocus: (p) => { log('imprimir-servicio')(p); return printers.handlePrintServiceFocus(p); }, onDownloadServiceFocusPdf: (p) => { log('pdf-servicio')(p); return printers.handleDownloadServiceFocusPdf(p); }, downloadingServicesPdf: false
  };
  return <PadronRequestsWorkspace model={model} />;
}
createRoot(document.getElementById('root')).render(<App />);
