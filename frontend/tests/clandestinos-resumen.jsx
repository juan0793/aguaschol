import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Resumen from '../src/modules/clandestinos/components/ResumenClandestinos.jsx';
import '../src/styles.css';
import '../src/modules/clandestinos/styles/clandestinos.css';
// Datos simulados solo para QA local (forma real, nombres inventados); no se escriben en el servidor.
const params = new URLSearchParams(location.search);
const empty = params.has('empty');
// ?error simula que el backend no responde, para ver el estado de error con Reintentar.
const falla = async () => { if (params.has('error')) throw Error('El servidor no respondió'); };
const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
const ficha = (id, clave, nombre, barrio, estado, dias) => ({id, clave_catastral: clave, inquilino: nombre, barrio_colonia: barrio, estado_operativo: estado, created_at: hace(dias)});
const fichas = [
  ficha(1, '10-22-23', 'Nombre de prueba uno', 'Barrio El Centro', 'pending', 20),
  ficha(2, '14-08-02-07', 'Nombre de prueba dos', 'Barrio El Centro', 'pending', 16),
  ficha(3, '22-35-01-04', 'Nombre de prueba tres con apellido largo', 'Barrio Cabañas', 'pending', 14),
  ficha(4, '89-13-15', 'Nombre de prueba cuatro', 'Residencial Villas del Cortijo', 'regularization', 13),
  ficha(5, '14-37-12', 'Nombre de prueba cinco', 'Barrio El Centro', 'pending', 12),
  ficha(6, '14-09-30', '', 'Barrio El Centro', 'pending', 11),
  ficha(7, '22-17-16', 'Nombre de prueba siete', 'Barrio Cabañas', 'pending', 11),
  ficha(8, '124-01-01', 'Nombre de prueba ocho', 'Ciudad Valcanes', 'pending', 10),
  ficha(9, '14-08-01-07', 'Nombre de prueba nueve', 'Barrio El Centro', 'pending', 9),
  ficha(10, '22-36-39', 'Nombre de prueba diez', 'Barrio Cabañas', 'pending', 7),
  ficha(11, '89-13-16', 'Nombre de prueba once', 'Colonia Brasilia', 'pending', 2),
  ficha(12, '89-13-17', 'Nombre de prueba doce', 'Colonia Brasilia', 'pending', 1)
];
const tecnico = (id, nombre, pendientes, enviados, descartados) => {
  const total = pendientes + enviados + descartados, trabajados = enviados + descartados;
  return {id, nombre, pendientes, enviados, descartados, total, trabajados, avance: total ? Math.floor(trabajados / total * 100) : 0};
};
const api = {
  fichas: async () => (await falla(), {total: empty ? 0 : fichas.length, counts: empty ? {} : {pending:52,regularization:1,regularized:3,discarded:2}, items: empty ? [] : fichas}),
  banco: async () => ({counts: empty ? {} : {clandestino:363,sin_determinar:15}, estados: empty ? {} : {pendiente:378,enviado:23,descartado:6}, sin_asignar: empty ? 0 : 330,
    barrio_counts: empty ? [] : [['Barrio El Centro',96],['Barrio Cabañas',71],['Colonia Brasilia',44],['Residencial Villas del Cortijo',38],['Ciudad Valcanes',31],['Barrio La Libertad',27],['Colonia Las Colinas',22],['Barrio Guadalupe',18]].map(([barrio,total])=>({barrio,total})),
    asignaciones: empty ? [] : [tecnico(1,'diego',7,3,1),tecnico(2,'elmer',7,1,0),tecnico(3,'Luis herrera',7,0,0),tecnico(4,'Melisa maradiaga',6,4,2),tecnico(5,'oscar alfredo',6,2,0),tecnico(6,'oscar ivan alvarez',5,5,0),tecnico(7,'sayma lorena',5,0,1),tecnico(8,'Sindy',5,8,2)]}),
  reports: async () => empty ? [] : [{estado:'new',created_at:hace(1)},{estado:'review',created_at:hace(9)},{estado:'review',created_at:hace(3)},{estado:'info_requested',created_at:hace(4)},{estado:'approved',created_at:hace(20)},{estado:'linked',created_at:hace(30)},{estado:'linked',created_at:hace(25)},{estado:'linked',created_at:hace(12)}]
};
function QA(){const [selection,setSelection]=useState(''); const open=(type,filter)=>setSelection(JSON.stringify({type,filter})); return <main className="cl-module is-summary"><header className="cl-module-header"><div><h1>Resumen de clandestinos</h1><p>QA local con datos simulados</p></div></header><Resumen api={api} onOpenFichas={(key)=>open('fichas',key)} onOpenBanco={(filter)=>open('banco',filter)} onOpenReportes={(key)=>open('reportes',key)} onOpenFicha={(item)=>open('ficha',item.clave_catastral)}/><output aria-label="Filtro seleccionado">{selection}</output><button type="button" onClick={async()=>{try{const wait=()=>new Promise(r=>setTimeout(r,50)); const out=()=>document.querySelector('output').textContent; const buttons=[...document.querySelectorAll('.cl-resumen-kpi')]; if(buttons.length!==4)throw Error('Faltan indicadores'); [...document.querySelectorAll('.cl-rs-steps button')].find(b=>b.textContent.includes('Aviso pendiente')).click(); await wait(); if(!out().includes('confirmed'))throw Error('Filtro de aviso incorrecto'); [...document.querySelectorAll('.cl-rs-steps button')].find(b=>b.textContent.includes('Por visitar')).click(); await wait(); if(!out().includes('pending'))throw Error('Filtro de etapa incorrecto'); document.querySelector('.cl-rs-clave').click(); await wait(); if(!out().includes('"ficha"'))throw Error('La clave no abre la ficha'); [...document.querySelectorAll('.cl-rs-tech button')].find(b=>b.textContent.includes('Sindy')).click(); await wait(); if(!out().includes('"asignado":"8"'))throw Error('El técnico no abre su banco'); document.querySelector('.cl-rs-reportes .cl-rs-clave').click(); await wait(); if(!out().includes('"reportes"'))throw Error('El estado de reporte no abre Reportes'); if(document.documentElement.scrollWidth>innerWidth)throw Error('Desbordamiento horizontal'); setSelection('QA OK: indicadores, etapas, fichas, técnicos y ancho');}catch(e){setSelection(e.message);throw e;}}}>Ejecutar comprobación UI</button></main>}
createRoot(document.getElementById('root')).render(<QA/>);
