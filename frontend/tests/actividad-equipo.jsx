import React from 'react';
import {createRoot} from 'react-dom/client';
import TeamActivityWorkspace from '../src/modules/actividad/TeamActivityWorkspace.jsx';
import '../src/styles.css';
// Datos simulados solo para QA local (forma real, nombres inventados); no se escriben en el servidor.
const params = new URLSearchParams(location.search);
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
const ev = (id, actor_id, actor_name, action, categoria, summary, min, final = false, enlace = null) => ({id, actor_id, actor_name, action, categoria, summary, created_at: hace(min), final, enlace});
const ITEMS = params.has('empty') ? [] : [
  ev(40, 5, 'Sindy', 'banco_clandestinos.sent_to_ficha', 'fichas', 'Banco → ficha 14-08-02-07 (clandestino)', 3, true, {view: 'records', fichaId: 1823}),
  ev(39, 9, 'diego', 'inspeccion.gps_registered', 'inspecciones', 'GPS registrado en la inspección INS-0142', 11),
  ev(38, 5, 'Sindy', 'banco_clandestinos.discarded', 'fichas', 'Candidato 14-08-02-10 descartado', 25, true, {view: 'banco'}),
  ev(37, 7, 'Melisa maradiaga', 'DOCUMENTO_REENTREGADO', 'entregas', 'Aviso de cobro entregado en Barrio El Centro', 48, true, {view: 'entregas', loteId: 12}),
  ev(36, 9, 'diego', 'inmueble.updated', 'fichas', 'Ficha 10-22-23 actualizada: teléfono y observaciones del inmueble con texto largo de prueba', 70, false, {view: 'records', fichaId: 1801}),
  ev(35, 11, 'oscar ivan alvarez', 'map_point.created', 'campo', 'Punto GPS creado en Colonia Brasilia', 95),
  ev(34, 9, 'diego', 'inspeccion.finalized', 'inspecciones', 'Inspección INS-0139 finalizada', 60 * 20, true, {view: 'inspecciones'}),
  ev(33, 7, 'Melisa maradiaga', 'LOTE_CERRADO', 'entregas', 'Lote #11 cerrado', 60 * 22, true, {view: 'entregas', loteId: 11}),
  ev(32, 11, 'oscar ivan alvarez', 'report.generated', 'otros', 'Reporte de mora generado', 60 * 50)
];
const TECNICOS = params.has('empty') ? [] : [
  {id: 9, nombre: 'diego', total: 14, hoy: 3, finalizados: 4, ultima: hace(11)},
  {id: 5, nombre: 'Sindy', total: 11, hoy: 2, finalizados: 7, ultima: hace(3)},
  {id: 7, nombre: 'Melisa maradiaga', total: 8, hoy: 1, finalizados: 5, ultima: hace(48)},
  {id: 11, nombre: 'oscar ivan alvarez', total: 5, hoy: 1, finalizados: 0, ultima: hace(95)}
];
const apiFetch = async (path) => {
  const url = new URL(path, location.origin);
  if (url.pathname.endsWith('/seen')) return new Response('{}', {status: 200});
  const actor = url.searchParams.get('actor'), categoria = url.searchParams.get('categoria');
  const items = ITEMS.filter((i) => (!actor || String(i.actor_id) === actor) && (!categoria || i.categoria === categoria));
  return new Response(JSON.stringify({items, tecnicos: TECNICOS, has_more: !params.has('empty') && !actor && !categoria, unread: 3, categorias: {fichas: 'Fichas y banco', inspecciones: 'Inspecciones', entregas: 'Entregas', campo: 'GPS y planos', padron: 'Padrón y barrios'}}), {status: 200, headers: {'Content-Type': 'application/json'}});
};
createRoot(document.getElementById('root')).render(<TeamActivityWorkspace apiFetch={apiFetch} session={{user: {id: 1, role: 'admin'}}} onOpen={(item) => { document.title = `abrir ${JSON.stringify(item.enlace)}`; }} />);
