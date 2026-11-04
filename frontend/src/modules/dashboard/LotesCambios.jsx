import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { formatCurrency } from "../../utils/currency.js";
import { formatCompactCurrency } from "./dashboardSelectors";

// Diferencias entre el lote FoxPro activo y el anterior. La mora se explica como un puente:
// mora anterior + nuevas + aumentos − bajas − saldadas − las que salieron = mora de este lote.

const MENOS = "−";
const entero = (valor) => Math.abs(Number(valor) || 0).toLocaleString("es-HN");
const signo = (valor) => (Number(valor) > 0 ? "+" : Number(valor) < 0 ? MENOS : "±");
export const deltaCuentas = (valor) => `${signo(valor)}${entero(valor)}`;
export const deltaMonto = (valor) => `${signo(valor)}${formatCompactCurrency(Math.abs(Number(valor) || 0))}`;
export const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString("es-HN", { day: "numeric", month: "short", timeZone: "America/Tegucigalpa" }).replace(".", "") : "");
const fechaLote = (lote) => fechaCorta(lote?.fecha_extraccion || lote?.fecha_aplicacion || lote?.fecha_recepcion || lote?.fecha_corte);

// Pide la comparación al abrir el tablero y cada vez que cambia el corte del padrón.
export function useLotesComparacion(fetcher, corte) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [anterior, setAnterior] = useState("");
  const [estado, setEstado] = useState({ cargando: false, data: null, error: "" });
  const hay = Boolean(fetcher);
  useEffect(() => {
    if (!hay) return undefined;
    let vivo = true;
    setEstado((actual) => ({ ...actual, cargando: true, error: "" }));
    fetcherRef.current(anterior)
      .then((data) => { if (vivo) setEstado({ cargando: false, data, error: "" }); })
      .catch((error) => { if (vivo) setEstado((actual) => ({ ...actual, cargando: false, error: error.message || "No se pudo comparar los lotes." })); });
    return () => { vivo = false; };
  }, [hay, corte, anterior]);
  return { ...estado, disponible: Boolean(estado.data?.disponible), anterior, setAnterior };
}

// Para los niveles de "Cuentas del padrón": valor del lote anterior y cambio, por nivel.
export const nivelesPrevios = (lotes) => {
  const comparacion = lotes?.data?.disponible ? lotes.data.comparacion : null;
  if (!comparacion) return null;
  const { anterior, actual } = comparacion;
  return {
    padron: { antes: anterior.cuentas, cambio: actual.cuentas - anterior.cuentas },
    mora: { antes: anterior.con_mora, cambio: actual.con_mora - anterior.con_mora },
    critica: { antes: anterior.mora_alta, cambio: actual.mora_alta - anterior.mora_alta },
    total: { antes: anterior.total, cambio: actual.total - anterior.total },
    lote: lotes.data.anterior
  };
};

const PUENTE = [
  ["nuevas", 1, "Cuentas nuevas", "entraron al padrón"],
  ["aumentaron", 1, "Subió su mora", "cuentas con más saldo"],
  ["bajaron", -1, "Bajó su mora", "abonaron una parte"],
  ["saldaron", -1, "Pagaron todo", "quedaron al día"],
  ["salieron", -1, "Salieron del padrón", "ya no vienen en el lote"]
];

const Barra = ({ valor, escala }) => {
  const ancho = escala ? Math.min(50, (Math.abs(valor) / escala) * 50) : 0;
  return <span className="dw-div-barra" aria-hidden="true">
    <i className={valor >= 0 ? "is-sube" : "is-baja"} style={{ width: `${ancho}%`, [valor >= 0 ? "left" : "right"]: "50%" }} />
  </span>;
};

export function CambiosDelLote({ lotes, navigate, onPrint }) {
  const data = lotes.data;
  if (!data && !lotes.error) return null;
  const comparacion = data?.disponible ? data.comparacion : null;
  const movimientos = comparacion?.movimientos;
  const escalaPuente = movimientos ? Math.max(1, ...PUENTE.map(([clave]) => movimientos[clave].monto)) : 1;
  const barrios = comparacion ? [...comparacion.barrios.subieron.slice(0, 5), ...comparacion.barrios.bajaron.slice(0, 5)].sort((a, b) => b.diferencia - a.diferencia) : [];
  const escalaBarrios = Math.max(1, ...barrios.map((fila) => Math.abs(fila.diferencia)));
  const diferencia = comparacion ? comparacion.actual.total - comparacion.anterior.total : 0;
  const pendiente = data?.pendiente && (!data.actual?.fecha_recepcion || new Date(data.pendiente.fecha_recepcion) > new Date(data.actual.fecha_recepcion)) ? data.pendiente : null;

  return <section className="dw-lotes" aria-labelledby="dw-lotes-titulo" aria-busy={lotes.cargando}>
    <header className="dw-lotes-head">
      <div>
        <h2 id="dw-lotes-titulo" className="dw-eyebrow">Cambios desde el lote anterior</h2>
        {data ? <p className="dw-lotes-sub">
          Lote <b>{data.actual?.codigo}</b>{fechaLote(data.actual) ? ` del ${fechaLote(data.actual)}` : ""} comparado con{" "}
          {data.lotes?.length > 1 ? <label className="dw-lotes-select">
            <span className="dw-sr">Lote anterior</span>
            <select value={lotes.anterior || data.anterior?.codigo || ""} onChange={(event) => lotes.setAnterior(event.target.value)} disabled={lotes.cargando}>
              {data.lotes.map((lote) => <option key={lote.codigo} value={lote.codigo}>{lote.codigo}{fechaLote(lote) ? ` · ${fechaLote(lote)}` : ""}</option>)}
            </select>
          </label> : <b>{data.anterior?.codigo || "el lote anterior"}{fechaLote(data.anterior) ? ` del ${fechaLote(data.anterior)}` : ""}</b>}
        </p> : null}
      </div>
      {comparacion && onPrint ? <button type="button" className="dw-icon-button" onClick={() => onPrint(data)} title="Imprimir la comparación" aria-label="Imprimir la comparación de lotes"><Icon name="print" /></button> : null}
    </header>

    {pendiente ? <p className="dw-lotes-pendiente">
      <Icon name="refresh" />
      <span className="dw-lotes-pendiente-texto">Llegó el lote <b>{pendiente.codigo}</b>{fechaLote(pendiente) ? ` (${fechaLote(pendiente)})` : ""} y todavía no se activa: {entero(pendiente.nuevos)} cuentas nuevas y {entero(pendiente.modificados)} con cambios.</span>
      {navigate ? <button type="button" onClick={() => navigate("importacion")}>Revisar lote<Icon name="arrowRight" /></button> : null}
    </p> : null}

    {lotes.error ? <p className="dw-lotes-vacio">{lotes.error}</p> : !comparacion ? <p className="dw-lotes-vacio">{data?.motivo || "Todavía no hay un lote anterior para comparar."}</p> : <>
      <div className="dw-lotes-cuerpo">
        <div className="dw-puente">
          <h3>De dónde sale la diferencia de mora</h3>
          <p className="dw-puente-extremo"><span>Mora del lote anterior</span><b className="dw-figure" title={formatCurrency(comparacion.anterior.total)}>{formatCompactCurrency(comparacion.anterior.total)}</b></p>
          <ol className="dw-div-lista">
            {PUENTE.map(([clave, direccion, etiqueta, ayuda]) => {
              const fila = movimientos[clave];
              const valor = direccion * fila.monto;
              return <li key={clave} className={fila.cuentas ? "" : "is-vacio"}>
                <span className="dw-div-texto"><strong>{etiqueta}</strong><small>{entero(fila.cuentas)} {fila.cuentas === 1 ? "cuenta" : "cuentas"} · {ayuda}</small></span>
                <Barra valor={valor} escala={escalaPuente} />
                <b className={`dw-figure ${valor > 0 ? "is-sube" : valor < 0 ? "is-baja" : ""}`.trim()} title={formatCurrency(fila.monto)}>{fila.monto ? deltaMonto(valor) : "—"}</b>
              </li>;
            })}
          </ol>
          <p className="dw-puente-extremo is-actual">
            <span>Mora de este lote</span>
            <b className="dw-figure" title={formatCurrency(comparacion.actual.total)}>{formatCompactCurrency(comparacion.actual.total)}</b>
            <em className={diferencia > 0 ? "is-sube" : diferencia < 0 ? "is-baja" : ""}>{deltaMonto(diferencia)}{comparacion.anterior.total ? ` · ${signo(diferencia)}${Math.abs((diferencia / comparacion.anterior.total) * 100).toLocaleString("es-HN", { maximumFractionDigits: 1 })}%` : ""}</em>
          </p>
        </div>

        <div className="dw-barrios-cambio">
          <h3>Barrios donde más cambió la mora</h3>
          {barrios.length ? <ol className="dw-div-lista is-barrios">
            {barrios.map((fila) => <li key={fila.barrio}>
              <span className="dw-div-texto"><strong title={fila.barrio}>{fila.barrio}</strong><small>{fila.cuentas ? `${deltaCuentas(fila.cuentas)} cuentas` : "mismas cuentas"}</small></span>
              <Barra valor={fila.diferencia} escala={escalaBarrios} />
              <b className={`dw-figure ${fila.diferencia > 0 ? "is-sube" : "is-baja"}`} title={`${formatCurrency(fila.antes)} → ${formatCurrency(fila.ahora)}`}>{deltaMonto(fila.diferencia)}</b>
            </li>)}
          </ol> : <p className="dw-lotes-vacio">La mora de ningún barrio cambió entre los dos lotes.</p>}
          {comparacion.barrios.con_cambios > barrios.length ? <p className="dw-lotes-nota">{entero(comparacion.barrios.con_cambios)} barrios tuvieron algún cambio.</p> : null}
        </div>
      </div>

      <dl className="dw-lotes-cifras">
        <div><dt>cayeron en mora</dt><dd className="dw-figure">{entero(movimientos.cayeron_en_mora.cuentas)}</dd></div>
        <div><dt>cambiaron de servicio</dt><dd className="dw-figure">{entero(movimientos.cambio_servicio)}</dd></div>
        <div><dt>cambiaron de barrio</dt><dd className="dw-figure">{entero(movimientos.cambio_barrio)}</dd></div>
        <div><dt>quedaron igual</dt><dd className="dw-figure">{entero(movimientos.sin_cambio)}</dd></div>
      </dl>
    </>}
  </section>;
}

// Documento de la comparación con el mismo diseño de los informes del padrón.
export const imprimirComparacionLotes = async (data, modo = "imprimir") => {
  const { salidaPadron, celda, docCount, docMoney } = await import("../requests/padronDocumento");
  const { comparacion } = data;
  const m = comparacion.movimientos;
  const dif = comparacion.actual.total - comparacion.anterior.total;
  const conSigno = (valor) => `${signo(valor)}${docMoney(Math.abs(valor))}`;
  const filaBarrio = (fila) => [fila.barrio, docMoney(fila.antes), docMoney(fila.ahora), celda(conSigno(fila.diferencia), { negrita: true }), fila.cuentas ? deltaCuentas(fila.cuentas) : "0"];
  const columnasBarrio = [{ titulo: "Barrio" }, { titulo: "Lote anterior", alinear: "num" }, { titulo: "Este lote", alinear: "num" }, { titulo: "Diferencia", alinear: "num" }, { titulo: "Cuentas", alinear: "num" }];
  return salidaPadron({
    tipo: "Tablero · lotes del padrón",
    titulo: "Cambios entre lotes del padrón",
    subtitulo: `Lote ${data.actual.codigo}${fechaLote(data.actual) ? ` del ${fechaLote(data.actual)}` : ""} comparado con el lote ${data.anterior.codigo}${fechaLote(data.anterior) ? ` del ${fechaLote(data.anterior)}` : ""}.`,
    padronActualizado: data.actual.fecha_corte || "",
    cifras: [
      [docMoney(comparacion.actual.total), "mora de este lote", conSigno(dif)],
      [docCount(comparacion.actual.cuentas), "cuentas", deltaCuentas(comparacion.actual.cuentas - comparacion.anterior.cuentas)],
      [docCount(comparacion.actual.con_mora), "con mora", deltaCuentas(comparacion.actual.con_mora - comparacion.anterior.con_mora)],
      [docCount(comparacion.actual.mora_alta), "con mora alta", deltaCuentas(comparacion.actual.mora_alta - comparacion.anterior.mora_alta)]
    ],
    secciones: [
      {
        titulo: "De dónde sale la diferencia de mora",
        columnas: [{ titulo: "Movimiento" }, { titulo: "Cuentas", alinear: "num" }, { titulo: "Monto", alinear: "num" }],
        filas: [
          ["Mora del lote anterior", "", docMoney(comparacion.anterior.total)],
          ...PUENTE.map(([clave, direccion, etiqueta]) => [etiqueta, docCount(m[clave].cuentas), conSigno(direccion * m[clave].monto)])
        ],
        pie: ["Mora de este lote", "", docMoney(comparacion.actual.total)]
      },
      ...(comparacion.barrios.subieron.length ? [{ titulo: "Barrios donde subió la mora", columnas: columnasBarrio, filas: comparacion.barrios.subieron.map(filaBarrio) }] : []),
      ...(comparacion.barrios.bajaron.length ? [{ titulo: "Barrios donde bajó la mora", columnas: columnasBarrio, filas: comparacion.barrios.bajaron.map(filaBarrio) }] : [])
    ],
    nota: `${docCount(m.cayeron_en_mora.cuentas)} cuentas que estaban al día ahora tienen mora; ${docCount(m.cambio_servicio)} cambiaron de servicio y ${docCount(m.cambio_barrio)} de barrio. Las cuentas se reconocen por su número de abonado.`
  }, modo);
};
