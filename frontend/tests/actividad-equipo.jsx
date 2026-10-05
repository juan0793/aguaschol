import React from 'react';
import {createRoot} from 'react-dom/client';
import TeamActivityWorkspace from '../src/modules/actividad/TeamActivityWorkspace.jsx';
import '../src/styles.css';
// Datos simulados solo para QA local (forma real, nombres inventados); no se escriben en el servidor.
const params = new URLSearchParams(location.search);
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
const ev = (id, actor_id, actor_name, action, categoria, summary, min, final = false, enlace = null, entity_type = '', entity_id = '') => ({id, actor_id, actor_name, action, categoria, summary, created_at: hace(min), final, enlace, entity_type, entity_id});
const ficha = (id) => ({view: 'records', fichaId: id});
const ITEMS = params.has('empty') ? [] : [
  ev(52, 9, 'diego', 'banco_clandestinos.sent_to_ficha', 'fichas', 'Banco → ficha 14-04-08-41 (clandestino)', 2, true, ficha(1830), 'inmueble', '1830'),
  ev(51, 9, 'diego', 'inmueble.created', 'fichas', 'Ficha 14-04-08-41 creada', 2, false, ficha(1830), 'inmueble', '1830'),
  ev(50, 12, 'elmer', 'inmueble.internal_notes_updated', 'fichas', 'Observaciones internas actualizadas en 42-46-02', 11, false, ficha(1829), 'inmueble', '1829'),
  ev(49, 12, 'elmer', 'inmueble.updated', 'fichas', 'Ficha 42-46-02 actualizada', 11, false, ficha(1829), 'inmueble', '1829'),
  ev(48, 12, 'elmer', 'banco_clandestinos.sent_to_ficha', 'fichas', 'Banco → ficha 42-46-02 (clandestino)', 12, true, ficha(1829), 'inmueble', '1829'),
  ev(47, 12, 'elmer', 'inmueble.created', 'fichas', 'Ficha 42-46-02 creada', 12, false, ficha(1829), 'inmueble', '1829'),
  ev(46, 12, 'elmer', 'banco_clandestinos.verified', 'fichas', 'Banco verificado contra padrones: 372 candidatos, 0 cambiaron, 0 descartados por aparecer en Aguas', 14, false, {view: 'banco'}, 'banco_clandestinos', '0'),
  ev(45, 11, 'oscar ivan alvarez', 'inmueble.internal_notes_updated', 'fichas', 'Observaciones internas actualizadas en 42-60-03', 17, false, ficha(1828), 'inmueble', '1828'),
  ev(44, 11, 'oscar ivan alvarez', 'inmueble.updated', 'fichas', 'Ficha 42-60-03 actualizada', 17, false, ficha(1828), 'inmueble', '1828'),
  ev(43, 11, 'oscar ivan alvarez', 'banco_clandestinos.sent_to_ficha', 'fichas', 'Banco → ficha 42-60-03 (clandestino)', 18, true, ficha(1828), 'inmueble', '1828'),
  ev(42, 11, 'oscar ivan alvarez', 'inmueble.created', 'fichas', 'Ficha 42-60-03 creada', 18, false, ficha(1828), 'inmueble', '1828'),
  ev(41, 9, 'diego', 'inspeccion.gps_registered', 'inspecciones', 'GPS registrado en la inspección INS-0142', 40, false, {view: 'inspecciones'}, 'inspeccion', '142'),
  ev(40, 7, 'Melisa maradiaga', 'DOCUMENTO_REENTREGADO', 'entregas', 'Aviso de cobro entregado en Barrio El Centro', 48, true, {view: 'entregas', loteId: 12}, 'entrega', '311'),
  ev(34, 9, 'diego', 'inspeccion.finalized', 'inspecciones', 'Inspección INS-0139 finalizada', 60 * 20, true, {view: 'inspecciones'}, 'inspeccion', '139'),
  ev(33, 7, 'Melisa maradiaga', 'LOTE_CERRADO', 'entregas', 'Lote #11 cerrado', 60 * 22, true, {view: 'entregas', loteId: 11}, 'entrega', '11'),
  ev(32, 11, 'oscar ivan alvarez', 'report.generated', 'otros', 'Reporte de mora generado', 60 * 50)
];
const TECNICOS = params.has('empty') ? [] : [
  {id: 9, nombre: 'diego', total: 14, hoy: 3, finalizados: 4, ultima: hace(11)},
  {id: 5, nombre: 'Sindy', total: 11, hoy: 2, finalizados: 7, ultima: hace(3)},
  {id: 7, nombre: 'Melisa maradiaga', total: 8, hoy: 1, finalizados: 5, ultima: hace(48)},
  {id: 11, nombre: 'oscar ivan alvarez', total: 5, hoy: 1, finalizados: 0, ultima: hace(95)}
];
// Varios días de descartes del banco, para probar la paginación y el índice por día.
if (!params.has('empty')) {
  const personas = [[12, 'elmer'], [5, 'Sindy'], [9, 'diego']];
  let id = 31;
  for (let dia = 1; dia <= 12; dia += 1) {
    if (new Date(Date.now() - dia * 86400000).getDay() === 0) continue;
    const cuantas = 6 + ((dia * 7) % 23);
    for (let n = 0; n < cuantas; n += 1) {
      const [actorId, nombre] = personas[(dia + n) % personas.length];
      const clave = `${40 + dia}-0${(n % 9) + 1}-${String(10 + n).padStart(2, '0')}`;
      ITEMS.push(ev(id, actorId, nombre, 'banco_clandestinos.discarded', 'fichas', `Candidato ${clave} descartado`, dia * 1440 - 60 + n * 9, true, {view: 'banco'}, 'banco_clandestinos', String(5000 + id)));
      id -= 1;
    }
  }
}
const isoLocal = (value) => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const apiFetch = async (path) => {
  const url = new URL(path, location.origin);
  if (url.pathname.endsWith('/seen')) return new Response('{}', {status: 200});
  const actor = url.searchParams.get('actor'), categoria = url.searchParams.get('categoria');
  const limit = Number(url.searchParams.get('limit')) || 50, pagina = Number(url.searchParams.get('pagina')) || 1;
  const todos = ITEMS.filter((i) => (!actor || String(i.actor_id) === actor) && (!categoria || i.categoria === categoria));
  const items = todos.slice((pagina - 1) * limit, pagina * limit);
  const porDia = new Map();
  for (const i of todos) porDia.set(isoLocal(i.created_at), (porDia.get(isoLocal(i.created_at)) || 0) + 1);
  const dias = [...porDia].map(([dia, acciones]) => ({dia, acciones}));
  await new Promise((r) => setTimeout(r, 150));
  return new Response(JSON.stringify({items, tecnicos: TECNICOS, total: todos.length, dias, pagina, por_pagina: limit, has_more: pagina * limit < todos.length, unread: 3, categorias: {fichas: 'Fichas y banco', inspecciones: 'Inspecciones', entregas: 'Entregas', campo: 'GPS y planos', padron: 'Padrón y barrios'}}), {status: 200, headers: {'Content-Type': 'application/json'}});
};
createRoot(document.getElementById('root')).render(<TeamActivityWorkspace apiFetch={apiFetch} session={{user: {id: 1, role: 'admin'}}} onOpen={(item) => { document.title = `abrir ${JSON.stringify(item.enlace)}`; }} />);
