import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { formatoNumero } from "./pozosFiltros";
import { conductividadDe, curvaCarbonato, especiacionCarbonato, lecturaDe } from "./pozosQuimica";

// Lectura de una medición, abierta desde la ficha del pozo: qué mide, la regla (norma hondureña
// u OMS), dónde cae el valor en su escala y qué significa. Para el pH muestra además el reparto
// real del carbono disuelto calculado del pH, con un control para ver cómo cambia.

const ETIQUETA_ESTADO = { dentro: "Dentro de lo recomendado", fuera: "Fuera de lo recomendado", atencion: "Atención", info: "Referencia", no_detectado: "No detectado", sin: "Sin medición" };
const ESPECIES = [
  { clave: "co2", label: "CO₂ (ácido carbónico)", corto: "CO₂", color: "#e0702a" },
  { clave: "bicarbonato", label: "Bicarbonato (HCO₃⁻)", corto: "HCO₃⁻", color: "#1465d9" },
  { clave: "carbonato", label: "Carbonato (CO₃²⁻)", corto: "CO₃²⁻", color: "#12a08a" }
];

// Escala de cada parámetro: tramo visible, bandas con significado y marcas de referencia.
const ESCALAS = {
  ph: { min: 4, max: 10, unidad: "", decimales: 2, bandas: [{ desde: 6.5, hasta: 8.5, label: "Recomendado" }], marcas: [{ valor: 7, label: "Neutro" }] },
  tds_g_l: { min: 0, max: 1200, unidad: "mg/L", decimales: 0, factor: 1000, bandas: [{ desde: 0, hasta: 600, label: "Sabor bueno (OMS)" }], marcas: [{ valor: 1000, label: "Máximo norma", fuerte: true }] },
  conductividad: { min: 50, max: 60000, log: true, unidad: "µS/cm a 25 °C", decimales: 0, bandas: [{ desde: 50, hasta: 400, label: "Recomendado" }], marcas: [{ valor: 50000, label: "Agua de mar" }] },
  salinidad: { min: 0.01, max: 40, log: true, unidad: "ppt", decimales: 2, bandas: [{ desde: 0.01, hasta: 1, label: "Agua dulce" }], marcas: [{ valor: 35, label: "Agua de mar" }] },
  temperatura_c: { min: 15, max: 40, unidad: "°C", decimales: 1, bandas: [{ desde: 18, hasta: 30, label: "Recomendado" }], marcas: [{ valor: 35, label: "Muy alta" }] },
  oxigeno_disuelto: { min: 0, max: 110, unidad: "%", decimales: 1, bandas: [{ desde: 0, hasta: 20, label: "Sin oxígeno", tono: "neutro" }, { desde: 60, hasta: 110, label: "Aireada", tono: "neutro" }], marcas: [] },
  cloro_residual: { min: 0, max: 1.5, unidad: "mg/L", decimales: 2, bandas: [{ desde: 0.5, hasta: 1, label: "Recomendado tratada" }], marcas: [{ valor: 0.1, label: "Límite de detección" }] }
};

function Escala({ campo, valor }) {
  const escala = ESCALAS[campo];
  if (!escala || valor === null) return null;
  const transformar = (n) => (escala.log ? Math.log10(n) : n);
  const pos = (n) => {
    const limitado = Math.min(Math.max(n, escala.min), escala.max);
    return ((transformar(limitado) - transformar(escala.min)) / (transformar(escala.max) - transformar(escala.min))) * 100;
  };
  const mostrado = valor * (escala.factor || 1);
  return <div className="pz-q-escala" role="img" aria-label={`${formatoNumero(mostrado, escala.decimales)} ${escala.unidad} en una escala de ${formatoNumero(escala.min, 2)} a ${formatoNumero(escala.max, 0)}`}>
    <div className="pz-q-pista">
      {escala.bandas.map((banda) => <span key={banda.label} className={`pz-q-banda${banda.tono ? ` is-${banda.tono}` : ""}`} style={{ left: `${pos(banda.desde)}%`, width: `${pos(banda.hasta) - pos(banda.desde)}%` }}><small>{banda.label}</small></span>)}
      {escala.marcas.map((marca) => <span key={marca.label} className={`pz-q-referencia${marca.fuerte ? " is-fuerte" : ""}${pos(marca.valor) > 85 ? " is-derecha" : ""}`} style={{ left: `${pos(marca.valor)}%` }}><small>{marca.label}</small></span>)}
      <span className="pz-q-valor" style={{ left: `${pos(mostrado)}%` }}><b>{formatoNumero(mostrado, escala.decimales)}</b></span>
    </div>
    <div className="pz-q-extremos" aria-hidden="true"><span>{formatoNumero(escala.min, 2)}</span><span>{formatoNumero(escala.max, 0)}</span></div>
  </div>;
}

// Curvas del sistema carbonato de pH 4 a 10, la marca del pH elegido y el reparto en una franja.
const ANCHO = 520;
const ALTO = 190;
const M = { izq: 34, der: 12, arr: 10, aba: 26 };
function Carbonato({ phMedido, temperatura }) {
  const [ph, setPh] = useState(phMedido);
  useEffect(() => { setPh(phMedido); }, [phMedido]);
  const curva = useMemo(() => curvaCarbonato(temperatura), [temperatura]);
  const reparto = especiacionCarbonato(ph, temperatura);
  const x = (valor) => M.izq + ((valor - 4) / 6) * (ANCHO - M.izq - M.der);
  const y = (porcentaje) => M.arr + (1 - porcentaje / 100) * (ALTO - M.arr - M.aba);
  const linea = (clave) => curva.map((punto, i) => `${i ? "L" : "M"}${x(punto.ph).toFixed(1)},${y(punto[clave]).toFixed(1)}`).join(" ");
  const tempTexto = Number.isFinite(temperatura) ? ` y ${formatoNumero(temperatura, 1)} °C` : "";
  const cambiado = Math.abs(ph - phMedido) > 0.001;
  return <section className="pz-q-carbonato" aria-labelledby="pz-q-carbonato-titulo">
    <h4 id="pz-q-carbonato-titulo">Cómo está el carbono disuelto a este pH</h4>
    <p className="pz-q-nota">Calculado del pH medido (equilibrio del carbonato). Son proporciones, no cantidades: para saber cuántos mg/L hay que medir la alcalinidad.</p>
    <div className="pz-q-reparto" aria-live="polite">
      <div className="pz-q-franja" role="img" aria-label={ESPECIES.map((especie) => `${especie.label} ${Math.round(reparto[especie.clave])} %`).join(", ")}>
        {ESPECIES.map((especie) => (reparto[especie.clave] >= 0.5 ? <span key={especie.clave} style={{ flexGrow: reparto[especie.clave], background: especie.color }} /> : null))}
      </div>
      <ul>
        {ESPECIES.map((especie) => <li key={especie.clave}><i style={{ background: especie.color }} />{especie.label}<strong>{Math.round(reparto[especie.clave])} %</strong></li>)}
      </ul>
    </div>
    <svg className="pz-q-curvas" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={`Reparto del carbono disuelto entre pH 4 y 10; marcado pH ${formatoNumero(ph, 2)}`}>
      <rect className="pz-q-zona" x={x(6.5)} y={M.arr} width={x(8.5) - x(6.5)} height={ALTO - M.arr - M.aba} />
      {[0, 50, 100].map((valor) => <g key={valor}>
        <line className="pz-reja" x1={M.izq} x2={ANCHO - M.der} y1={y(valor)} y2={y(valor)} />
        <text className="pz-eje-texto" x={M.izq - 6} y={y(valor) + 4} textAnchor="end">{valor}%</text>
      </g>)}
      {[4, 5, 6, 7, 8, 9, 10].map((valor) => <text key={valor} className="pz-eje-texto" x={x(valor)} y={ALTO - 8} textAnchor="middle">{valor}</text>)}
      {ESPECIES.map((especie) => <path key={especie.clave} d={linea(especie.clave)} fill="none" stroke={especie.color} strokeWidth="2" />)}
      <text className="pz-q-rotulo" x={x(4.4)} y={y(96) + 14} fill={ESPECIES[0].color}>CO₂</text>
      <text className="pz-q-rotulo" x={x(8.2)} y={y(96) + 14} fill={ESPECIES[1].color} textAnchor="middle">HCO₃⁻</text>
      <text className="pz-q-rotulo" x={x(9.95)} y={y(18)} fill={ESPECIES[2].color} textAnchor="end">CO₃²⁻</text>
      <line className="pz-q-cursor" x1={x(ph)} x2={x(ph)} y1={M.arr} y2={ALTO - M.aba} />
      {ESPECIES.map((especie) => <circle key={especie.clave} cx={x(ph)} cy={y(reparto[especie.clave])} r="4" fill={especie.color} stroke="#fff" strokeWidth="2" />)}
      {cambiado ? <line className="pz-q-medido" x1={x(phMedido)} x2={x(phMedido)} y1={M.arr} y2={ALTO - M.aba} /> : null}
    </svg>
    <label className="pz-q-control">
      <span>Probar otro pH <strong>{formatoNumero(ph, 2)}</strong>{cambiado ? <button type="button" onClick={() => setPh(phMedido)}>Volver al medido ({formatoNumero(phMedido, 2)})</button> : <em>medido{tempTexto}</em>}</span>
      <input type="range" min="4" max="10" step="0.05" value={ph} onChange={(event) => setPh(Number(event.target.value))} aria-label="pH para el cálculo" />
    </label>
  </section>;
}

export default function PozoQuimica({ campo, pozo, onCerrar }) {
  const lectura = lecturaDe(campo, pozo);
  if (!lectura) return null;
  const conductividad = campo === "conductividad" ? conductividadDe(pozo) : null;
  const escala = ESCALAS[campo];
  const valorTexto = lectura.valor === null ? "—"
    : `${formatoNumero(lectura.valor * (escala?.factor || 1), escala?.decimales ?? 2)}${escala?.unidad ? ` ${escala.unidad}` : ""}`;
  return <section className={`pz-q is-${lectura.estado}`} id="pz-lectura-quimica" aria-labelledby="pz-q-titulo">
    <header>
      <div>
        <h3 id="pz-q-titulo">{lectura.titulo}</h3>
        <p className="pz-q-valor-grande">{valorTexto}</p>
        {conductividad?.temperatura ? <p className="pz-q-nota">{formatoNumero(conductividad.temperatura, 0)} µS/cm a la temperatura de la muestra{Number.isFinite(pozo.temperatura_c) ? ` (${formatoNumero(pozo.temperatura_c, 1)} °C)` : ""}.</p> : null}
      </div>
      <span className="pz-q-estado">{ETIQUETA_ESTADO[lectura.estado]}</span>
      <button type="button" className="cl-icon-button" onClick={onCerrar} aria-label="Cerrar la lectura"><Icon name="close" /></button>
    </header>
    <p className="pz-q-que">{lectura.queMide}</p>
    <Escala campo={campo} valor={lectura.valor} />
    <p className="pz-q-resumen"><strong>{lectura.resumen}</strong> {lectura.frases?.join(" ")}</p>
    <p className="pz-q-regla"><Icon name="flag" />{lectura.regla}</p>
    {lectura.nota ? <p className="pz-q-nota">{lectura.nota}</p> : null}
    {lectura.revisiones?.length ? <ul className="pz-q-revisar">{lectura.revisiones.map((aviso) => <li key={aviso.texto}><Icon name="warning" />{aviso.texto}</li>)}</ul> : null}
    {campo === "ph" && lectura.valor !== null ? <Carbonato phMedido={lectura.valor} temperatura={Number.isFinite(pozo.temperatura_c) ? pozo.temperatura_c : 25} /> : null}
    {lectura.confirmar ? <p className="pz-q-nota"><strong>Confirmar:</strong> {lectura.confirmar.replace(/^Para confirmar en laboratorio: /, "en laboratorio, ")}</p> : null}
    {lectura.tratamiento ? <p className="pz-q-nota"><strong>Si se confirma:</strong> {lectura.tratamiento.replace(/^Si se confirma, /, "")}</p> : null}
    <p className="pz-q-pie">Medición de campo con equipo portátil, de fecha y calibración desconocidas. No incluye bacterias ni metales: no basta para declarar el agua potable. Fuentes: Norma Técnica Nacional para la Calidad del Agua Potable (Acuerdo 084/1995) y Guías de la OMS (4.ª ed.).</p>
  </section>;
}
