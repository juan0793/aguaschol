import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import LiveNumber from "../../../components/micro/LiveNumber";
import SpringCheck from "../../../components/micro/SpringCheck";
import { DonutChart, MeterLegend } from "../../clandestinos/components/ClCharts";
import { formatCurrency } from "../../../utils/formatting";
import { printDocument } from "../../../utils/printDocument";
import { MAP_POINT_TYPES } from "../../../constants/formsAndUi";
import { buildFindingsPrint, FINDINGS_PRINT_STYLES } from "../utils/findingsPrint";
import "../../clandestinos/styles/clandestinos.css";

// Qué produjo el levantamiento: cada predio cae en una categoría del pastel y
// cada categoría lleva a una acción (banco, facturación, cobro).
export const CATEGORIAS = [
  { key: "sin_cuenta", label: "Sin cuenta en Aguas", hint: "Posible clandestino: la clave no tiene ninguna cuenta", icon: "warning", color: "#c2414b" },
  { key: "sin_facturar", label: "Alcantarillado sin facturar", hint: "Caja de registro o descarga en un predio que no paga alcantarillado", icon: "sewer", color: "#1769e0" },
  { key: "con_mora", label: "Con mora", hint: "Tiene cuentas y alguna debe", icon: "activity", color: "#d08a1f" },
  { key: "al_dia", label: "Al día", hint: "Tiene cuentas y ninguna debe", icon: "checkCircle", color: "#1f9463" },
  { key: "sin_clave", label: "Sin clave", hint: "El técnico no anotó la clave: no se puede cruzar", icon: "search", color: "#8fa3b8" }
];
const CAT = Object.fromEntries(CATEGORIAS.map((item) => [item.key, item]));
const TIPO = Object.fromEntries(MAP_POINT_TYPES.map((item) => [item.value, item.label]));
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const POR_PAGINA = 40;

// Periodos anclados a la jornada elegida arriba: nunca quedan vacíos por accidente.
const periodos = (dateKey) => {
  const [y, m] = String(dateKey || "").split("-");
  if (!y || !m) return [{ key: "todo", label: "Todo el histórico", from: "", to: "" }];
  const ultimo = new Date(Number(y), Number(m), 0).getDate();
  return [
    { key: "jornada", label: "Esta jornada", from: dateKey, to: dateKey },
    { key: "mes", label: `${MESES[Number(m) - 1].replace(/^./, (c) => c.toUpperCase())} ${y}`, from: `${y}-${m}-01`, to: `${y}-${m}-${String(ultimo).padStart(2, "0")}` },
    { key: "anio", label: `Año ${y}`, from: `${y}-01-01`, to: `${y}-12-31` },
    { key: "todo", label: "Todo el histórico", from: "", to: "" }
  ];
};
const plural = (n, uno, varios) => `${Number(n || 0).toLocaleString("es-HN")} ${Number(n) === 1 ? uno : varios}`;
const moneda = (value) => formatCurrency(Number(value || 0));

// Una frase que se lee de corrido en vez de otro cuadro de números.
const lectura = (data, periodo) => {
  if (!data?.totales?.predios && !data?.conteo?.sin_clave) return "No hay puntos GPS en este periodo.";
  const { conteo, totales } = data;
  const partes = [];
  if (conteo.sin_cuenta) partes.push(`${plural(conteo.sin_cuenta, "predio no tiene", "predios no tienen")} cuenta en Aguas`);
  if (conteo.sin_facturar) partes.push(`${plural(conteo.sin_facturar, "predio tiene", "predios tienen")} caja de aguas negras sin pagar alcantarillado`);
  if (conteo.con_mora) partes.push(`${plural(conteo.con_mora, "predio debe", "predios deben")} ${moneda(totales.mora)}`);
  const cierre = partes.length ? `${partes.slice(0, -1).join(", ")}${partes.length > 1 ? " y " : ""}${partes.at(-1)}.` : "todos están al día.";
  return `De ${plural(totales.predios, "predio levantado", "predios levantados")} (${periodo.label.toLowerCase()}), ${cierre}${conteo.sin_clave ? ` ${plural(conteo.sin_clave, "punto no trae", "puntos no traen")} clave y no se pudieron cruzar.` : ""}`;
};

export default function ReportFindingsTab({ apiFetch, activeDateKey, notify, onOpenBanco }) {
  const opciones = useMemo(() => periodos(activeDateKey), [activeDateKey]);
  const [periodoKey, setPeriodoKey] = useState("mes");
  const periodo = opciones.find((item) => item.key === periodoKey) || opciones[0];
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoria, setCategoria] = useState("");
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [enviando, setEnviando] = useState(false);
  const cache = useRef(new Map());

  const cargar = useCallback(async ({ fresco = false } = {}) => {
    const key = `${periodo.from}|${periodo.to}`;
    if (!fresco && cache.current.has(key)) { setData(cache.current.get(key)); return; }
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`/field-validation/findings?${new URLSearchParams({ from: periodo.from, to: periodo.to })}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudieron calcular los hallazgos.");
      cache.current.set(key, body);
      setData(body);
    } catch (reason) { setError(reason.message); } finally { setLoading(false); }
  }, [apiFetch, periodo.from, periodo.to]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setSeleccion(new Set()); setVisibles(POR_PAGINA); }, [periodoKey, categoria]);

  // Por defecto se abre la categoría más accionable que tenga algo.
  const activa = categoria || CATEGORIAS.find((item) => item.key !== "sin_clave" && data?.conteo?.[item.key])?.key || "sin_cuenta";
  const lista = useMemo(() => (data?.items || []).filter((item) => item.categoria === activa), [activa, data]);
  const nuevos = lista.filter((item) => item.categoria === "sin_cuenta" && !item.seguimiento);
  const alternar = (base) => setSeleccion((actual) => { const next = new Set(actual); next.has(base) ? next.delete(base) : next.add(base); return next; });

  const enviarAlBanco = async () => {
    const bases = seleccion.size ? [...seleccion] : nuevos.map((item) => item.base);
    if (!bases.length) return;
    setEnviando(true);
    try {
      const response = await apiFetch("/field-validation/findings/banco", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bases, from: periodo.from, to: periodo.to }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo enviar al banco.");
      notify?.(`${plural(body.nuevos, "predio nuevo", "predios nuevos")} en el Banco de clandestinos${body.actualizados ? `, ${body.actualizados} actualizados` : ""}. Ya se verificaron contra los padrones.`);
      setSeleccion(new Set());
      cache.current.clear();
      await cargar({ fresco: true });
    } catch (reason) { notify?.(reason.message); } finally { setEnviando(false); }
  };

  const imprimir = (tipo) => {
    const markup = buildFindingsPrint(lista, { tipo, periodo: periodo.label, total: tipo === "cobro" ? data?.totales?.mora : null });
    printDocument(tipo === "cobro" ? "Listado de cobro · levantamiento" : "Alcantarillado sin facturar", `${FINDINGS_PRINT_STYLES}${markup}`, { pageSize: "Letter landscape", pageMargin: "10mm", reportType: `hallazgos-${tipo}` });
  };

  const conteo = data?.conteo || {};
  const totales = data?.totales || {};
  const segmentos = CATEGORIAS.map((item) => ({ key: item.key, label: item.label, color: item.color, value: conteo[item.key] || 0, icon: item.icon, hint: item.hint }));
  const kpis = [
    { key: "predios", icon: "map", label: "Predios levantados", value: totales.predios || 0, hint: plural(totales.puntos, "punto GPS", "puntos GPS") },
    { key: "sin_cuenta", icon: "warning", label: "Posibles clandestinos", value: conteo.sin_cuenta || 0, hint: totales.nuevos_para_banco ? `${totales.nuevos_para_banco} nuevos para el Banco` : "Todos ya están en proceso", tone: conteo.sin_cuenta ? "is-danger" : "" },
    { key: "sin_facturar", icon: "sewer", label: "Alcantarillado sin facturar", value: conteo.sin_facturar || 0, hint: plural(totales.cuentas_sin_alcantarillado, "cuenta por revisar", "cuentas por revisar"), tone: conteo.sin_facturar ? "is-warning" : "" },
    { key: "con_mora", icon: "activity", label: "Mora identificada", value: Math.round(totales.mora || 0), money: true, hint: plural(conteo.con_mora, "predio con mora", "predios con mora") }
  ];

  return <section className="reports-tab-panel" role="tabpanel">
    <div className="cl-module rf-findings" aria-busy={loading}>
      <header className="rf-head">
        <div>
          <span className="cl-kicker">Hallazgos del levantamiento</span>
          <h2>Qué encontraron los técnicos en campo</h2>
          <p>Cada predio levantado se cruza con el padrón de Aguas. Toca el pastel para ver una categoría y actuar sobre ella.</p>
        </div>
        <div className="rf-periods" role="radiogroup" aria-label="Periodo">
          {opciones.map((item) => <button type="button" role="radio" aria-checked={periodoKey === item.key} key={item.key} className={periodoKey === item.key ? "is-active" : ""} onClick={() => { setPeriodoKey(item.key); setCategoria(""); }}>{item.label}</button>)}
        </div>
      </header>
      {error ? <p className="cl-alert">{error}</p> : null}
      {loading ? <span className="cl-table-progress rf-progress" role="status" aria-label="Calculando hallazgos" /> : null}
      <div className="cl-resumen-kpis rf-kpis">
        {kpis.map((kpi) => <button type="button" key={kpi.key} className={`cl-resumen-kpi ${kpi.tone || ""}`.trim()} onClick={() => CAT[kpi.key] && setCategoria(kpi.key)}>
          <span className="cl-resumen-kpi-icon"><Icon name={kpi.icon} /></span>
          <span className="cl-resumen-kpi-label">{kpi.label}</span>
          {kpi.money ? <strong><small className="rf-currency">L </small><LiveNumber value={kpi.value} flash=".cl-resumen-kpi" /></strong> : <LiveNumber as="strong" value={kpi.value} flash=".cl-resumen-kpi" />}
          <small>{kpi.hint}</small>
        </button>)}
      </div>
      <div className="rf-chart-row">
        <div className="cl-banco-chart rf-pie">
          <header><h3>Resultado por predio</h3><p>Toca un segmento</p></header>
          <div className="cl-banco-donut-row">
            <DonutChart size={168} label="Predios por resultado" centerCaption="predios" selected={activa} onSelect={(key) => setCategoria(key || "")} segments={segmentos.filter((item) => item.key !== "sin_clave")} />
            <MeterLegend selected={activa} onSelect={(key) => setCategoria(key || "")} renderIcon={(item) => <Icon name={item.icon} />} items={segmentos.filter((item) => item.key !== "sin_clave")} />
          </div>
          {/* Los puntos sin clave no son predios: van aparte para que los porcentajes sumen sobre lo mismo. */}
          {conteo.sin_clave ? <button type="button" className={`rf-sinclave ${activa === "sin_clave" ? "is-active" : ""}`.trim()} onClick={() => setCategoria(activa === "sin_clave" ? "" : "sin_clave")}><Icon name="search" />{plural(conteo.sin_clave, "punto sin clave", "puntos sin clave")}: no se pudieron cruzar con el padrón</button> : null}
        </div>
        <aside className="rf-reading">
          <h3><Icon name="notes" />En pocas palabras</h3>
          <p>{data ? lectura(data, periodo) : "Calculando…"}</p>
          {data?.padron_version ? <small>Cruce contra el padrón cargado ({String(data.padron_version).slice(0, 10)}).</small> : null}
        </aside>
      </div>

      <section className="rf-list" aria-label={CAT[activa]?.label}>
        <header>
          <div>
            <h3 style={{ "--cat": CAT[activa]?.color }}><i aria-hidden="true" />{CAT[activa]?.label}<span>{lista.length}</span></h3>
            <p>{activa === "sin_clave" ? "Estos puntos no traen clave en la nota: se corrigen desde Control territorial GPS." : CAT[activa]?.hint}</p>
          </div>
          <div className="rf-actions">
            {activa === "sin_cuenta" ? <>
              {nuevos.length ? <button type="button" className="cl-primary" disabled={enviando} onClick={enviarAlBanco}><Icon name="send" />{enviando ? "Enviando…" : seleccion.size ? `Enviar ${seleccion.size} al Banco` : `Enviar ${nuevos.length} nuevos al Banco`}</button> : null}
              <button type="button" className="cl-quiet" onClick={onOpenBanco}><Icon name="inbox" />Abrir Banco</button>
            </> : null}
            {activa === "sin_facturar" && lista.length ? <button type="button" className="cl-primary" onClick={() => imprimir("facturacion")}><Icon name="print" />Listado para facturación</button> : null}
            {activa === "con_mora" && lista.length ? <button type="button" className="cl-primary" onClick={() => imprimir("cobro")}><Icon name="print" />Listado de cobro</button> : null}
          </div>
        </header>
        {activa === "sin_clave" ? <p className="rf-empty">{plural(conteo.sin_clave, "punto", "puntos")} sin clave en este periodo.</p> : lista.length ? <>
          <div className="rf-table-wrap"><table className="rf-table">
            <thead><tr>{activa === "sin_cuenta" ? <th aria-label="Seleccionar" /> : null}<th>Clave</th><th>Barrio</th><th>Levantado</th><th>{activa === "sin_cuenta" ? "Nota de campo" : "Cuentas en Aguas"}</th>{activa === "con_mora" ? <th className="is-num">Mora</th> : null}<th>Estado</th></tr></thead>
            <tbody>{lista.slice(0, visibles).map((item) => <tr key={item.base}>
              {activa === "sin_cuenta" ? <td>{item.seguimiento ? null : <SpringCheck checked={seleccion.has(item.base)} onChange={() => alternar(item.base)} ariaLabel={`Seleccionar ${item.clave}`} />}</td> : null}
              <td className="rf-key"><strong>{item.clave}</strong>{item.latitude != null ? <a href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer" title="Ver en el mapa"><Icon name="map" /></a> : null}</td>
              <td>{item.barrio}</td>
              <td className="rf-types">{item.tipos.map((tipo) => TIPO[tipo] || tipo).join(" · ")}<small>{item.puntos.map((id) => `#${id}`).join(" ")}</small></td>
              <td>{activa === "sin_cuenta" ? <span className="rf-note">{item.nota || "—"}</span> : <ul className="rf-accounts">{item.cuentas.slice(0, 3).map((cuenta) => <li key={cuenta.abonado}><b>{cuenta.abonado}</b> {cuenta.nombre}{activa === "sin_facturar" ? <em>{cuenta.agua ? "Agua" : "Sin agua"} · sin alcantarillado</em> : null}</li>)}{item.cuentas.length > 3 ? <li className="rf-more">+{item.cuentas.length - 3} cuentas</li> : null}</ul>}</td>
              {activa === "con_mora" ? <td className="is-num">{moneda(item.deuda)}</td> : null}
              <td>{item.seguimiento?.ficha ? <span className="rf-chip is-ficha">Con ficha</span> : item.seguimiento?.banco ? <span className="rf-chip is-banco">En Banco · {item.seguimiento.banco}</span> : activa === "sin_cuenta" ? <span className="rf-chip is-new">Nuevo</span> : <span className="rf-chip">—</span>}</td>
            </tr>)}</tbody>
          </table></div>
          {lista.length > visibles ? <button type="button" className="cl-quiet rf-more-btn" onClick={() => setVisibles((n) => n + POR_PAGINA)}>Ver {Math.min(POR_PAGINA, lista.length - visibles)} más de {lista.length}</button> : null}
        </> : <p className="rf-empty">{loading ? "Calculando…" : "Nada en esta categoría para el periodo elegido."}</p>}
      </section>
    </div>
  </section>;
}
