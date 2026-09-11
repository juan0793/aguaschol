import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import InspeccionesStatsPage from '../src/modules/inspecciones/pages/InspeccionesStatsPage.jsx';
import '../src/styles.css';
// sidebar.css va despues de styles.css igual que en main.jsx: es quien fija el
// ancho real de la barra lateral y, con el, la caja de contenido del modulo.
import '../src/components/sidebar/sidebar.css';
import '../src/modules/inspecciones/styles/inspecciones.css';

// Datos ficticios, exclusivos de esta pagina de QA; nunca se envian al servidor.
// El reparto de porcentajes replica el del backend (mayor residuo) para que la
// leyenda sume 100 igual que en produccion.
const repartirPorcentajes = (valores, total) => {
  if (!total) return valores.map(() => 0);
  const exactos = valores.map((valor) => (valor * 100) / total);
  const piso = exactos.map((valor) => Math.floor(valor));
  const porOrden = exactos
    .map((valor, index) => ({ index, resto: valor - Math.floor(valor) }))
    .sort((a, b) => b.resto - a.resto || a.index - b.index);
  const salida = piso.slice();
  let pendiente = 100 - piso.reduce((suma, valor) => suma + valor, 0);
  for (let i = 0; i < porOrden.length && pendiente > 0; i += 1) {
    salida[porOrden[i].index] += 1;
    pendiente -= 1;
  }
  return salida;
};

const ESTADOS = ['ASIGNADA', 'EN_PROCESO', 'SEGUIMIENTO', 'FINALIZADA'];
const MES_EN_CURSO = 9;

// [asignada, en_proceso, seguimiento, finalizada] por mes.
// Enero va deliberadamente bajo (3): su barra proporcional mide ~16px, por debajo
// del min-height de 44px que .cl-module button impone a cualquier <button>. Es la
// unica forma de comprobar que el override de .ins-chart-bar gana.
const CRUDO = [
  [0, 0, 1, 2], [0, 0, 2, 16], [0, 0, 2, 23], [1, 0, 1, 20],
  [0, 0, 3, 25], [0, 1, 2, 28], [0, 0, 3, 23], [0, 1, 3, 16],
  [3, 5, 4, 12], null, null, null
];

const vacio = new URLSearchParams(location.search).has('vacio');

const construirMeses = () =>
  CRUDO.map((conteos, indice) => {
    const mes = indice + 1;
    const valores = conteos || [0, 0, 0, 0];
    const total = valores.reduce((suma, valor) => suma + valor, 0);
    const porcentajes = repartirPorcentajes(valores, total);
    return {
      mes,
      clave: `2026-${String(mes).padStart(2, '0')}`,
      total,
      futuro: mes > MES_EN_CURSO,
      en_curso: mes === MES_EN_CURSO,
      estados: ESTADOS.map((estado, posicion) => ({ estado, total: valores[posicion], porcentaje: porcentajes[posicion] })),
      seguimiento_dias_mas_antiguo: valores[2] ? 23 - indice : 0,
      claves_repetidas: total > 20 ? 3 : 1,
      tiempo_promedio_horas: total ? Number((38.4 - indice).toFixed(1)) : 0,
      tecnicos: total
        ? [
            { nombre: 'Carlos Gómez', total: Math.max(1, Math.round(total * 0.38)) },
            { nombre: 'María Flores', total: Math.max(1, Math.round(total * 0.29)) },
            { nombre: 'Luis Ramírez', total: Math.max(1, Math.round(total * 0.2)) }
          ]
        : []
    };
  });

const api = {
  tablero: async () => ({
    anio: '2026',
    anios_disponibles: ['2026', '2025', '2024'],
    mes_en_curso: MES_EN_CURSO,
    meses: vacio ? construirMeses().map((mes) => ({ ...mes, total: 0, estados: mes.estados.map((e) => ({ ...e, total: 0, porcentaje: 0 })), tecnicos: [] })) : construirMeses()
  }),
  stats: async ({ agrupar }) => ({
    agrupar,
    rows: [
      { key: 'EL CENTRO', ASIGNADA: 2, EN_PROCESO: 1, SEGUIMIENTO: 3, FINALIZADA: 14, total: 20 },
      { key: 'SAN JOSÉ', ASIGNADA: 1, EN_PROCESO: 2, SEGUIMIENTO: 1, FINALIZADA: 9, total: 13 }
    ],
    resumen: { total_inspecciones: 33, tiempo_promedio_asignacion_finalizacion_horas: 38.4, en_seguimiento: 4, reincidencias_por_clave: [] }
  })
};

function QA() {
  const [drill, setDrill] = useState('Sin navegación todavía');
  return (
    <div className="page-shell">
      <main className="cl-module">
        <p role="status" style={{ marginBottom: 12, color: '#627d98' }}>
          Datos de prueba — sin conexión al servidor · Último atajo: <strong>{drill}</strong>
        </p>
        <InspeccionesStatsPage
          api={api}
          notify={(mensaje) => setDrill(`error: ${mensaje}`)}
          onDrill={(filtros) => setDrill(JSON.stringify(filtros))}
        />
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<QA />);

// Prueba de regresion ejecutable: solo componentes locales y una API simulada.
const check = async () => {
  const wait = () => new Promise((resolve) => setTimeout(resolve, 300));
  await wait();
  if (vacio) {
    if (!document.body.textContent.includes('No hay inspecciones asignadas en 2026')) throw Error('Falta el estado vacío del año');
    return 'OK (año vacío)';
  }

  const barras = document.querySelectorAll('.ins-chart-bar');
  if (barras.length !== 12) throw Error(`Se esperaban 12 barras, hay ${barras.length}`);

  // Los meses futuros no deben ser accionables.
  const futuras = [...barras].slice(9);
  if (futuras.some((barra) => !barra.disabled)) throw Error('Un mes futuro quedó clicable');

  // .cl-module button impone min-height 44px: las barras deben ganarle.
  const septiembre = barras[8];
  if (septiembre.getBoundingClientRect().height > 200) throw Error('La barra desborda el plot');
  const enero = barras[0];
  const altoEnero = enero.getBoundingClientRect().height;
  if (altoEnero > 30) throw Error(`Enero mide ${altoEnero}px; debía rondar los 16px: el min-height de 44px no fue vencido`);
  // Y la altura sigue siendo proporcional, no un mínimo arbitrario.
  const altoJunio = barras[5].getBoundingClientRect().height;
  if (Math.abs(altoEnero / altoJunio - 3 / 31) > 0.02) throw Error('Las barras no son proporcionales al total del mes');

  // La leyenda debe sumar 100 y los KPI el total del mes.
  const pct = [...document.querySelectorAll('.ins-composicion-legend li')].map((li) => Number(li.textContent.match(/(\d+)%$/)[1]));
  if (pct.reduce((a, b) => a + b, 0) !== 100) throw Error(`Los porcentajes suman ${pct.reduce((a, b) => a + b, 0)}`);
  const kpis = [...document.querySelectorAll('.cl-indicators strong')].map((el) => Number(el.textContent));
  if (kpis.reduce((a, b) => a + b, 0) !== 24) throw Error(`Los KPI suman ${kpis.reduce((a, b) => a + b, 0)}, no 24`);

  // El atajo debe arrastrar estado + rango del mes.
  document.querySelectorAll('.cl-indicators button')[2].click(); await wait();
  const salida = document.querySelector('[role="status"] strong').textContent;
  if (!salida.includes('SEGUIMIENTO') || !salida.includes('2026-09-01') || !salida.includes('2026-09-30')) {
    throw Error(`El atajo no arrastra mes + estado: ${salida}`);
  }

  // Cambiar de mes debe recalcular todo lo de abajo.
  barras[5].click(); await wait();
  if (!document.body.textContent.includes('Junio 2026 · 31 inspecciones asignadas')) throw Error('El clic en la barra no cambió el mes');

  return 'OK';
};

check().then((r) => console.log('QA inspecciones-stats:', r)).catch((e) => console.error('QA inspecciones-stats FALLÓ:', e.message));
