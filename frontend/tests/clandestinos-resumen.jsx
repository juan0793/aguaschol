import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Resumen from '../src/modules/clandestinos/components/ResumenClandestinos.jsx';
import '../src/styles.css';
import '../src/modules/clandestinos/styles/clandestinos.css';
// Datos simulados solo para QA local; no se escriben en el servidor.
const empty = new URLSearchParams(location.search).has('empty');
const api = {
  fichas: async () => ({counts: empty ? {} : {pending:52,regularization:1,regularized:3},items:empty?[]:Array.from({length:11},()=>({created_at:"2026-01-01"}))}),
  banco: async () => ({counts: empty ? {} : {clandestino:363,sin_determinar:15},sin_asignar:empty?0:330,asignaciones:empty?[]:[{id:1,nombre:'Técnico de prueba con nombre extenso',pendientes:7},{id:2,nombre:'Técnico de prueba B',pendientes:6}]}),
  reports: async () => []
};
function QA(){const [selection,setSelection]=useState(''); const open=(type,filter)=>setSelection(JSON.stringify({type,filter})); return <main className="cl-module is-summary"><header className="cl-module-header"><div><span className="cl-kicker">Clandestinos · QA local</span><h1>Resumen de clandestinos</h1><p>Fichas, banco de campo, técnicos y reportes</p></div></header><Resumen api={api} onOpenFichas={(key)=>open('fichas',key)} onOpenBanco={(filter)=>open('banco',filter)} onOpenReportes={(key)=>open('reportes',key)}/><output aria-label="Filtro seleccionado">{selection}</output><button type="button" onClick={async()=>{try{const buttons=[...document.querySelectorAll('.cl-resumen-kpi')]; if(buttons.length!==5)throw Error('Faltan indicadores'); buttons[1].click(); await new Promise(r=>setTimeout(r,50)); if(!document.querySelector('output').textContent.includes('confirmed'))throw Error('Filtro de aviso incorrecto'); const row=[...document.querySelectorAll('.cl-bars button')].find(b=>b.textContent.includes('Por visitar')); row.click(); await new Promise(r=>setTimeout(r,50)); if(!document.querySelector('output').textContent.includes('pending'))throw Error('Filtro de etapa incorrecto'); if(document.documentElement.scrollWidth>innerWidth)throw Error('Desbordamiento horizontal'); setSelection('QA OK: indicadores, filtros y ancho');}catch(e){setSelection(e.message);throw e;}}}>Ejecutar comprobación UI</button></main>}
createRoot(document.getElementById('root')).render(<QA/>);

