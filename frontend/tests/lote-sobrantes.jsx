import React from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import LoteSobrantesPrint from '../src/modules/entregas/print/LoteSobrantesPrint.jsx';
import InspeccionesTable from '../src/modules/inspecciones/components/InspeccionesTable.jsx';
import '../src/styles.css';
import '../src/components/sidebar/sidebar.css';
import '../src/modules/entregas/styles/entregas.css';
import '../src/modules/inspecciones/styles/inspecciones.css';

// Datos ficticios, exclusivos de esta pagina de QA; nunca se envian al servidor.
const MOTIVOS = [
  { codigo: 'CASA_CERRADA', etiqueta: 'Casa cerrada' },
  { codigo: 'DIRECCION_NO_ENCONTRADA', etiqueta: 'Dirección no encontrada' },
  { codigo: 'PREDIO_DESHABITADO', etiqueta: 'Predio deshabitado' },
  { codigo: 'RECHAZO_RECEPCION', etiqueta: 'Rechazo de recepción' },
  { codigo: 'OTRO', etiqueta: 'Otro' }
];

const NOMBRES = [
  'MARIA ESTHER GUEVARA NUNEZ', 'MADERAS CURADAS LARDIZABAL', 'UNIVERSIDAD CRISTIANA EVANGE NUEVO MILENIO',
  'JOSE ANTONIO MEJIA CRUZ', 'COMERCIAL LA ESPERANZA S DE RL', 'ANA LUCIA FLORES MARADIAGA',
  'PULPERIA DONA CARMEN', 'ROBERTO CARLOS DIAZ PINEDA', 'INVERSIONES DEL SUR SA',
  'GLORIA MARGARITA CASTILLO', 'TALLER MECANICO EL PROGRESO', 'SOFIA ALEJANDRA RIVERA',
  'DISTRIBUIDORA CHOLUTECA LTDA'
];

const documentos = NOMBRES.map((nombre, indice) => ({
  id: indice + 1,
  numero_abonado: String(1479 - indice * 13),
  clave_catastral: `06-01-02-${String(100 + indice).padStart(4, '0')}`,
  abonado_nombre: nombre,
  motivo: MOTIVOS[indice % MOTIVOS.length].codigo,
  estado: indice % 4 === 0 ? 'REENTREGADA' : 'PENDIENTE',
  observacion: indice === 2 ? 'El portón estaba con candado y el vigilante indicó que la administración solo recibe correspondencia los martes por la mañana.' : ''
}));

const lote = {
  id: 55,
  fecha: '2026-09-11',
  estado: 'CERRADO',
  tipo_documento: 'FACTURA',
  responsable_nombre: 'Karen Melissa Maradiaga',
  barrio_nombre: 'Lotificacion Carranza',
  total_asignadas: 135,
  total_entregadas: 122,
  total_sobrantes: 13,
  closed_by: 4,
  closed_by_nombre: 'Luis herrera',
  closed_at: '2026-09-11T21:31:05.000Z',
  observacion_inicial: '',
  observacion_responsable: 'Zona con varias casas de veraneo; se reintentará el lunes.',
  no_entregadas: documentos
};

const inspecciones = [
  { id: 1, numero_inspeccion: 'INS-0042', motivo: 'Posible irregularidad', clave_catastral: '06-01-02-0011', abonado_nombre_snapshot: 'Juan Martínez', barrio_snapshot: 'El Centro', tecnico_responsable_nombre: 'Carlos Gómez', estado: 'FINALIZADA', fecha_asignacion: '2026-09-12', print_status: { ORDEN: { impreso: true }, REPORTE: { impreso: false } } },
  { id: 2, numero_inspeccion: 'INS-0041', motivo: 'Verificación de conexión', clave_catastral: '06-01-02-0012', abonado_nombre_snapshot: 'Ana López', barrio_snapshot: 'San José', tecnico_responsable_nombre: 'María Flores', estado: 'SEGUIMIENTO', fecha_asignacion: '2026-09-12', print_status: { ORDEN: { impreso: false }, REPORTE: { impreso: false } } },
  { id: 3, numero_inspeccion: 'INS-0040', motivo: 'Revisión solicitada', clave_catastral: '06-01-02-0013', abonado_nombre_snapshot: 'Roberto Díaz', barrio_snapshot: 'Los Laureles', tecnico_responsable_nombre: 'Carlos Gómez', estado: 'EN_PROCESO', fecha_asignacion: '2026-09-11', print_status: { ORDEN: { impreso: true }, REPORTE: { impreso: true } } }
];

const model = {
  items: inspecciones, total: 3, page: 1, total_pages: 1, limit: 10, loading: false, error: '',
  filters: { q: '', estado: '', barrio: '', tecnico_id: '', fecha_desde: '', fecha_hasta: '' },
  setFilters: () => {}, clearFilters: () => {}, setPage: () => {}
};

function QA() {
  return (
    <div className="page-shell">
      <main className="cl-module">
        <p role="status" style={{ marginBottom: 12, color: '#627d98' }}>
          Datos de prueba — sin conexión al servidor.{' '}
          <button type="button" className="cl-secondary" onClick={() => { document.body.classList.add('ent-imprimiendo-acta'); window.print(); }}>
            Imprimir acta
          </button>
        </p>

        <h2 style={{ margin: '18px 0 8px' }}>Acta de sobrantes (vista previa)</h2>
        <div className="ent-print-preview">
          <LoteSobrantesPrint lote={lote} motivos={MOTIVOS} generadoEn="2026-09-11T22:10:00.000Z" />
        </div>

        <h2 style={{ margin: '26px 0 8px' }}>Tabla de inspecciones (columnas responsivas)</h2>
        <InspeccionesTable model={model} tecnicos={[]} isAdmin onOpen={() => {}} />

        {/* Hace de "resto de la pantalla de Entregas" (indicadores, lotes,
            filtros): contenido normal, alto y en flujo. Sin el arreglo, todo
            ese alto se paginaba como hojas en blanco detrás del acta. */}
        <div style={{ height: 2400 }} aria-hidden="true" />
      </main>

      {/* Misma estructura que en produccion: el acta real va en un portal a
          <body>, fuera de #root, para que la impresion no arrastre el alto de
          la aplicacion. */}
      {createPortal(
        <div className="ent-acta-portal">
          <LoteSobrantesPrint lote={lote} motivos={MOTIVOS} generadoEn="2026-09-11T22:10:00.000Z" />
        </div>,
        document.body
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<QA />);

// --- Prueba de regresion ejecutable ----------------------------------------
// Solo componentes locales, sin red.

const VISIBLE = (el) => el && getComputedStyle(el).display !== 'none';
const columnas = () => [...document.querySelectorAll('.ins-table thead th')]
  .map((th, i) => ({ n: i + 1, txt: th.textContent.trim() || '(acción)', ok: VISIBLE(th) }));

// Fuerza las reglas @media print a aplicarse en pantalla, para poder medir como
// quedaria el documento impreso sin depender del dialogo del navegador.
const conMediaDeImpresion = (fn) => {
  const reglas = [];
  for (const hoja of document.styleSheets) {
    let lista;
    try { lista = hoja.cssRules; } catch { continue; }
    for (const regla of lista) {
      if (regla.media && String(regla.media.mediaText).includes('print')) {
        reglas.push([regla, regla.media.mediaText]);
      }
    }
  }
  reglas.forEach(([regla]) => { regla.media.mediaText = 'screen'; });
  try { return fn(); } finally { reglas.forEach(([regla, original]) => { regla.media.mediaText = original; }); }
};

const check = async () => {
  await new Promise((r) => setTimeout(r, 400));

  const filas = document.querySelectorAll('.ent-acta-portal .ent-hoja-tabla tbody tr');
  if (filas.length !== 13) throw Error(`El acta lista ${filas.length} documentos, no 13`);
  if (!document.body.textContent.includes('Casa cerrada')) throw Error('El motivo no usa la etiqueta del catálogo');
  if (document.body.textContent.includes('CASA_CERRADA')) throw Error('Quedó el código crudo del motivo');

  const hoja = document.querySelector('.ent-acta-portal .ent-hoja');
  if (hoja.scrollWidth > hoja.clientWidth + 1) throw Error(`La hoja desborda: ${hoja.scrollWidth} > ${hoja.clientWidth}`);

  const kpis = [...document.querySelectorAll('.ent-acta-portal .ent-hoja-kpis strong')].map((e) => Number(e.textContent.replace(/\D/g, '')));
  if (kpis[1] + kpis[2] !== kpis[0]) throw Error(`Los KPI no cuadran: ${kpis[1]}+${kpis[2]} != ${kpis[0]}`);
  if (document.querySelectorAll('.ent-acta-portal .ent-hoja-firmas i').length !== 3) throw Error('Faltan líneas de firma');

  // El fallo de las hojas en blanco: al imprimir, el documento debe medir lo que
  // mide el acta y no lo que mide la aplicacion que quedo detras.
  // Se mide body.scrollHeight y no documentElement.scrollHeight: este ultimo
  // nunca baja del alto del viewport y taparia el resultado.
  const sinMarca = conMediaDeImpresion(() => document.body.scrollHeight);

  document.body.classList.add('ent-imprimiendo-acta');
  const medida = conMediaDeImpresion(() => ({
    alto: document.body.scrollHeight,
    altoActa: document.querySelector('.ent-acta-portal').getBoundingClientRect().height,
    rootOculto: !VISIBLE(document.getElementById('root'))
  }));
  document.body.classList.remove('ent-imprimiendo-acta');

  if (!medida.rootOculto) throw Error('#root sigue ocupando espacio al imprimir');
  const sobra = medida.alto - medida.altoActa;
  if (sobra > 4) throw Error(`Sobran ${Math.round(sobra)}px de documento sobre el acta: saldrán hojas en blanco`);
  // Y la prueba debe seguir siendo capaz de detectar la regresion.
  if (sinMarca <= medida.alto * 1.5) throw Error('La prueba ya no distingue el caso roto del arreglado');

  // Letter a 96dpi son 1056px, menos 12mm de margen arriba y abajo (~45px c/u).
  const paginas = Math.max(1, Math.ceil(medida.alto / 966));
  return {
    ok: true,
    altoSinArreglo: Math.round(sinMarca),
    altoImpreso: Math.round(medida.alto),
    altoActa: Math.round(medida.altoActa),
    paginasEstimadas: paginas,
    columnasVisibles: columnas().filter((c) => c.ok).map((c) => c.n)
  };
};

check()
  .then((r) => console.log('QA lote-sobrantes:', JSON.stringify(r)))
  .catch((e) => console.error('QA lote-sobrantes FALLÓ:', e.message));
