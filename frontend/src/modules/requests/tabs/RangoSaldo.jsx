import { useEffect, useState } from "react";
import { formatCurrency } from "../../../utils/formatting";
import { POSICIONES, posicionAValor, posicionVecina, valorAPosicion } from "../utils/rangoSaldo";

const money = (value) => formatCurrency(Number(value) || 0);
const conSeparadores = (value) => Number(value || 0).toLocaleString("es-HN", { maximumFractionDigits: 2 });
const SALTO = 50;

// Casilla de monto exacto: se escribe libre y se aplica al salir o con Enter, para que
// el rango no salte mientras se teclea.
function Monto({ label, value, onCommit }) {
  const [texto, setTexto] = useState(conSeparadores(value));
  useEffect(() => setTexto(conSeparadores(value)), [value]);
  const aplicar = () => {
    const limpio = String(texto).replace(/[^\d.-]/g, "");
    const numero = Number(limpio);
    if (limpio === "" || !Number.isFinite(numero)) setTexto(conSeparadores(value));
    else { setTexto(conSeparadores(numero)); onCommit(numero); }
  };
  return <label className="pq-rango-campo">
    <span>{label}</span><i aria-hidden="true">L</i>
    <input type="text" inputMode="decimal" value={texto} onChange={(event) => setTexto(event.target.value)} onFocus={(event) => event.target.select()} onBlur={aplicar} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); aplicar(); } }} aria-label={`Saldo ${label.toLowerCase()}, en lempiras`} />
  </label>;
}

// Franja del rango de saldo: deslizador de dos puntas, montos exactos y atajos.
export default function RangoSaldo({ limites, desde, hasta, onChange }) {
  // La posición de cada punta se guarda aparte del monto: varias posiciones dan el
  // mismo monto redondeado y, sin esto, la punta volvería sola a su sitio.
  const [pos, setPos] = useState(() => ({ a: valorAPosicion(desde, limites), b: valorAPosicion(hasta, limites) }));
  useEffect(() => {
    setPos((actual) => ({
      a: posicionAValor(actual.a, limites) === desde ? actual.a : valorAPosicion(desde, limites),
      b: posicionAValor(actual.b, limites) === hasta ? actual.b : valorAPosicion(hasta, limites)
    }));
  }, [desde, hasta, limites]);

  const fijar = (nuevoDesde, nuevoHasta) => {
    const a = Math.min(limites.max, Math.max(limites.min, nuevoDesde));
    const b = Math.min(limites.max, Math.max(limites.min, nuevoHasta));
    onChange(Math.min(a, b), Math.max(a, b));
  };
  const mover = (punta, posicion) => {
    const p = Math.min(POSICIONES, Math.max(0, posicion));
    const siguiente = punta === "a" ? { a: Math.min(p, pos.b), b: pos.b } : { a: pos.a, b: Math.max(p, pos.a) };
    setPos(siguiente);
    fijar(punta === "a" ? posicionAValor(siguiente.a, limites) : desde, punta === "b" ? posicionAValor(siguiente.b, limites) : hasta);
  };
  const teclas = (punta) => (event) => {
    const actual = pos[punta];
    const destino = {
      ArrowRight: posicionVecina(actual, 1, limites), ArrowUp: posicionVecina(actual, 1, limites),
      ArrowLeft: posicionVecina(actual, -1, limites), ArrowDown: posicionVecina(actual, -1, limites),
      PageUp: actual + SALTO, PageDown: actual - SALTO
    }[event.key];
    if (destino === undefined) return;
    event.preventDefault();
    mover(punta, destino);
  };
  const atajos = [
    ["Todos", limites.min, limites.max],
    ["Con saldo", 0.01, limites.max],
    ...[1000, 5000, 20000].filter((monto) => monto < limites.max).map((monto) => [`Más de ${money(monto).replace(/\.00$/, "")}`, monto, limites.max])
  ];

  return <section className="pq-rango" aria-label="Rango de saldo">
    <h3>Saldo</h3>
    <div className="pq-rango-pista" style={{ "--desde": `${(pos.a / POSICIONES) * 100}%`, "--hasta": `${(pos.b / POSICIONES) * 100}%` }}>
      <i aria-hidden="true" />
      <input type="range" min="0" max={POSICIONES} step="1" value={pos.a} aria-label="Saldo mínimo" aria-valuetext={money(desde)} onChange={(event) => mover("a", Number(event.target.value))} onKeyDown={teclas("a")} />
      <input type="range" min="0" max={POSICIONES} step="1" value={pos.b} aria-label="Saldo máximo" aria-valuetext={money(hasta)} onChange={(event) => mover("b", Number(event.target.value))} onKeyDown={teclas("b")} />
    </div>
    <div className="pq-rango-montos">
      <Monto label="Desde" value={desde} onCommit={(valor) => fijar(valor, Math.max(valor, hasta))} />
      <Monto label="Hasta" value={hasta} onCommit={(valor) => fijar(Math.min(valor, desde), valor)} />
    </div>
    <div className="pq-rango-atajos" role="group" aria-label="Rangos frecuentes">
      {atajos.map(([label, a, b]) => <button key={label} type="button" className={desde === a && hasta === b ? "is-active" : ""} aria-pressed={desde === a && hasta === b} onClick={() => fijar(a, b)}>{label}</button>)}
    </div>
  </section>;
}
