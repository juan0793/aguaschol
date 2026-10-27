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
const ETIQUETAS = { agua: 'Agua potable', alcantarillado: 'Alcantarillado', barrido: 'Barrido', recoleccion: 'Recoleccion de desechos', desechos_peligrosos: 'Desechos peligrosos' };
const serviceRows = CAMPOS.map((field) => {
  const suma = (key) => barrios.reduce((total, b) => { const s = b.servicios.find((x) => x.field === field); return total + (key.startsWith('deuda.') ? s.deuda[key.slice(6)] : s[key]); }, 0);
  const active = suma('active');
  return { field, label: ETIQUETAS[field], active, inactive: suma('inactive'), unknown: field === 'agua' ? 2 : 0, percentage: Number(((active / totalRecords) * 100).toFixed(1)), deuda: { capital: suma('deuda.capital'), intereses: suma('deuda.intereses'), total: suma('deuda.total'), deudores: suma('deuda.deudores') } };
}).sort((a, b) => b.active - a.active);
// Cuentas ficticias de un barrio para el listado de abonados.
const NOMBRES_ABONADOS = ['MARIA JOSE CASTILLO', 'JUAN CARLOS MEJIA', 'ROSA AMELIA ZELAYA', 'PEDRO ANTONIO LOPEZ', 'GLORIA ESPERANZA VINDEL', 'CARLOS ROBERTO SIERRA', 'ANA LUCIA MARTINEZ', 'JOSE LUIS ORDOÑEZ'];
// Como en el padrón real, el saldo (total) es capital (tarifa) más intereses. La versión
// del padrón va en el nombre de los abonados para saber de qué consulta salió cada lista.
const cuentasDe = (barrio, i, version) => Array.from({ length: window.__abonadosPorBarrio || 18 + i * 3 }, (_, n) => {
  const tarifa = n % 4 === 0 ? 0 : 180 + n * 7;
  const intereses = n % 4 === 0 || n % 3 === 0 ? 0 : 60 + n * 12.25;
  return {
    clave_catastral: `${10 + i}-${String(1 + (n % 9)).padStart(2, '0')}-${String(n + 1).padStart(2, '0')}-01`, abonado: String(4000 + i * 200 + n), nombre: `${NOMBRES_ABONADOS[(n + i) % NOMBRES_ABONADOS.length]}${version > 1 ? ` v${version}` : ''}`,
    servicios: { agua: n % 3 !== 0, alcantarillado: n % 2 === 0, barrido: n % 5 === 0, recoleccion: n % 4 !== 1, desechos_peligrosos: n === 7 }, tarifa, intereses, total: tarifa + intereses
  };
});
// window.__abonadosPorBarrio = 1500 simula un barrio grande.
// Pruebas de carrera: window.__demoras = { [barrio]: ms } retrasa la respuesta de ese barrio
// y window.__registro guarda cada consulta (barrio y versión del padrón al pedirla).
const apiFetch = async (url) => {
  window.__pedidos = (window.__pedidos || 0) + 1;
  const nombres = new URL(url, 'http://x').searchParams.get('barrios').split('|');
  const version = window.__versionPadron || 1;
  (window.__registro = window.__registro || []).push({ barrios: nombres, version });
  const demora = Math.max(0, ...nombres.map((nombre) => window.__demoras?.[nombre] || 0));
  if (demora) await new Promise((resolve) => setTimeout(resolve, demora));
  return { ok: true, json: async () => ({ ok: true, barrios: nombres.map((nombre) => ({ barrio_colonia: nombre, rows: cuentasDe(nombre, NOMBRES.indexOf(nombre), version) })) }) };
};

function App() {
  const [selectedBarrios, setSelected] = useState([]);
  // Fija entre redibujos, como la del servidor. window.__actualizarPadron() simula que se
  // cargó un padrón nuevo: cambia la fecha y la versión que devuelven las consultas.
  const [padronActualizado, setPadronActualizado] = useState(() => new Date(Date.now() - 60000).toISOString());
  window.__actualizarPadron = () => { window.__versionPadron = (window.__versionPadron || 1) + 1; setPadronActualizado(new Date().toISOString()); };
  const [field, setField] = useState('agua');
  const log = (name) => (payload) => { window.__ultimoInforme = { name, payload }; document.title = `${name}: ${payload?.label || ''} ${payload?.rows?.length || 0} filas`; };
  // Los informes de un servicio usan los generadores reales; el aviso queda en window para revisarlo.
  const printers = createPadronReportPrinters({ padronServiceReport: { generated_at: new Date().toISOString(), source: { file_name: 'Lote de prueba' } }, setDownloadingAguasServicePdf: () => {}, showAlert: (message) => { window.__aviso = message; } });
  const model = {
    serviceReport: { summary: { total_barrios: barrios.length }, source: { file_name: 'Lote de prueba', updated_at: padronActualizado } },
    serviceData: { barrios, serviceRows, hasData: true, totalRecords, deuda: { capital: barrios.reduce((s, b) => s + b.deuda.capital, 0), intereses: barrios.reduce((s, b) => s + b.deuda.intereses, 0), total: barrios.reduce((s, b) => s + b.deuda.total, 0), deudores: 15000 }, profiles: { all_core_services: 2210, water_without_sewer: 3436, sewer_without_water: 4143, no_core_services: 512 } },
    apiFetch, notify: (message) => { window.__aviso = message; }, formatClave: (row) => row.clave_catastral,
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
