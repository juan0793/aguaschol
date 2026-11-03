import React from 'react';
import {createRoot} from 'react-dom/client';
import BancoClandestinos from '../src/modules/clandestinos/components/BancoClandestinos.jsx';
import '../src/styles.css';
import '../src/modules/clandestinos/styles/clandestinos.css';
// Datos ficticios: la vista de un técnico (operador) con lo suyo ordenado por barrio y clave.
const yo = {id: 5, role: 'operator', full_name: 'Sindy Sauceda'};
const barrios = ['Barrio Cabañas', 'Barrio El Centro', 'Col. Las Colinas'];
const items = barrios.flatMap((barrio, b) => Array.from({length: 5}, (_, n) => ({
  id: 100 + b * 10 + n, clave_catastral: `3${b}-0${1 + Math.floor(n / 2)}-${String(10 + n * 3).padStart(2, '0')}`, barrio_colonia: barrio, estado: 'pendiente',
  dictamen: n % 3 ? 'clandestino' : 'sin_determinar', motivo_dictamen: n % 3 ? 'No aparece en Aguas' : 'Posible desmembración', asignado_a: yo.id, asignado_nombre: yo.full_name,
  alcaldia_propietario: ['ANA MARÍA LÓPEZ', 'JOSÉ PÉREZ', 'MARTA RIVERA', 'LUIS CRUZ', 'ROSA AGUILAR'][n], comentario_campo: n % 2 ? 'Casa con conexión visible' : '', origen: 'qfield', latitude: 13.3, longitude: -87.19
})));
const model = {
  items, total: items.length, page: 1, total_pages: 1, counts: {clandestino: 10, sin_determinar: 5, registrado: 0}, estados: {pendiente: 15, enviado: 4, descartado: 2},
  barrios, barrio_counts: barrios.map((barrio) => ({barrio, total: 5, clandestino: 3, sin_determinar: 2})), asignaciones: [{id: yo.id, nombre: yo.full_name, pendientes: 15, enviados: 4, descartados: 2, total: 21, trabajados: 6, avance: 28}], sin_asignar: 0,
  loading: false, refreshing: false, error: '', reload: async () => {},
  filters: {query: '', dictamen: '', estado: 'pendiente', barrio: '', asignado: 'mine', page: 1, setQuery() {}, setDictamen() {}, setEstado() {}, setBarrio() {}, setAsignado() {}, setPage() {}, clear() {}}
};
const permissions = {can_process_banco: false, can_import_banco: false, can_assign_banco: false, can_work_assigned_banco: true};
createRoot(document.getElementById('root')).render(<div className="cl-module" style={{padding: 16}}><BancoClandestinos api={{}} model={model} permissions={permissions} session={{user: yo}} notify={() => {}} onOpenFicha={() => {}} /></div>);
