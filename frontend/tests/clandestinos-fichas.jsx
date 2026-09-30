import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import FichasInbox from '../src/modules/clandestinos/components/FichasInbox.jsx';
import {Icon} from '../src/components/Icon';
import '../src/styles.css';
import '../src/modules/clandestinos/styles/clandestinos.css';
// Datos simulados solo para QA local (forma real, nombres inventados); no se escriben en el servidor.
const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
const ficha = (id, clave, abonado, barrio, estado, dias, extra = {}) => ({id, clave_catastral: clave, abonado, barrio_colonia: barrio, estado_operativo: estado, created_at: hace(dias), levantamiento_datos: 'Técnico de prueba', ...extra});
const TODAS = [
  ficha(1, '10-22-23', 'Abonado de prueba 1', 'Barrio El Centro', 'pending', 20),
  ficha(2, '14-08-02-07', '', 'Barrio El Centro', 'pending', 16),
  ficha(3, '22-35-01-04', 'Abonado de prueba 3', 'Barrio Cabañas', 'pending', 3),
  ficha(4, '89-13-15', 'Abonado de prueba 4', 'Residencial Villas del Cortijo', 'regularization', 13, {printed_at: hace(5)}),
  ficha(5, '14-37-12', '', 'Barrio El Centro', 'pending', 1),
  ficha(6, '22-17-16', 'Abonado de prueba 6', 'Barrio Cabañas', 'regularized', 30, {printed_at: hace(20)})
];
const COUNTS = {draft: 0, pending: 52, visit: 0, confirmed: 0, regularization: 1, regularized: 3, discarded: 0};
function QA() {
  const [state, setState] = useState('');
  const [query, setQuery] = useState('');
  const [barrio, setBarrio] = useState('');
  const [selected, setSelected] = useState(new Map());
  // Simula la red: lo que se ve (shown) llega 300 ms después de lo pedido (state).
  const [shown, setShown] = useState('');
  useEffect(() => { const timer = setTimeout(() => setShown(state), 300); return () => clearTimeout(timer); }, [state]);
  const items = TODAS.filter((item) => (!shown || item.estado_operativo === shown) && (!barrio || item.barrio_colonia === barrio) && (!query || item.clave_catastral.includes(query)));
  const noop = () => {};
  const model = {items, counts: COUNTS, total: shown ? COUNTS[shown] : 56, page: 1, total_pages: 1, loading: false, refreshing: shown !== state, error: '', viewKey: shown, requestKey: state,
    service_stats: {total: 56, agua_potable: 41, aguas_residuales: 22, ambos: 19, solo_agua: 22, solo_aguas_residuales: 3, ninguno: 12},
    filters: {query, state, barrio, setQuery, setState, setBarrio, setPage: noop, clear: () => { setQuery(''); setState(''); setBarrio(''); }}};
  const toggle = (item) => setSelected((cur) => { const next = new Map(cur); const key = String(item.id); next.has(key) ? next.delete(key) : next.set(key, item); return next; });
  return <main className="cl-module is-flat">
    <header className="cl-module-header"><div className="cl-module-heading"><span className="cl-module-emblem" aria-hidden="true"><Icon name="records" /></span><div><span className="cl-kicker">Clandestinos</span><h1>Fichas clandestinas</h1><p>56 expedientes en seguimiento (QA con datos simulados)</p></div></div>
      <nav aria-label="Secciones">{[['resumen','Resumen','dashboard'],['fichas','Fichas','records'],['banco','Banco','inbox'],['reportes','Reportes técnicos','activity'],['impresiones','Impresiones','print']].map(([key,label,icon]) => <button type="button" key={key} className={key === 'fichas' ? 'is-active' : ''}><Icon name={icon} />{label}</button>)}</nav>
      <div className="cl-role"><Icon name="users" /><span>admin<small>admin</small></span></div></header>
    <FichasInbox model={model} selectedIds={new Set(selected.keys())} onToggle={toggle} onToggleVisible={noop} onSelectAll={noop} onClearSelection={() => setSelected(new Map())} onCompare={noop} onPrintSummary={noop} comparison={null} bulkLoading={false} onOpen={noop} onNew={noop} canCreate />
  </main>;
}
createRoot(document.getElementById('root')).render(<QA />);
