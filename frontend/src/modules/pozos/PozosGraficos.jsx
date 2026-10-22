import { useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { CALIDADES, RANGOS, calidadDe, formatoNumero } from "./pozosFiltros";

// Gráficos de la pantalla Pozos en HTML/SVG, sin librería (como los de Entregas y el tablero).
// Paleta validada: azul #1465d9 para una sola serie; calidad en teal (dentro), rojo (fuera) y
// gris (sin medición), siempre con su leyenda o rótulo. Toda marca muestra su lectura al pasar
// el puntero o al recibir el foco, y tocarla lleva a los pozos que representa.

const porcentaje = (n, total) => (total ? Math.round((n / total) * 100) : 0);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Lectura flotante compartida por las marcas de una figura.
function useLectura() {
  const figuraRef = useRef(null);
  const [lectura, setLectura] = useState(null);
  const mostrar = (texto) => (event) => {
    const figura = figuraRef.current?.getBoundingClientRect();
    const marca = event.currentTarget.getBoundingClientRect();
    if (!figura) return;
    setLectura({ texto, x: marca.left + marca.width / 2 - figura.left, y: marca.top - figura.top });
  };
  const ocultar = () => setLectura(null);
  const props = (texto) => ({ onPointerEnter: mostrar(texto), onPointerLeave: ocultar, onFocus: mostrar(texto), onBlur: ocultar });
  const globo = lectura ? <span className="pz-lectura" role="status" style={{ left: lectura.x, top: lectura.y }}>{lectura.texto}</span> : null;
  return { figuraRef, props, globo };
}

export function Panel({ id, titulo, nota, accion, children, ancho = false }) {
  return <section className={`pz-panel${ancho ? " is-ancho" : ""}`} aria-labelledby={id}>
    <header>
      <h3 id={id}>{titulo}</h3>
      {accion}
    </header>
    {nota ? <p className="pz-panel-nota">{nota}</p> : null}
    {children}
  </section>;
}

// Barras horizontales con la misma escala y una columna fija para la cifra.
export function BarrasColonia({ filas, activa, onElegir }) {
  const { figuraRef, props, globo } = useLectura();
  const maximo = Math.max(1, ...filas.map((fila) => fila.total));
  return <div ref={figuraRef} className="pz-figura">
    <ul className="pz-barras">
      {filas.map((fila) => {
        const texto = fila.otras ? `${plural(fila.otras, "colonia más", "colonias más")} con ${plural(fila.total, "pozo", "pozos")}` : `${fila.colonia}: ${plural(fila.total, "pozo", "pozos")}`;
        return <li key={fila.colonia}>
          <button type="button" className={activa === fila.colonia ? "is-activa" : undefined} disabled={Boolean(fila.otras)} aria-label={fila.otras ? texto : `${texto}. Ver solo esta colonia`} {...props(texto)} onClick={() => onElegir(fila.colonia)}>
            <span className="pz-barra-etiqueta">{fila.colonia}</span>
            <span className="pz-barra-pista"><i style={{ "--escala": fila.total / maximo }} /></span>
            <strong>{fila.total}</strong>
          </button>
        </li>;
      })}
    </ul>
    {globo}
  </div>;
}

// Uso: una franja al 100 % con su leyenda (dos o tres partes no piden una dona).
export function FranjaUso({ uso, total }) {
  const { figuraRef, props, globo } = useLectura();
  const partes = [
    { clave: "en_uso", label: "En uso", n: uso.en_uso },
    { clave: "fuera_de_uso", label: "Fuera de uso", n: uso.fuera_de_uso },
    { clave: "sin_dato", label: "Sin dato", n: uso.sin_dato }
  ].filter((parte) => parte.n > 0);
  return <div ref={figuraRef} className="pz-figura pz-uso">
    <p className="pz-uso-cifra"><strong>{porcentaje(uso.en_uso, total)} %</strong> de los pozos está en uso</p>
    <div className="pz-franja" role="img" aria-label={partes.map((parte) => `${parte.label}: ${parte.n}`).join(", ")}>
      {partes.map((parte) => <span key={parte.clave} className={`is-${parte.clave}`} style={{ flexGrow: parte.n }} tabIndex={0} {...props(`${parte.label}: ${plural(parte.n, "pozo", "pozos")} (${porcentaje(parte.n, total)} %)`)} />)}
    </div>
    <ul className="pz-leyenda-lista">
      {partes.map((parte) => <li key={parte.clave}><i className={`is-${parte.clave}`} />{parte.label}<strong>{parte.n}</strong><span>{porcentaje(parte.n, total)} %</span></li>)}
    </ul>
    {globo}
  </div>;
}

// Calidad: la misma franja al 100 %, con dentro, fuera y sin medición.
export function FranjaCalidad({ conteos, total }) {
  const { figuraRef, props, globo } = useLectura();
  const partes = CALIDADES.map((calidad) => ({ clave: calidad.clave, label: calidad.label, n: conteos[calidad.clave] || 0 })).filter((parte) => parte.n > 0);
  return <div ref={figuraRef} className="pz-figura pz-uso">
    <div className="pz-franja" role="img" aria-label={partes.map((parte) => `${parte.label}: ${parte.n}`).join(", ")}>
      {partes.map((parte) => <span key={parte.clave} className={`is-${parte.clave}`} style={{ flexGrow: parte.n }} tabIndex={0} {...props(`${parte.label}: ${plural(parte.n, "pozo", "pozos")} (${porcentaje(parte.n, total)} %)`)} />)}
    </div>
    <ul className="pz-leyenda-lista">
      {partes.map((parte) => <li key={parte.clave}><i className={`is-${parte.clave}`} />{parte.label}<strong>{parte.n}</strong><span>{porcentaje(parte.n, total)} %</span></li>)}
    </ul>
    {globo}
  </div>;
}

// Cobertura: cuántos pozos tienen cada dato. Tocar una fila muestra los que no lo tienen.
export function Cobertura({ filas, activa, onElegir }) {
  const { figuraRef, props, globo } = useLectura();
  return <div ref={figuraRef} className="pz-figura">
    <ul className="pz-barras is-cobertura">
      {filas.map((fila) => {
        const faltan = fila.total - fila.n;
        const texto = `${fila.label}: ${fila.n} de ${fila.total} pozos (${porcentaje(fila.n, fila.total)} %)`;
        return <li key={fila.clave}>
          <button type="button" className={activa === fila.clave ? "is-activa" : undefined} disabled={!faltan} aria-label={faltan ? `${texto}. Ver los ${faltan} que no lo tienen` : texto} {...props(faltan ? `${texto} · faltan ${faltan}` : texto)} onClick={() => onElegir(fila.clave)}>
            <span className="pz-barra-etiqueta">{fila.label}</span>
            <span className="pz-barra-pista is-con-pista"><i style={{ "--escala": fila.total ? fila.n / fila.total : 0 }} /></span>
            <strong>{fila.n}<small>/{fila.total}</small></strong>
          </button>
        </li>;
      })}
    </ul>
    {globo}
  </div>;
}

const ICONO_HALLAZGO = { peligro: "warning", atencion: "flag", revisar: "map" };

export function Hallazgos({ items, onElegir }) {
  if (!items.length) return <p className="pz-vacio-panel">Nada que atender con estos filtros.</p>;
  return <ul className="pz-hallazgos">
    {items.map((item) => <li key={item.clave}>
      <button type="button" className={`is-${item.tono}`} onClick={() => onElegir(item.filtro)}>
        <Icon name={ICONO_HALLAZGO[item.tono]} />
        <strong>{item.n}</strong>
        <span>{item.texto}</span>
        <Icon name="arrowRight" />
      </button>
    </li>)}
  </ul>;
}

// Histograma con cortes fijos. Las barras dentro del valor guía van en teal y las de fuera
// en rojo; una banda tenue marca el rango guía detrás de las columnas.
export function Histograma({ barras, campo, unidad = "", decimales = 1 }) {
  const { figuraRef, props, globo } = useLectura();
  const maximo = Math.max(1, ...barras.map((barra) => barra.n));
  const total = barras.reduce((suma, barra) => suma + barra.n, 0);
  const tramo = (barra) => {
    const desde = formatoNumero(barra.desde, decimales);
    const hasta = formatoNumero(barra.hasta, decimales);
    if (barra.abiertaAbajo) return `menos de ${hasta}`;
    if (barra.abiertaArriba) return `${desde} o más`;
    return `${desde} a ${hasta}`;
  };
  if (!total) return <p className="pz-vacio-panel">Ningún pozo filtrado tiene esta medición.</p>;
  return <div ref={figuraRef} className="pz-figura pz-histograma">
    <div className="pz-histograma-plot">
      {barras.map((barra) => {
        const texto = `${tramo(barra)}${unidad ? ` ${unidad}` : ""}: ${plural(barra.n, "pozo", "pozos")} · ${barra.fuera ? "fuera del valor guía" : "dentro del valor guía"}`;
        return <div key={barra.desde} className={`pz-columna${barra.fuera ? " is-fuera" : " is-dentro"}`} style={{ "--alto": `${(barra.n / maximo) * 100}%`, "--escala": barra.n / maximo }} tabIndex={0} aria-label={texto} {...props(texto)}>
          {barra.n ? <span className="pz-columna-cifra">{barra.n}</span> : null}
          <i />
        </div>;
      })}
    </div>
    <div className="pz-histograma-eje" aria-hidden="true">
      {barras.map((barra) => <span key={barra.desde}>{barra.abiertaAbajo ? `<${formatoNumero(barra.hasta, decimales)}` : formatoNumero(barra.desde, decimales)}</span>)}
    </div>
    <ul className="pz-leyenda-lista is-linea">
      <li><i className="is-dentro" />Dentro del valor guía ({RANGOS[campo].texto})</li>
      <li><i className="is-fuera" />Fuera del valor guía</li>
    </ul>
    {globo}
  </div>;
}

// pH contra TDS: un punto por pozo con las dos mediciones. El recuadro es la zona guía
// (pH 6.5 a 8.5 y TDS hasta 1 g/L). Lo que se sale de la escala queda en el borde.
const ESCALA = { x: [4.5, 9.5], y: [0, 2] };
const DIM = { ancho: 560, alto: 300, izq: 44, der: 14, arr: 12, aba: 36 };
export function Dispersion({ pozos, onAbrir }) {
  const { figuraRef, props, globo } = useLectura();
  const puntos = pozos.filter((pozo) => Number.isFinite(pozo.ph) && Number.isFinite(pozo.tds_g_l));
  if (!puntos.length) return <p className="pz-vacio-panel">Ningún pozo filtrado tiene pH y TDS a la vez.</p>;
  const yMax = Math.max(ESCALA.y[1], Math.ceil(Math.max(...puntos.map((pozo) => pozo.tds_g_l)) * 2) / 2);
  const x = (valor) => DIM.izq + ((Math.min(Math.max(valor, ESCALA.x[0]), ESCALA.x[1]) - ESCALA.x[0]) / (ESCALA.x[1] - ESCALA.x[0])) * (DIM.ancho - DIM.izq - DIM.der);
  const y = (valor) => DIM.alto - DIM.aba - (Math.min(Math.max(valor, 0), yMax) / yMax) * (DIM.alto - DIM.aba - DIM.arr);
  const marcasX = [5, 6, 6.5, 7, 8, 8.5, 9];
  const marcasY = Array.from({ length: Math.round(yMax / 0.5) + 1 }, (_, i) => i * 0.5);
  return <div ref={figuraRef} className="pz-figura pz-dispersion">
    <svg viewBox={`0 0 ${DIM.ancho} ${DIM.alto}`} role="group" aria-label={`pH contra TDS de ${plural(puntos.length, "pozo", "pozos")}`}>
      <rect className="pz-zona-guia" x={x(6.5)} y={y(1)} width={x(8.5) - x(6.5)} height={y(0) - y(1)} />
      {marcasY.map((valor) => <g key={`y${valor}`}>
        <line className="pz-reja" x1={DIM.izq} x2={DIM.ancho - DIM.der} y1={y(valor)} y2={y(valor)} />
        <text className="pz-eje-texto" x={DIM.izq - 8} y={y(valor) + 4} textAnchor="end">{formatoNumero(valor, 1)}</text>
      </g>)}
      {marcasX.map((valor) => <text key={`x${valor}`} className="pz-eje-texto" x={x(valor)} y={DIM.alto - DIM.aba + 18} textAnchor="middle">{formatoNumero(valor, 1)}</text>)}
      <text className="pz-eje-titulo" x={(DIM.ancho + DIM.izq) / 2} y={DIM.alto - 2} textAnchor="middle">pH</text>
      <text className="pz-eje-titulo" x={12} y={(DIM.alto - DIM.aba) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(DIM.alto - DIM.aba) / 2})`}>TDS g/L</text>
      <text className="pz-zona-texto" x={x(6.5) + 6} y={y(1) + 14}>Zona guía</text>
      {puntos.map((pozo) => {
        const calidad = calidadDe(pozo);
        const texto = `${pozo.codigo} · pH ${formatoNumero(pozo.ph, 2)} · TDS ${formatoNumero(pozo.tds_g_l, 3)} g/L`;
        return <circle key={pozo.id} className={`pz-punto is-${calidad}`} cx={x(pozo.ph)} cy={y(pozo.tds_g_l)} r={5} tabIndex={0} role="button" aria-label={`${texto}. Abrir ficha`} {...props(texto)}
          onClick={() => onAbrir(pozo.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onAbrir(pozo.id); } }} />;
      })}
    </svg>
    <ul className="pz-leyenda-lista is-linea">
      <li><i className="is-dentro" />Dentro del valor guía</li>
      <li><i className="is-fuera" />Fuera del valor guía</li>
    </ul>
    {globo}
  </div>;
}

// Calidad por colonia: barra apilada con separación de 2 px entre partes.
export function CalidadPorColonia({ filas, activa, onElegir }) {
  const { figuraRef, props, globo } = useLectura();
  const maximo = Math.max(1, ...filas.map((fila) => fila.total));
  return <div ref={figuraRef} className="pz-figura">
    <ul className="pz-barras is-apiladas">
      {filas.map((fila) => <li key={fila.colonia}>
        <button type="button" className={activa === fila.colonia ? "is-activa" : undefined} disabled={Boolean(fila.otras)} onClick={() => onElegir(fila.colonia)}
          aria-label={`${fila.colonia}: ${CALIDADES.map((calidad) => `${fila[calidad.clave]} ${calidad.label.toLowerCase()}`).join(", ")}${fila.otras ? "" : ". Ver solo esta colonia"}`}>
          <span className="pz-barra-etiqueta">{fila.colonia}</span>
          <span className="pz-barra-pista">
            <span className="pz-apilada" style={{ "--escala": fila.total / maximo }}>
              {CALIDADES.map((calidad) => (fila[calidad.clave] ? <i key={calidad.clave} className={`is-${calidad.clave}`} style={{ flexGrow: fila[calidad.clave] }} {...props(`${fila.colonia} · ${calidad.label}: ${plural(fila[calidad.clave], "pozo", "pozos")}`)} /> : null))}
            </span>
          </span>
          <strong>{fila.total}</strong>
        </button>
      </li>)}
    </ul>
    <ul className="pz-leyenda-lista is-linea">
      {CALIDADES.map((calidad) => <li key={calidad.clave}><i className={`is-${calidad.clave}`} />{calidad.label}</li>)}
    </ul>
    {globo}
  </div>;
}
