import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import LatticeLoader from "../../../components/micro/LatticeLoader";
import ExclusionesPrint from "../print/ExclusionesPrint";
import { formatDate, formatLempiras, formatNumber } from "../utils/entregasFormatters";
import { llaveExclusion } from "../utils/cierreLoteUtils";
import { ESTADOS_ENTREGA, cuentaTexto, entregaTexto, filtrarExclusiones, totalesExclusiones } from "../utils/exclusiones";

// Exclusiones de entrega: claves catastrales y números de abonado cuya factura la
// entrega otro departamento de la empresa. Si un técnico anota uno como sobrante, el
// cierre le avisa. Administración agrega y quita; Gerencia solo consulta. Cada fila
// trae su cuenta del padrón, el saldo y qué pasó con su entrega en el ciclo.
const TIPOS = [
  { codigo: "CLAVE", etiqueta: "Claves catastrales", una: "clave", varias: "claves", ejemplo: "25-11-08-03\n18-21-04-01" },
  { codigo: "ABONADO", etiqueta: "Números de abonado", una: "abonado", varias: "abonados", ejemplo: "5838\n9417" }
];
const tipoDe = (codigo) => TIPOS.find((tipo) => tipo.codigo === codigo) || TIPOS[0];
const plural = (n, una, varias) => `${formatNumber(n)} ${n === 1 ? una : varias}`;

export default function ExclusionesEntrega({ api, config, notify, onCambio }) {
  const puedeEditar = Boolean(config.permissions.can_manage_exclusiones);
  const verSaldo = Boolean(config.permissions.can_view_saldo);
  const [lista, setLista] = useState(null);
  const [ciclo, setCiclo] = useState(null);
  const [error, setError] = useState("");
  const [tipo, setTipo] = useState("CLAVE");
  const [valores, setValores] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [quitando, setQuitando] = useState(null);
  const [buscar, setBuscar] = useState("");
  const [estado, setEstado] = useState("");
  const [hoja, setHoja] = useState(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const aplicar = (respuesta) => {
    setLista(respuesta.exclusiones || []);
    if (respuesta.ciclo) setCiclo(respuesta.ciclo);
    onCambio?.(respuesta.exclusiones || []);
  };

  useEffect(() => {
    let vigente = true;
    api.exclusiones()
      .then((respuesta) => {
        if (!vigente) return;
        setLista(respuesta.exclusiones || []);
        setCiclo(respuesta.ciclo || null);
      })
      .catch((problema) => { if (vigente) setError(problema.message); });
    return () => { vigente = false; };
  }, [api]);

  const actual = tipoDe(tipo);
  // Cuántas válidas trae lo pegado, para el botón ("Agregar 3 claves"); una clave
  // necesita al menos 6 cifras, como en el servidor.
  const escritos = useMemo(() => new Set(valores.split(/[\n,;\t ]+/)
    .map((valor) => llaveExclusion(tipo, valor))
    .filter((llave) => (tipo === "CLAVE" ? llave.length >= 6 && /[1-9]/.test(llave) : llave))).size, [valores, tipo]);

  const agregar = async (event) => {
    event.preventDefault();
    if (!escritos || guardando) return;
    setGuardando(true);
    setResultado(null);
    try {
      const respuesta = await api.agregarExclusiones({ tipo, valores, nota });
      aplicar(respuesta);
      setResultado({ ...respuesta, tipo });
      if (respuesta.agregadas) { setValores(""); setNota(""); }
    } catch (problema) {
      setResultado({ error: problema.message });
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (exclusion) => {
    setQuitando(exclusion.id);
    try {
      const respuesta = await api.quitarExclusion(exclusion.id);
      aplicar(respuesta);
      notify?.(`${exclusion.tipo === "CLAVE" ? "La clave" : "El abonado"} ${exclusion.valor} vuelve a la entrega normal.`);
    } catch (problema) {
      notify?.(problema.message || "No se pudo quitar la exclusión.");
    } finally {
      setQuitando(null);
    }
  };

  const visibles = useMemo(() => filtrarExclusiones(lista || [], { buscar, estado }), [buscar, estado, lista]);
  const totales = useMemo(() => totalesExclusiones(visibles), [visibles]);
  const cuentas = useMemo(() => ({
    claves: (lista || []).filter((item) => item.tipo === "CLAVE").length,
    abonados: (lista || []).filter((item) => item.tipo === "ABONADO").length
  }), [lista]);
  const entregadas = totales.por_estado.ENTREGADA + totales.por_estado.REENTREGADA;
  const sinLote = totales.por_estado.SIN_LOTE + totales.por_estado.LOTE_ABIERTO + totales.por_estado.SIN_BARRIO;

  // Lo que se imprime o va al PDF: lo que se ve, con sus filtros en palabras.
  const armarHoja = () => ({
    ciclo,
    verSaldo,
    lista: visibles,
    totales,
    generadoEn: new Date().toISOString(),
    filtros: [
      estado ? { rotulo: "Este ciclo", valor: ESTADOS_ENTREGA.find((item) => item.codigo === estado)?.etiqueta || estado } : null,
      buscar.trim() ? { rotulo: "Búsqueda", valor: buscar.trim() } : null
    ].filter(Boolean)
  });
  const descargarPdf = async () => {
    setGenerandoPdf(true);
    try {
      const { descargarExclusionesPdf } = await import("../print/exclusionesPdf");
      await descargarExclusionesPdf(armarHoja());
    } catch (problema) {
      notify?.(problema.message || "No se pudo generar el PDF.");
    } finally {
      setGenerandoPdf(false);
    }
  };

  // La hoja espera en un portal fuera de la vista y se imprime cuando el logo está listo,
  // como la lista de Descartes.
  useEffect(() => {
    if (!hoja) return undefined;
    let vivo = true;
    const limpiarImpresion = () => {
      document.body.classList.remove("ent-imprimiendo-acta");
      if (vivo) setHoja(null);
    };
    const modoImpresion = window.matchMedia?.("print");
    const alSalir = (evento) => { if (!evento.matches) limpiarImpresion(); };
    const imagenes = [...document.querySelectorAll(".ent-acta-portal img")];
    Promise.all(imagenes.map((imagen) => imagen.decode?.().catch(() => {}))).then(() => {
      if (!vivo) return;
      document.body.classList.add("ent-imprimiendo-acta");
      window.addEventListener("afterprint", limpiarImpresion, { once: true });
      modoImpresion?.addEventListener?.("change", alSalir);
      window.print();
    });
    return () => {
      vivo = false;
      window.removeEventListener("afterprint", limpiarImpresion);
      modoImpresion?.removeEventListener?.("change", alSalir);
      document.body.classList.remove("ent-imprimiendo-acta");
    };
  }, [hoja]);

  return <section className="cl-inbox ent-operational-inbox ent-exclusiones">
    <div className="ent-exc-head">
      <h2>Exclusiones</h2>
      <p>Claves catastrales y abonados cuya factura entrega otro departamento de la empresa. Si un técnico anota uno como sobrante, el cierre le avisa: <q>Esta factura la entrega otro departamento de la empresa</q>.</p>
    </div>

    {puedeEditar ? <form className="ent-exc-form" onSubmit={agregar}>
      <div className="ent-exc-tipo" role="group" aria-label="Qué vas a excluir">
        {TIPOS.map((opcion) => <button key={opcion.codigo} type="button" aria-pressed={tipo === opcion.codigo} onClick={() => { setTipo(opcion.codigo); setResultado(null); }}>{opcion.etiqueta}</button>)}
      </div>
      <label className="cl-field">
        {actual.etiqueta}, una por línea
        <textarea rows={4} value={valores} onChange={(event) => setValores(event.target.value)} placeholder={actual.ejemplo} spellCheck={false} />
      </label>
      <label className="cl-field">
        Departamento o motivo (opcional)
        <input value={nota} maxLength={120} onChange={(event) => setNota(event.target.value)} placeholder="Ej.: Grandes clientes" />
      </label>
      <div className="ent-exc-enviar">
        <button type="submit" className="cl-primary" disabled={!escritos || guardando}>
          <Icon name="plus" />{guardando ? "Agregando…" : escritos ? `Agregar ${plural(escritos, actual.una, actual.varias)}` : "Agregar"}
        </button>
        {resultado ? <p className={`ent-exc-resultado${resultado.error ? " is-error" : ""}`} role="status">
          {resultado.error || [
            resultado.agregadas ? `${plural(resultado.agregadas, "agregada", "agregadas")}.` : "No se agregó nada nuevo.",
            resultado.repetidas ? `${plural(resultado.repetidas, "ya estaba", "ya estaban")} en la lista.` : "",
            resultado.invalidos?.length ? `No se reconoció: ${resultado.invalidos.slice(0, 5).join(", ")}${resultado.invalidos.length > 5 ? "…" : ""}.` : ""
          ].filter(Boolean).join(" ")}
        </p> : null}
      </div>
    </form> : <p className="ent-exc-solo-lectura">Solo administración edita esta lista.</p>}

    {error ? <p className="cl-alert" role="alert">{error}</p> : null}
    {!lista && !error ? <p className="cl-empty"><LatticeLoader label="Cargando exclusiones…" /></p> : null}

    {lista ? <section className="ent-exc-lista" aria-labelledby="ent-exc-lista-titulo">
      <div className="ent-exc-lista-head">
        <h3 id="ent-exc-lista-titulo">En la lista</h3>
        <span>{plural(cuentas.claves, "clave", "claves")} · {plural(cuentas.abonados, "abonado", "abonados")}{ciclo ? ` · ciclo desde el ${formatDate(ciclo.desde)}` : ""}</span>
        {lista.length ? <div className="ent-exc-salidas">
          <button type="button" className="cl-secondary" onClick={() => setHoja(armarHoja())} disabled={!visibles.length || Boolean(hoja)}><Icon name="print" />Imprimir</button>
          <button type="button" className="cl-secondary" onClick={descargarPdf} disabled={!visibles.length || generandoPdf}><Icon name="download" />{generandoPdf ? "Generando…" : "PDF"}</button>
        </div> : null}
      </div>

      {lista.length ? <>
        <dl className="ent-exc-cifras">
          <div className="is-entregada"><dt>Entregadas por técnico</dt><dd>{formatNumber(entregadas)}</dd></div>
          <div className="is-sobrante"><dt>Sin entregar</dt><dd>{formatNumber(totales.por_estado.SOBRANTE)}</dd></div>
          <div><dt>Sin lote en el ciclo</dt><dd>{formatNumber(sinLote)}</dd></div>
          {verSaldo ? <div className="is-saldo"><dt>Saldo</dt><dd>{formatLempiras(totales.saldo)}</dd><dd className="ent-exc-desglose">{formatLempiras(totales.capital)} capital + {formatLempiras(totales.mora)} mora</dd></div> : null}
        </dl>
        <p className="ent-exc-nota">Una factura entregada no deja registro propio: si el barrio tuvo un lote cerrado y la cuenta no quedó de sobrante, el técnico la contó como entregada.</p>
        <div className="ent-exc-filtros">
          <label className="ent-exc-buscar"><span className="sr-only">Buscar en la lista</span><input type="search" value={buscar} onChange={(event) => setBuscar(event.target.value)} placeholder="Buscar nombre, abonado, clave o técnico" /></label>
          <label className="ent-exc-estado"><span className="sr-only">Este ciclo</span>
            <select value={estado} onChange={(event) => setEstado(event.target.value)}>
              <option value="">Todas ({formatNumber(lista.length)})</option>
              {ESTADOS_ENTREGA.map((opcion) => <option key={opcion.codigo} value={opcion.codigo}>{opcion.etiqueta}</option>)}
            </select>
          </label>
        </div>
      </> : null}

      {visibles.length ? <table className={`ent-exc-tabla${verSaldo ? " con-saldo" : ""}`}>
        <thead><tr><th>Cuenta</th>{verSaldo ? <th className="is-num">Saldo</th> : null}<th>Este ciclo</th><th>Departamento o motivo</th><th>Agregado</th>{puedeEditar ? <th><span className="sr-only">Acciones</span></th> : null}</tr></thead>
        <tbody>
          {visibles.map((item) => {
            const cuenta = cuentaTexto(item);
            const entrega = entregaTexto(item);
            return <tr key={item.id}>
              <td className="ent-exc-cuenta">
                <span className="ent-exc-valor">{item.valor}</span> <span className="ent-exc-tipo-txt">{item.tipo === "CLAVE" ? "Clave" : "Abonado"}</span>
                <strong>{cuenta.nombre}</strong>
                {cuenta.linea ? <small>{cuenta.linea}</small> : null}
              </td>
              {verSaldo ? <td className="ent-exc-saldo">{item.saldo ? <>{formatLempiras(item.saldo.total)}<small>{formatLempiras(item.saldo.mora)} mora</small></> : <span className="ent-exc-vacio">—</span>}</td> : null}
              <td className="ent-exc-entrega">
                <span className={`ent-exc-estado-txt ${entrega.tono}`}>{entrega.etiqueta}</span>
                <small>{entrega.detalle}</small>
                {entrega.antes ? <small>{entrega.antes}</small> : null}
              </td>
              <td className="ent-exc-motivo">{item.nota || <span className="ent-exc-vacio">Otro departamento</span>}</td>
              <td className="ent-exc-quien">{formatDate(item.created_at)}{item.created_by_nombre ? ` · ${item.created_by_nombre}` : ""}</td>
              {puedeEditar ? <td className="ent-exc-accion"><button type="button" className="cl-quiet" onClick={() => quitar(item)} disabled={quitando === item.id}>{quitando === item.id ? "Quitando…" : "Quitar"}</button></td> : null}
            </tr>;
          })}
        </tbody>
      </table> : <p className="cl-empty">{lista.length ? "Nada coincide con la búsqueda." : "Todavía no hay claves ni abonados excluidos. Lo que agregues aquí le saldrá al técnico como aviso al anotarlo de sobrante."}</p>}
    </section> : null}

    {hoja ? createPortal(<div className="ent-acta-portal"><ExclusionesPrint hoja={hoja} /></div>, document.body) : null}
  </section>;
}
