import React from 'react';
import { createRoot } from 'react-dom/client';
import MapaOperaciones from '../src/modules/operaciones/MapaOperaciones.jsx';
import '../src/styles.css';

// Datos ficticios con la forma real de cada módulo; solo para QA local, nunca van al servidor.
// ?ok = sin atrasos · ?falla = inspecciones no responde.
const params = new URLSearchParams(location.search);
const ok = params.has('ok');
const diasAtras = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
const ficha = (id, estado, dias) => ({ id, estado_operativo: estado, estado_padron: 'clandestino', created_at: diasAtras(dias) });
const items = [
  ...Array.from({ length: 10 }, (_, i) => ficha(i + 1, 'pending', ok ? 1 : 3 + i * 2)),
  ...Array.from({ length: 3 }, (_, i) => ficha(20 + i, 'visit', 2)),
  ...Array.from({ length: 5 }, (_, i) => ficha(30 + i, 'confirmed', ok ? 1 : 20)),
  ...Array.from({ length: 4 }, (_, i) => ficha(40 + i, 'regularization', 1)),
  ...Array.from({ length: 9 }, (_, i) => ficha(50 + i, 'regularized', 40))
];
const respuestas = {
  '/clandestinos/fichas': { items, total: items.length, counts: { draft: 2, pending: 10, visit: 3, confirmed: 5, regularization: 4, regularized: 9, discarded: 2 } },
  '/clandestinos/banco': { counts: { clandestino: 300, sin_determinar: 72, registrado: 4 }, sin_asignar: ok ? 0 : 120, items: [] },
  '/inspecciones/resumen': { asignadas: 3, en_proceso: 1, seguimiento: 2, finalizadas_mes: 7, finalizadas_mes_anterior: 5, bandeja: [{ estado: 'ASIGNADA', antiguedad_dias: ok ? 2 : 18 }, { estado: 'ASIGNADA', antiguedad_dias: 3 }, { estado: 'ASIGNADA', antiguedad_dias: 1 }, { estado: 'EN_PROCESO', antiguedad_dias: 4 }, { estado: 'SEGUIMIENTO', antiguedad_dias: ok ? 3 : 9 }, { estado: 'SEGUIMIENTO', antiguedad_dias: 1 }] },
  '/entregas/resumen': { asignadas: 1840, entregadas: 1702, pendientes: 98, reentregadas: 40, no_localizadas: 7, pendientes_mas_7_dias: ok ? 0 : 31, lotes_abiertos: 4, efectividad: 92.5 }
};
const apiFetch = async (path) => {
  const url = new URL(path, location.origin);
  await new Promise((r) => setTimeout(r, 200));
  if (params.has('falla') && url.pathname === '/inspecciones/resumen') return new Response(JSON.stringify({ message: 'Error' }), { status: 500 });
  const body = respuestas[url.pathname];
  return new Response(JSON.stringify(body || {}), { status: body ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
};
const onGo = (view) => { document.title = `ir: ${view} ${location.hash}`; };
createRoot(document.getElementById('root')).render(<div style={{ padding: 16, background: '#eef2f6', minHeight: '100vh' }}><MapaOperaciones apiFetch={apiFetch} onGo={onGo} onDownloadMemoria={() => { document.title = 'memoria'; }} /></div>);
