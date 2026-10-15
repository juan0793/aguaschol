import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { DIAS_ATRASO, documentos, fechaCorta, inicial, leerJson, nombrePropio, origenTexto, textoError } from "./reclamosFormato";

const MAX_CANTIDAD = 24;

// "¿Quién entregó esta factura?": con la clave o el abonado dice qué técnico entregó ese
// barrio en el ciclo. La oficina, además, registra el reclamo desde aquí mismo.
export default function BuscarEntrega({ apiFetch, puedeRegistrar, motivos, onRegistrado, onVerReclamo }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState({ cargando: false, error: "", resultado: null });
  const [elegido, setElegido] = useState(0);
  const [formAbierto, setFormAbierto] = useState(false);
  const inputRef = useRef(null);
  const ultimaConsulta = useRef("");

  const buscar = async (consulta = texto, tipo = "") => {
    const limpia = consulta.trim();
    if (!limpia) { inputRef.current?.focus(); return; }
    ultimaConsulta.current = limpia;
    setEstado((actual) => ({ ...actual, cargando: true, error: "" }));
    try {
      const params = new URLSearchParams({ q: limpia });
      if (tipo) params.set("tipo", tipo);
      const resultado = await leerJson(await apiFetch(`/entregas/reclamos/buscar?${params}`), "No se pudo buscar la clave.");
      if (ultimaConsulta.current !== limpia) return;
      setEstado({ cargando: false, error: "", resultado });
      if (!tipo) { setElegido(0); setFormAbierto(false); }
    } catch (error) {
      setEstado({ cargando: false, error: textoError(error, "Sin conexión: la consulta necesita señal."), resultado: tipo ? estado.resultado : null });
    }
  };

  const limpiar = () => {
    setTexto(""); setEstado({ cargando: false, error: "", resultado: null }); setFormAbierto(false);
    inputRef.current?.focus();
  };

  const resultado = estado.resultado;
  const coincidencia = resultado?.coincidencias?.[elegido] || null;

  return <section className="rc-buscar" aria-labelledby="rc-buscar-titulo">
    <h2 id="rc-buscar-titulo">¿Quién entregó esta factura?</h2>
    <form className="rc-buscar-form" role="search" onSubmit={(event) => { event.preventDefault(); buscar(); }}>
      <label className="rc-sr" htmlFor="rc-buscar-input">Clave catastral o número de abonado</label>
      <div className="rc-buscar-campo">
        <Icon name="search" />
        <input
          id="rc-buscar-input"
          ref={inputRef}
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Clave o abonado"
          inputMode="text"
          autoComplete="off"
          spellCheck="false"
        />
        {texto ? <button type="button" className="rc-buscar-limpiar" onClick={limpiar} aria-label="Borrar búsqueda"><Icon name="close" /></button> : null}
      </div>
      <button type="submit" className="rc-boton is-primario" disabled={estado.cargando}>{estado.cargando ? "Buscando…" : "Buscar"}</button>
    </form>
    <p className="rc-ayuda">Ej.: <span>05-12-003-01</span> o el abonado <span>10234</span>. Sale quien entregó el barrio en este ciclo de facturación.</p>

    {estado.error ? <p className="rc-aviso is-error" role="alert">{estado.error}</p> : null}

    <div aria-live="polite">
      {resultado && !resultado.coincidencias.length ? <div className="rc-sin-hallazgo">
        <strong>No aparece en el padrón</strong>
        <span>Revisa la clave o el número de abonado. Si es una clave, escríbela con guiones: 05-12-003-01.</span>
      </div> : null}

      {resultado?.coincidencias.length > 1 ? <div className="rc-opciones" role="group" aria-label="Coincidencias">
        <span>{resultado.total > resultado.coincidencias.length ? `${resultado.total} coincidencias; se muestran ${resultado.coincidencias.length}.` : `${resultado.coincidencias.length} coincidencias. Elige el inmueble:`}</span>
        {resultado.coincidencias.map((item, indice) => <button type="button" key={`${item.clave_catastral}-${item.numero_abonado}`} className={indice === elegido ? "is-activo" : ""} aria-pressed={indice === elegido} onClick={() => { setElegido(indice); setFormAbierto(false); }}>
          <strong>{item.clave_catastral || "Sin clave"}</strong>{item.numero_abonado ? ` · ${item.numero_abonado}` : ""}
        </button>)}
      </div> : null}

      {coincidencia ? <Hallazgo
        item={coincidencia}
        puedeRegistrar={puedeRegistrar}
        formAbierto={formAbierto}
        onAbrirForm={() => setFormAbierto(true)}
        onVerReclamo={onVerReclamo}
      /> : null}

      {coincidencia && formAbierto ? <FormReclamo
        apiFetch={apiFetch}
        item={coincidencia}
        motivos={motivos}
        onTipo={(tipo) => buscar(ultimaConsulta.current, tipo)}
        onCancelar={() => setFormAbierto(false)}
        onGuardado={(reclamo) => { setFormAbierto(false); setEstado({ cargando: false, error: "", resultado: null }); setTexto(""); onRegistrado(reclamo); }}
      /> : null}
    </div>
  </section>;
}

function Hallazgo({ item, puedeRegistrar, formAbierto, onAbrirForm, onVerReclamo }) {
  const { entrega } = item;
  const tecnico = entrega.responsable;
  const repartoDistinto = entrega.origen === "LOTE" && entrega.reparto && entrega.reparto.id !== tecnico?.id;
  return <article className="rc-hallazgo">
    <div className="rc-hallazgo-abonado">
      <p className="rc-hallazgo-nombre">{item.abonado_nombre ? nombrePropio(item.abonado_nombre) : item.sin_padron ? "Clave fuera del padrón" : "Sin nombre en el padrón"}</p>
      <dl>
        <div><dt>Clave</dt><dd>{item.clave_catastral || "—"}</dd></div>
        <div><dt>Abonado</dt><dd>{item.numero_abonado || "—"}</dd></div>
        <div><dt>Barrio</dt><dd>{entrega.barrio_nombre || nombrePropio(item.barrio_colonia) || "—"}</dd></div>
      </dl>
    </div>

    <div className={`rc-hallazgo-tecnico${tecnico ? "" : " is-vacio"}`}>
      <span className="rc-avatar" aria-hidden="true">{tecnico ? inicial(tecnico.nombre) : "?"}</span>
      <div>
        <p className="rc-hallazgo-rol">{entrega.origen === "LOTE" ? "La entregó" : entrega.origen === "REPARTO" ? "Le toca entregarla" : "Responsable"}</p>
        <p className="rc-hallazgo-quien">{tecnico ? tecnico.nombre : "Sin técnico asignado"}</p>
        <p className="rc-hallazgo-origen">{origenTexto(entrega)}</p>
      </div>
    </div>

    {(item.sobrante || item.reclamos_abiertos.length || repartoDistinto) ? <ul className="rc-hallazgo-notas">
      {item.sobrante ? <li className="is-ocre"><Icon name="warning" />Quedó como sobrante en el lote #{item.sobrante.lote_id} del {fechaCorta(item.sobrante.fecha)}: {String(item.sobrante.motivo).toLowerCase()}.</li> : null}
      {item.reclamos_abiertos.length ? <li className="is-azul"><Icon name="reclamos" />
        {item.reclamos_abiertos.length === 1 ? "Ya tiene un reclamo abierto." : `Ya tiene ${item.reclamos_abiertos.length} reclamos abiertos.`}
        <button type="button" className="rc-enlace" onClick={() => onVerReclamo(item.clave_catastral || item.numero_abonado)}>Ver</button>
      </li> : null}
      {repartoDistinto ? <li><Icon name="users" />En el reparto el barrio es de {entrega.reparto.nombre}.</li> : null}
    </ul> : null}

    {puedeRegistrar && !formAbierto ? <div className="rc-hallazgo-accion">
      <button type="button" className="rc-boton is-primario" onClick={onAbrirForm}><Icon name="plus" />Registrar reclamo</button>
    </div> : null}
  </article>;
}

function FormReclamo({ apiFetch, item, motivos, onTipo, onCancelar, onGuardado }) {
  const id = useId();
  const [tipo, setTipo] = useState("FACTURA");
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [personal, setPersonal] = useState([]);
  const sugerido = item.entrega.responsable?.id ? String(item.entrega.responsable.id) : "";
  const [responsable, setResponsable] = useState(sugerido);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const primerMotivo = useRef(null);

  useEffect(() => { primerMotivo.current?.focus(); }, []);
  useEffect(() => { setResponsable(sugerido); }, [sugerido]);
  useEffect(() => {
    let vivo = true;
    apiFetch("/entregas/personal?activo=1")
      .then((response) => leerJson(response, "No se pudo cargar el personal de campo."))
      .then((lista) => { if (vivo) setPersonal(Array.isArray(lista) ? lista : []); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [apiFetch]);

  const cambiarTipo = (valor) => { setTipo(valor); onTipo(valor); };
  const faltaDetalle = motivo === "OTRO" && detalle.trim().length < 5;

  const guardar = async (event) => {
    event.preventDefault();
    if (!motivo) { setFaltaMotivo(true); primerMotivo.current?.focus(); return; }
    if (faltaDetalle) { setError("Con «Otro», cuenta qué pasó (mínimo 5 caracteres)."); return; }
    setEnviando(true); setError("");
    try {
      const reclamo = await leerJson(await apiFetch("/entregas/reclamos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clave_catastral: item.clave_catastral,
          numero_abonado: item.numero_abonado,
          tipo_documento: tipo,
          cantidad,
          motivo,
          detalle,
          responsable_id: responsable || null
        })
      }), "No se pudo registrar el reclamo.");
      onGuardado(reclamo);
    } catch (reason) {
      setError(`${textoError(reason, "Sin conexión: el reclamo no se registró.")} Lo escrito sigue aquí; revisa la lista antes de volver a enviarlo.`);
    } finally {
      setEnviando(false);
    }
  };

  const otroTecnico = responsable && responsable !== sugerido;
  return <form className="rc-form" onSubmit={guardar} aria-labelledby={`${id}-titulo`}>
    <h3 id={`${id}-titulo`}>Nuevo reclamo</h3>

    <fieldset className={`rc-campo${faltaMotivo ? " is-error" : ""}`} aria-describedby={faltaMotivo ? `${id}-motivo-error` : undefined}>
      <legend>¿Qué reclama el abonado?</legend>
      <div className="rc-chips">
        {motivos.map((opcion, indice) => <label key={opcion.codigo} className={motivo === opcion.codigo ? "is-activo" : ""}>
          <input ref={indice === 0 ? primerMotivo : undefined} type="radio" name={`${id}-motivo`} value={opcion.codigo} checked={motivo === opcion.codigo} onChange={() => { setMotivo(opcion.codigo); setFaltaMotivo(false); setError(""); }} />
          {opcion.etiqueta}
        </label>)}
      </div>
      {faltaMotivo ? <p className="rc-error-campo" id={`${id}-motivo-error`} role="alert">Elige qué reclama el abonado.</p> : null}
    </fieldset>

    <div className="rc-form-fila">
      <fieldset className="rc-campo">
        <legend>Documento</legend>
        <div className="rc-segmento">
          {[["FACTURA", "Factura"], ["NOTA_COBRO", "Nota de cobro"]].map(([valor, label]) => <label key={valor} className={tipo === valor ? "is-activo" : ""}>
            <input type="radio" name={`${id}-tipo`} value={valor} checked={tipo === valor} onChange={() => cambiarTipo(valor)} />{label}
          </label>)}
        </div>
      </fieldset>
      <div className="rc-campo">
        <span className="rc-label" id={`${id}-cantidad`}>Cuántas</span>
        <div className="rc-contador" role="group" aria-labelledby={`${id}-cantidad`}>
          <button type="button" onClick={() => setCantidad((n) => Math.max(1, n - 1))} disabled={cantidad <= 1} aria-label="Una menos"><Icon name="minus" /></button>
          <output aria-live="polite">{documentos(cantidad, tipo)}</output>
          <button type="button" onClick={() => setCantidad((n) => Math.min(MAX_CANTIDAD, n + 1))} disabled={cantidad >= MAX_CANTIDAD} aria-label="Una más"><Icon name="plus" /></button>
        </div>
      </div>
    </div>

    <label className="rc-campo">
      <span className="rc-label">Lo que dijo el abonado{motivo === "OTRO" ? "" : " (opcional)"}</span>
      <textarea rows={3} maxLength={1000} value={detalle} onChange={(event) => setDetalle(event.target.value)} placeholder="Ej.: Dice que en octubre no le llegó y que la casa tiene portón verde." aria-invalid={faltaDetalle && Boolean(error)} />
    </label>

    <label className="rc-campo">
      <span className="rc-label">Técnico que responde</span>
      <select value={responsable} onChange={(event) => setResponsable(event.target.value)}>
        {!sugerido ? <option value="">Sin técnico</option> : null}
        {item.entrega.responsable && !personal.some((persona) => String(persona.id) === sugerido)
          ? <option value={sugerido}>{item.entrega.responsable.nombre}</option> : null}
        {personal.filter((persona) => persona.activo).map((persona) => <option key={persona.id} value={String(persona.id)}>
          {persona.nombre_completo}{String(persona.id) === sugerido ? " (el que entregó)" : ""}
        </option>)}
      </select>
      {otroTecnico ? <span className="rc-nota">Quedará como asignado por la oficina, no por el lote.</span> : null}
    </label>

    {error ? <p className="rc-aviso is-error" role="alert">{error}</p> : null}

    <div className="rc-form-acciones">
      <button type="button" className="rc-boton" onClick={onCancelar} disabled={enviando}>Cancelar</button>
      <button type="submit" className="rc-boton is-primario" disabled={enviando}>{enviando ? "Registrando…" : "Registrar reclamo"}</button>
    </div>
    <p className="rc-nota">Lo verán todos los técnicos en su pantalla de inicio. Si pasan más de {DIAS_ATRASO} días sin respuesta, se marca en rojo.</p>
  </form>;
}
