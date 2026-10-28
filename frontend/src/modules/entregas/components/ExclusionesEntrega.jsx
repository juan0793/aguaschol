import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import LatticeLoader from "../../../components/micro/LatticeLoader";
import { formatDate, formatNumber } from "../utils/entregasFormatters";
import { llaveExclusion } from "../utils/cierreLoteUtils";

// Exclusiones de entrega: claves catastrales y números de abonado cuya factura la
// entrega otro departamento de la empresa. Si un técnico anota uno como sobrante, el
// cierre le avisa. Administración agrega y quita; Gerencia solo consulta.
const TIPOS = [
  { codigo: "CLAVE", etiqueta: "Claves catastrales", una: "clave", varias: "claves", ejemplo: "25-11-08-03\n18-21-04-01" },
  { codigo: "ABONADO", etiqueta: "Números de abonado", una: "abonado", varias: "abonados", ejemplo: "5838\n9417" }
];
const tipoDe = (codigo) => TIPOS.find((tipo) => tipo.codigo === codigo) || TIPOS[0];
const plural = (n, una, varias) => `${formatNumber(n)} ${n === 1 ? una : varias}`;
const normalizar = (texto) => String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export default function ExclusionesEntrega({ api, config, notify, onCambio }) {
  const puedeEditar = Boolean(config.permissions.can_manage_exclusiones);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [tipo, setTipo] = useState("CLAVE");
  const [valores, setValores] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [quitando, setQuitando] = useState(null);
  const [buscar, setBuscar] = useState("");

  const aplicar = (exclusiones) => {
    setLista(exclusiones);
    onCambio?.(exclusiones);
  };

  useEffect(() => {
    let vigente = true;
    api.exclusiones()
      .then((respuesta) => { if (vigente) setLista(respuesta.exclusiones || []); })
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
      aplicar(respuesta.exclusiones || []);
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
      aplicar(respuesta.exclusiones || []);
      notify?.(`${exclusion.tipo === "CLAVE" ? "La clave" : "El abonado"} ${exclusion.valor} vuelve a la entrega normal.`);
    } catch (problema) {
      notify?.(problema.message || "No se pudo quitar la exclusión.");
    } finally {
      setQuitando(null);
    }
  };

  const visibles = useMemo(() => {
    const texto = normalizar(buscar);
    const cifras = texto.replace(/\D/g, "");
    if (!texto) return lista || [];
    return (lista || []).filter((item) => normalizar(item.valor).includes(texto) || normalizar(item.nota).includes(texto) || (cifras.length >= 3 && item.llave.includes(cifras)));
  }, [buscar, lista]);
  const cuentas = useMemo(() => ({
    claves: (lista || []).filter((item) => item.tipo === "CLAVE").length,
    abonados: (lista || []).filter((item) => item.tipo === "ABONADO").length
  }), [lista]);

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
        <span>{plural(cuentas.claves, "clave", "claves")} · {plural(cuentas.abonados, "abonado", "abonados")}</span>
        {lista.length > 8 ? <label className="ent-exc-buscar"><span className="sr-only">Buscar en la lista</span><input type="search" value={buscar} onChange={(event) => setBuscar(event.target.value)} placeholder="Buscar clave, abonado o nota" /></label> : null}
      </div>
      {visibles.length ? <table className="ent-exc-tabla">
        <thead><tr><th>Tipo</th><th>Clave o abonado</th><th>Departamento o motivo</th><th>Agregado</th>{puedeEditar ? <th><span className="sr-only">Acciones</span></th> : null}</tr></thead>
        <tbody>
          {visibles.map((item) => <tr key={item.id}>
            <td>{item.tipo === "CLAVE" ? "Clave" : "Abonado"}</td>
            <td className="ent-exc-valor">{item.valor}</td>
            <td>{item.nota || <span className="ent-exc-vacio">Otro departamento</span>}</td>
            <td className="ent-exc-quien">{formatDate(item.created_at)}{item.created_by_nombre ? ` · ${item.created_by_nombre}` : ""}</td>
            {puedeEditar ? <td className="ent-exc-accion"><button type="button" className="cl-quiet" onClick={() => quitar(item)} disabled={quitando === item.id}>{quitando === item.id ? "Quitando…" : "Quitar"}</button></td> : null}
          </tr>)}
        </tbody>
      </table> : <p className="cl-empty">{lista.length ? "Nada coincide con la búsqueda." : "Todavía no hay claves ni abonados excluidos. Lo que agregues aquí le saldrá al técnico como aviso al anotarlo de sobrante."}</p>}
    </section> : null}
  </section>;
}
