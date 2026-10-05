import { useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import SpringCheck from "../../../components/micro/SpringCheck";
import { printDocument } from "../../../utils/printDocument";
import AsignarTecnicosDialog from "./AsignarTecnicosDialog";
import { BANCO_PRINT_STYLES, buildBancoListado, dictamenParaImprimir } from "../services/bancoPrint";
import { CountUp, DonutChart, MeterLegend, StackedBars } from "./ClCharts";
import BarrioPicker from "./BarrioPicker";

const DICTAMENES = [
  ["clandestino", "Clandestino", "No aparece en Aguas", "warning"],
  ["sin_determinar", "Sin determinar", "Sin clave para verificar", "search"],
  ["registrado", "Registrado en Aguas", "No es clandestino", "checkCircle"]
];
const DICTAMEN_LABELS = Object.fromEntries(DICTAMENES.map(([key, label]) => [key, label]));
const DICTAMEN_ICONS = Object.fromEntries(DICTAMENES.map(([key, , , icon]) => [key, icon]));
// Colores de estado (reservados): rojo crítico, ámbar advertencia, gris neutro, verde bien.
const DICTAMEN_COLORS = { clandestino: "#c2414b", sin_determinar: "#8fa3b8", registrado: "#1f9463" };
const ESTADOS = [["pendiente", "Por revisar"], ["enviado", "Enviados a ficha"], ["descartado", "Descartados"], ["", "Todos"]];
const ESTADO_LABELS = Object.fromEntries(ESTADOS.map(([key, label]) => [key, label]));
const BANCO_FLOW = [["pendiente", "Por revisar", "inbox"], ["enviado", "Enviados a ficha", "send"], ["descartado", "Descartados", "archive"]];
const SERVICES = [["agua", "Agua potable", "water"], ["alcantarillado", "Alcantarillado", "sewer"], ["desechos", "Desechos sólidos", "waste"]];

// Motivos frecuentes del trabajo de campo; "Otro" pide escribirlo. El detalle se agrega al motivo.
const MOTIVOS_DESCARTE = ["Ya tiene servicio en Aguas", "Clave catastral equivocada", "Punto duplicado", "Lote baldío o sin construcción", "No tiene conexión de agua", "Otro"];
const fechaCorta = (value) => (value ? new Date(value).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" }) : "");

const mapUrl = (item) => `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;

function DescartePanel({ busy, onCancel, onConfirm }) {
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const esOtro = motivo === "Otro";
  const texto = esOtro ? detalle.trim() : [motivo, detalle.trim()].filter(Boolean).join(": ");
  const listo = Boolean(motivo) && Boolean(texto);
  return <form className="cl-bcard-discard" aria-label="Motivo del descarte" onSubmit={(event) => { event.preventDefault(); if (listo) onConfirm(texto); }} onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }}>
    <header><Icon name="archive" /><strong>¿Por qué se descarta?</strong></header>
    <div className="cl-bcard-reasons" role="group" aria-label="Motivos frecuentes">
      {MOTIVOS_DESCARTE.map((item, index) => <button type="button" key={item} autoFocus={index === 0} aria-pressed={motivo === item} className={motivo === item ? "is-active" : ""} onClick={() => setMotivo(item)}>{item}</button>)}
    </div>
    {motivo ? <textarea autoFocus={esOtro} rows={2} maxLength={200} aria-label={esOtro ? "Escribe el motivo" : "Detalle del descarte"} value={detalle} onChange={(event) => setDetalle(event.target.value)} placeholder={esOtro ? "Escribe el motivo del descarte" : "Detalle (opcional), ej. ya se levantó como #9"} /> : <p className="cl-bcard-discard-hint">Elige un motivo; queda guardado y se puede devolver al banco si fue un error.</p>}
    <footer>
      <button type="button" className="cl-bcard-go is-soft" onClick={onCancel}>Cancelar</button>
      <button type="submit" className="cl-bcard-go is-danger" disabled={busy || !listo}><Icon name="archive" />{busy ? "Descartando…" : "Descartar"}</button>
    </footer>
  </form>;
}

// Una fila por candidato: clave, padrones, señales de campo y la acción. Lo que
// necesita lectura (comentario, avisos, motivo de descarte, formularios) se abre
// debajo de la fila, así la lista se escanea en una pasada.
function CandidatoFila({ item, permissions, userId, busy, selectable, selected, showBarrio, showTecnico, onToggle, onSend, onDiscard, onRestore, onOpenFicha }) {
  const [clave, setClave] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const claveInput = useRef(null);
  const pendiente = item.estado === "pendiente";
  const descartado = item.estado === "descartado";
  // La validadora de campo solo trabaja lo que le asignaron.
  const canWork = permissions.can_process_banco || (permissions.can_work_assigned_banco && item.asignado_a != null && Number(item.asignado_a) === Number(userId));
  const canProcess = pendiente && canWork;
  // Quien puede descartar también puede deshacerlo, por si fue un error.
  const canRestore = descartado && canWork;
  const canSend = canProcess && item.dictamen !== "registrado";
  const needsClave = canSend && !item.clave_catastral;
  // Solo "registrado" está en Aguas; si no, la cuenta guardada es de otra unidad del mismo lote.
  const enAguas = item.dictamen === "registrado" && (item.aguas_clave || item.aguas_abonado);
  const loteEnAguas = !enAguas && item.aguas_clave;
  const mio = item.asignado_a != null && Number(item.asignado_a) === Number(userId);
  const desmembracion = item.dictamen === "sin_determinar" && /^Posible desmembración/.test(item.motivo_dictamen || "");
  const avisos = [item.nota_revision, desmembracion ? item.motivo_dictamen : ""].filter(Boolean);
  const abierta = abierto || discarding;
  const id = item.clave_catastral || `punto ${item.origen_ref}`;
  const enviar = () => {
    // Sin clave no se puede enviar: se abre la fila con el campo listo para escribirla.
    if (needsClave && !clave.trim()) { setAbierto(true); requestAnimationFrame(() => claveInput.current?.focus()); return; }
    onSend(item, clave);
  };
  return <article className={`cl-brow is-${item.dictamen} ${descartado ? "is-descartado" : ""} ${abierta ? "is-open" : ""} ${busy ? "is-busy" : ""} ${selected ? "is-selected" : ""}`.trim()}>
    <div className="cl-brow-main">
      <span className="cl-brow-check">{selectable ? <SpringCheck checked={selected} onChange={() => onToggle(item)} ariaLabel={`Seleccionar ${id}`} /> : null}</span>
      <span className="cl-brow-dict" title={`${DICTAMEN_LABELS[item.dictamen] || item.dictamen}${item.motivo_dictamen ? `: ${item.motivo_dictamen}` : ""}`}><Icon name={DICTAMEN_ICONS[item.dictamen] || "search"} /><span className="cl-sr">{DICTAMEN_LABELS[item.dictamen] || item.dictamen}</span></span>
      <div className="cl-brow-id">
        <button type="button" className="cl-brow-clave" aria-expanded={abierta} onClick={() => setAbierto((value) => !value)} title="Ver detalle">{item.clave_catastral || <em>Sin clave</em>}</button>
        <small>{[showBarrio ? item.barrio_colonia || "Sin barrio" : "", `#${item.origen_ref}`, item.clave_origen === "plano" ? "del plano" : ""].filter(Boolean).join(" · ")}</small>
      </div>
      <p className={`cl-brow-cell is-alcaldia ${item.alcaldia_propietario ? "is-found" : ""}`.trim()} title={item.alcaldia_propietario ? [item.alcaldia_propietario, item.alcaldia_clave, item.alcaldia_caserio].filter(Boolean).join(" · ") : "No aparece en Alcaldía"}>
        <span className="cl-brow-label">Alcaldía</span>{item.alcaldia_propietario || "No aparece"}
      </p>
      <p className={`cl-brow-cell is-aguas ${enAguas ? "is-found" : ""} ${loteEnAguas ? "is-lote" : ""}`.trim()} title={enAguas ? [item.aguas_clave, item.aguas_abonado && `abonado ${item.aguas_abonado}`].filter(Boolean).join(" · ") : loteEnAguas ? `Esta unidad no aparece en Aguas. Otra unidad del lote sí: ${[item.aguas_clave, item.aguas_inquilino].filter(Boolean).join(" · ")}` : "No aparece en Aguas"}>
        <span className="cl-brow-label">Aguas</span>{enAguas ? item.aguas_inquilino || `Abonado ${item.aguas_abonado || item.aguas_clave}` : loteEnAguas ? `Lote sí: ${item.aguas_clave}` : "No aparece"}
      </p>
      <div className="cl-brow-campo" aria-label="Lo observado en campo">
        {SERVICES.map(([key, label, icon]) => <span key={key} className={item[key] ? "is-on" : ""} title={`${label}: ${item[key] ? "sí" : "no"}`}><Icon name={icon} /></span>)}
        {item.lote_baldio ? <span className="cl-brow-flag is-text" title="Lote baldío">Baldío</span> : null}
        {item.comentario_campo ? <span className="cl-brow-flag" title={`Comentario de campo: ${item.comentario_campo}`}><Icon name="notes" /></span> : null}
        {avisos.length ? <span className="cl-brow-flag is-warn" title={avisos.join(" · ")}><Icon name="warning" /></span> : null}
        {item.duplicados ? <span className="cl-brow-flag is-text" title={`${item.duplicados} ${item.duplicados === 1 ? "punto de campo más" : "puntos de campo más"} con esta misma clave`}>+{item.duplicados}</span> : null}
      </div>
      {showTecnico ? <p className={`cl-brow-tec ${mio ? "is-mine" : ""}`.trim()} title={item.asignado_nombre ? [`Asignado a ${item.asignado_nombre}`, fechaCorta(item.asignado_at)].filter(Boolean).join(" · ") : "Sin asignar"}>{item.asignado_a == null ? <span className="cl-brow-none">Sin asignar</span> : mio ? "Tú" : item.asignado_nombre || "Técnico"}</p> : null}
      <div className="cl-brow-actions">
        {canProcess && !discarding ? <button type="button" className="cl-bcard-icon" title="Descartar candidato" aria-label={`Descartar ${id}`} disabled={busy} onClick={() => setDiscarding(true)}><Icon name="archive" /></button> : null}
        {canSend && !discarding ? <button type="button" className="cl-bcard-go is-soft" disabled={busy} onClick={enviar} aria-label={`Enviar ${id} a ficha`}><Icon name="send" /><span className="cl-brow-go-text">{busy ? "Verificando…" : "Enviar a ficha"}</span></button> : null}
        {item.estado === "enviado" && item.inmueble_id ? <button type="button" className="cl-bcard-go is-soft" onClick={() => onOpenFicha(item)} aria-label={`Abrir la ficha de ${id}`}><Icon name="eye" /><span className="cl-brow-go-text">Abrir ficha</span></button> : null}
        {canRestore ? <button type="button" className="cl-bcard-go is-soft" disabled={busy} title="Deshacer el descarte: vuelve a Por revisar" aria-label={`Devolver ${id} al banco`} onClick={() => onRestore(item)}><Icon name="refresh" /><span className="cl-brow-go-text">Devolver</span></button> : null}
        <button type="button" className="cl-brow-more" aria-expanded={abierta} aria-label={abierta ? `Cerrar detalle de ${id}` : `Ver detalle de ${id}`} onClick={() => { if (discarding) { setDiscarding(false); setAbierto(false); } else setAbierto((value) => !value); }}><Icon name="chevronDown" /></button>
      </div>
    </div>
    {descartado ? <p className="cl-brow-line"><Icon name="archive" /><span><strong>Descartado:</strong> {item.motivo_descarte || "Sin motivo registrado"}</span>{item.procesado_por_nombre || item.procesado_at ? <small>{[item.procesado_por_nombre && `Por ${item.procesado_por_nombre}`, fechaCorta(item.procesado_at)].filter(Boolean).join(" · ")}</small> : null}</p> : null}
    {abierta ? <div className="cl-brow-detail">
      <dl>
        <div><dt>Dictamen</dt><dd>{DICTAMEN_LABELS[item.dictamen] || item.dictamen}{item.motivo_dictamen && !desmembracion ? <small>{item.motivo_dictamen}</small> : null}</dd></div>
        <div><dt>Alcaldía</dt><dd>{item.alcaldia_propietario || "No aparece"}{item.alcaldia_propietario && (item.alcaldia_clave || item.alcaldia_caserio) ? <small>{[item.alcaldia_clave, item.alcaldia_caserio].filter(Boolean).join(" · ")}</small> : null}</dd></div>
        <div><dt>Aguas</dt><dd>{enAguas ? item.aguas_inquilino || `Abonado ${item.aguas_abonado || item.aguas_clave}` : "No aparece"}{enAguas || loteEnAguas ? <small>{loteEnAguas ? `Esta unidad no; otra del lote sí: ${[item.aguas_clave, item.aguas_inquilino].filter(Boolean).join(" · ")}` : [item.aguas_clave, item.aguas_abonado && `abonado ${item.aguas_abonado}`].filter(Boolean).join(" · ")}</small> : null}</dd></div>
        <div><dt>Asignado</dt><dd>{item.asignado_a == null ? "Sin asignar" : mio ? "A ti" : item.asignado_nombre || "Técnico"}{item.asignado_at ? <small>Desde {fechaCorta(item.asignado_at)}</small> : null}</dd></div>
        <div><dt>Ubicación</dt><dd>{item.latitude != null ? <a href={mapUrl(item)} target="_blank" rel="noreferrer"><Icon name="map" />Ver en el mapa</a> : "Sin coordenadas"}<small>Punto #{item.origen_ref} del levantamiento</small></dd></div>
      </dl>
      {item.comentario_campo ? <p className="cl-brow-note"><Icon name="notes" /><span><strong>Comentario de campo:</strong> {item.comentario_campo}</span></p> : null}
      {avisos.map((aviso) => <p key={aviso} className="cl-brow-note is-warn"><Icon name="warning" /><span>{aviso}</span></p>)}
      {item.duplicados ? <p className="cl-brow-note" title="Las copias quedaron en Descartados con el motivo «Duplicado»; sus comentarios de campo pasan a la ficha."><Icon name="records" /><span>{item.duplicados === 1 ? "+1 punto de campo con esta misma clave" : `+${item.duplicados} puntos de campo con esta misma clave`}; se trabaja aquí una sola vez.</span></p> : null}
      {discarding ? <DescartePanel busy={busy} onCancel={() => setDiscarding(false)} onConfirm={(motivo) => onDiscard(item, motivo)} /> : needsClave ? <form className="cl-bcard-form" onSubmit={(event) => { event.preventDefault(); if (clave.trim()) onSend(item, clave); }}>
        <input ref={claveInput} aria-label="Clave catastral" value={clave} onChange={(event) => setClave(event.target.value)} placeholder="Escribe la clave, ej. 89-13-15" />
        <button type="submit" className="cl-bcard-go" disabled={busy || !clave.trim()}><Icon name="send" />{busy ? "Verificando…" : "Enviar a ficha"}</button>
      </form> : null}
    </div> : null}
  </article>;
}

// Carga del equipo: qué parte de lo ya repartido tiene pendiente cada técnico.
// Las barras comparten escala (la del más cargado) y la marca fina es el reparto
// parejo, para ver de un vistazo quién va sobrado y quién puede recibir más.
function CargaEquipo({ asignaciones, sinAsignar, canAssign, userId, filtro, onVerTecnico, onSinAsignar }) {
  const repartido = asignaciones.reduce((sum, item) => sum + item.pendientes, 0);
  const maximo = Math.max(1, ...asignaciones.map((item) => item.pendientes));
  const parejo = asignaciones.length ? repartido / asignaciones.length : 0;
  const filas = asignaciones.filter((item) => canAssign || Number(item.id) === Number(userId));
  if (!filas.length && !canAssign) return null;
  const porRepartir = sinAsignar + repartido ? Math.round((sinAsignar * 100) / (sinAsignar + repartido)) : 0;
  const mitad = Math.ceil(filas.length / 2);
  const columnas = filas.length > 4 ? [filas.slice(0, mitad), filas.slice(mitad)] : [filas];
  return <section className="cl-carga" aria-labelledby="cl-carga-title">
    <header>
      <div>
        <h3 id="cl-carga-title">{canAssign ? "Carga del equipo" : "Tu carga"}</h3>
        <p>{repartido ? <>Qué parte de los <strong>{repartido}</strong> pendientes ya repartidos tiene cada técnico. La marca fina es el reparto parejo, {Math.round(parejo)} por técnico.</> : "Todavía no hay pendientes repartidos."}</p>
      </div>
      {canAssign ? <button type="button" aria-pressed={filtro === "none"} className={`cl-carga-backlog ${filtro === "none" ? "is-active" : ""} ${sinAsignar ? "" : "is-done"}`.trim()} onClick={onSinAsignar}>
        <strong>{sinAsignar}</strong>
        <span>{sinAsignar ? <>sin asignar<small>{porRepartir}% de lo pendiente</small></> : "Todo está repartido"}</span>
        {sinAsignar ? <em>{filtro === "none" ? "Ver todos" : "Ver para repartir"}<Icon name="arrowRight" /></em> : null}
      </button> : null}
    </header>
    {filas.length ? <div className={`cl-carga-cols ${columnas.length > 1 ? "is-split" : ""}`.trim()}>
      {columnas.map((columna, index) => <ul key={index} className="cl-carga-list">
        <li className="cl-carga-th" aria-hidden="true"><span>Técnico</span><span>Carga</span><span /><span>Pend.</span><span>Avance</span></li>
        {columna.map((item) => {
          const mine = Number(item.id) === Number(userId);
          const key = mine ? "mine" : String(item.id);
          const active = filtro === key || filtro === String(item.id);
          const carga = repartido ? Math.round((item.pendientes * 100) / repartido) : 0;
          const sobre = parejo > 0 && item.pendientes > parejo * 1.5;
          return <li key={item.id}><button type="button" aria-pressed={active} className={`${active ? "is-active" : ""} ${sobre ? "is-high" : ""} ${item.total ? "" : "is-empty"}`.trim()} onClick={() => onVerTecnico(key)}
            aria-label={`${item.nombre}: ${carga}% de la carga, ${item.pendientes} pendientes, ${item.total ? `${item.avance}% de avance` : "sin nada asignado"}`}
            title={item.total ? `${item.nombre}: ${item.pendientes} pendientes (${carga}% de lo repartido) · ${item.trabajados} de ${item.total} trabajados: ${item.enviados} a ficha, ${item.descartados} descartados` : `${item.nombre}: sin nada asignado todavía`}>
            <span className="cl-carga-name">{mine ? `${item.nombre} (tú)` : item.nombre}</span>
            <span className="cl-carga-bar" aria-hidden="true"><b style={{ width: `${(item.pendientes / maximo) * 100}%` }} />{parejo ? <i style={{ left: `${Math.min(100, (parejo / maximo) * 100)}%` }} /> : null}</span>
            <strong className="cl-carga-pct">{carga}%</strong>
            <span className="cl-carga-num">{item.pendientes}</span>
            <span className="cl-carga-num is-avance">{item.total ? `${item.avance}%` : "—"}</span>
          </button></li>;
        })}
      </ul>)}
    </div> : <p className="cl-carga-empty">Nadie tiene candidatos asignados. Selecciona en la lista y usa «Asignar o repartir».</p>}
  </section>;
}

export default function BancoClandestinos({ api, model, permissions, session, notify, onOpenFicha, onFichaCreated }) {
  const [busyId, setBusyId] = useState(null);
  const [working, setWorking] = useState("");
  const fileInput = useRef(null);
  const userId = session?.user?.id;
  const canAssign = Boolean(permissions.can_assign_banco);
  // Selección para asignar: solo lo que todavía hay que convertir en ficha.
  const [selected, setSelected] = useState(() => new Map());
  const [assigning, setAssigning] = useState(false);
  const selectedIds = useMemo(() => [...selected.keys()], [selected]);
  const isSelectable = (item) => canAssign && item.estado === "pendiente" && item.dictamen !== "registrado";
  const toggleSelected = (item) => setSelected((current) => { const next = new Map(current); next.has(item.id) ? next.delete(item.id) : next.set(item.id, item); return next; });
  const visibleSelectable = model.items.filter(isSelectable);
  const allVisibleSelected = Boolean(visibleSelectable.length) && visibleSelectable.every((item) => selected.has(item.id));
  const toggleVisible = () => setSelected((current) => { const next = new Map(current); visibleSelectable.forEach((item) => (allVisibleSelected ? next.delete(item.id) : next.set(item.id, item))); return next; });
  const filtrosActuales = { q: model.filters.query, dictamen: model.filters.dictamen, estado: model.filters.estado, barrio: model.filters.barrio, asignado: model.filters.asignado };
  const selectAllFiltered = async () => {
    setWorking("select");
    try {
      const { items } = await api.bancoListado(filtrosActuales);
      const asignables = items.filter(isSelectable);
      setSelected(new Map(asignables.map((item) => [item.id, item])));
      notify(`${asignables.length} ${asignables.length === 1 ? "candidato seleccionado" : "candidatos seleccionados"}${items.length > asignables.length ? ` (se omitieron ${items.length - asignables.length} que ya no están pendientes o aparecen en Aguas)` : ""}.`);
    } catch (error) { notify(error.message); } finally { setWorking(""); }
  };
  const unassign = async () => {
    setWorking("unassign");
    try { const result = await api.bancoUnassign(selectedIds); notify(`${result.liberados} ${result.liberados === 1 ? "candidato quedó" : "candidatos quedaron"} sin asignar.`); setSelected(new Map()); await model.reload({ silent: true }); }
    catch (error) { notify(error.message); } finally { setWorking(""); }
  };
  // Nombre de quien tiene el filtro de asignación (para el título y el listado).
  const asignadoNombre = model.filters.asignado === "mine" ? session?.user?.full_name || "Mis asignaciones"
    : Number(model.filters.asignado) > 0 ? model.asignaciones?.find((item) => String(item.id) === String(model.filters.asignado))?.nombre || "Técnico" : "";
  const misPendientes = model.asignaciones?.find((item) => Number(item.id) === Number(userId))?.pendientes || 0;
  // Técnico elegido en el panel (o uno mismo en "Mis asignaciones"), con su avance.
  const tecnicoActivo = model.filters.asignado === "mine" ? model.asignaciones?.find((item) => Number(item.id) === Number(userId))
    : Number(model.filters.asignado) > 0 ? model.asignaciones?.find((item) => String(item.id) === String(model.filters.asignado)) : null;
  // Al tocar un técnico se ve todo lo suyo (pendiente, a ficha y descartado); al soltarlo, vuelve a "Por revisar".
  const verTecnico = (key) => {
    const soltar = model.filters.asignado === key;
    model.filters.setAsignado(soltar ? "" : key);
    model.filters.setEstado(soltar ? "pendiente" : "");
  };
  // "Sin asignar" es lo que hay que repartir: siempre lo pendiente.
  const verSinAsignar = () => {
    model.filters.setAsignado(model.filters.asignado === "none" ? "" : "none");
    model.filters.setEstado("pendiente");
  };
  // Con un solo estado y sin filtro de técnico, la lista se agrupa por técnico
  // (el backend ya la ordena así). Con filtro, el encabezado dice de quién es.
  const agrupar = canAssign && !model.filters.asignado && Boolean(model.filters.estado);
  const showTecnico = !agrupar && !model.filters.asignado;
  const showBarrio = !model.filters.barrio && new Set(model.items.map((item) => item.barrio_colonia)).size > 1;
  const grupos = useMemo(() => {
    if (!agrupar) return [{ key: "todos", items: model.items }];
    const lista = [];
    for (const item of model.items) {
      const key = item.asignado_a == null ? "none" : String(item.asignado_a);
      if (lista.at(-1)?.key !== key) lista.push({ key, nombre: item.asignado_nombre, items: [] });
      lista.at(-1).items.push(item);
    }
    return lista;
  }, [agrupar, model.items]);
  const repartido = (model.asignaciones || []).reduce((sum, item) => sum + item.pendientes, 0);
  const cabeceraGrupo = (grupo) => {
    const tecnico = model.asignaciones?.find((item) => String(item.id) === grupo.key);
    const mine = grupo.key !== "none" && Number(grupo.key) === Number(userId);
    const nombre = grupo.key === "none" ? "Sin asignar" : mine ? "Tus asignaciones" : tecnico?.nombre || grupo.nombre || "Técnico";
    const enEstado = grupo.key === "none" ? (model.filters.estado === "pendiente" ? model.sin_asignar : null)
      : tecnico ? { pendiente: tecnico.pendientes, enviado: tecnico.enviados, descartado: tecnico.descartados }[model.filters.estado] : null;
    const detalle = [
      enEstado != null ? `${enEstado} ${(ESTADO_LABELS[model.filters.estado] || "").toLowerCase()}` : "",
      tecnico && model.filters.estado === "pendiente" && repartido ? `${Math.round((tecnico.pendientes * 100) / repartido)}% de la carga` : "",
      enEstado != null && enEstado > grupo.items.length ? `${grupo.items.length} en esta página` : ""
    ].filter(Boolean).join(" · ");
    const seleccionables = grupo.items.filter(isSelectable);
    const todos = Boolean(seleccionables.length) && seleccionables.every((item) => selected.has(item.id));
    const alternar = () => setSelected((current) => { const next = new Map(current); seleccionables.forEach((item) => (todos ? next.delete(item.id) : next.set(item.id, item))); return next; });
    return <header className="cl-brow-group">
      <span className="cl-brow-check">{seleccionables.length ? <SpringCheck checked={todos} onChange={alternar} ariaLabel={`Seleccionar los de ${nombre} en esta página`} /> : null}</span>
      <h4>{grupo.key === "none" ? <Icon name="inbox" /> : <Icon name="users" />}{nombre}</h4>
      {detalle ? <small>{detalle}</small> : null}
      <button type="button" className="cl-scope-clear" onClick={() => (grupo.key === "none" ? verSinAsignar() : verTecnico(mine ? "mine" : grupo.key))}>{grupo.key === "none" ? "Ver solo sin asignar" : "Ver todo lo suyo"}</button>
    </header>;
  };
  // Listado de campo: solo clandestinos (o el dictamen elegido); nunca los que están en Aguas.
  // Lo de un técnico se imprime completo, con su avance y lo ya trabajado marcado.
  const imprimir = async () => {
    setWorking("print");
    try {
      const dictamen = tecnicoActivo ? model.filters.dictamen : dictamenParaImprimir(model.filters.dictamen);
      const { items, limite } = await api.bancoListado({ ...filtrosActuales, dictamen });
      if (!items.length) { notify("No hay candidatos para imprimir con estos filtros."); return; }
      const avance = tecnicoActivo && !model.filters.estado && !dictamen && !model.filters.barrio && !model.filters.query ? tecnicoActivo : null;
      const markup = buildBancoListado(items, { ...model.filters, dictamen, estadoLabel: ESTADO_LABELS[model.filters.estado] || "Todos", asignadoNombre, avance });
      await printDocument("Listado de campo · Banco de clandestinos", `${BANCO_PRINT_STYLES}${markup}`, { pageSize: "Letter landscape", pageMargin: "10mm", reportType: "banco-clandestinos-listado" });
      if (items.length >= limite) notify(`Se imprimieron los primeros ${limite}; filtra por barrio para el resto.`);
    } catch (error) { notify(error.message); } finally { setWorking(""); }
  };
  const run = async (id, action) => { setBusyId(id); try { await action(); } catch (error) { notify(error.message); } finally { setBusyId(null); } };
  const send = (item, clave) => run(item.id, async () => {
    const result = await api.bancoSend(item.id, clave);
    notify(result.ficha_existente ? `La clave ${result.ficha.clave_catastral} ya tenía ficha; quedó vinculada.` : `Ficha ${result.ficha.clave_catastral} creada desde el banco.`);
    await model.reload({ silent: true });
    onFichaCreated?.(result.ficha);
  });
  const discard = (item, motivo) => run(item.id, async () => { await api.bancoDiscard(item.id, motivo); notify("Candidato descartado. Si fue un error, lo encuentras en Descartados y lo puedes devolver."); await model.reload({ silent: true }); });
  const restore = (item) => run(item.id, async () => { await api.bancoRestore(item.id); notify("Candidato devuelto al banco."); await model.reload({ silent: true }); });
  const verify = async () => {
    setWorking("verify");
    try {
      const result = await api.bancoVerify();
      notify([`${result.verificados} verificados contra los padrones`, result.descartados ? `${result.descartados} pasaron a descartados por aparecer en Aguas` : "ninguno aparece en Aguas", result.cambiaron ? `${result.cambiaron} cambiaron de dictamen` : "", result.duplicados ? `${result.duplicados} ${result.duplicados === 1 ? "repetido agrupado" : "repetidos agrupados"} por misma clave` : ""].filter(Boolean).join("; ") + ".");
      await model.reload();
    } catch (error) { notify(error.message); } finally { setWorking(""); }
  };
  const importFile = async (file) => {
    if (!file) return;
    setWorking("import");
    try {
      const result = await api.bancoImport(await file.text(), file.name);
      notify(`Importación lista: ${result.nuevos} nuevos, ${result.actualizados} actualizados${result.sin_cambios_procesados ? `, ${result.sin_cambios_procesados} ya procesados sin tocar` : ""}${result.duplicados ? `, ${result.duplicados} ${result.duplicados === 1 ? "repetido agrupado" : "repetidos agrupados"} por misma clave` : ""}.`);
      await model.reload();
    } catch (error) { notify(error.message); } finally { setWorking(""); if (fileInput.current) fileInput.current.value = ""; }
  };

  return <section className={`cl-banco ${canAssign && selected.size ? "is-selecting" : ""}`.trim()} aria-label="Banco de clandestinos">
    <section className={`cl-banco-charts ${model.refreshing ? "is-refreshing" : ""}`.trim()} aria-label="Resumen del banco">
      <div className="cl-banco-chart is-donut">
        <header><h3>Dictamen</h3><p>Toca un segmento para filtrar</p></header>
        <div className="cl-banco-donut-row">
          <DonutChart label="Candidatos por dictamen" centerCaption={(ESTADO_LABELS[model.filters.estado] || "candidatos").toLowerCase()} selected={model.filters.dictamen} onSelect={model.filters.setDictamen} segments={DICTAMENES.map(([key, label]) => ({ key, label, value: model.counts[key] || 0, color: DICTAMEN_COLORS[key] }))} />
          <MeterLegend selected={model.filters.dictamen} onSelect={model.filters.setDictamen} renderIcon={(item) => <Icon name={item.icon} />} items={DICTAMENES.map(([key, label, hint, icon]) => ({ key, label, hint, icon, value: model.counts[key] || 0, color: DICTAMEN_COLORS[key] }))} />
        </div>
      </div>
      <div className="cl-banco-chart is-bars">
        <header><h3>Barrios con más candidatos</h3><p>{model.filters.barrio ? <button type="button" className="cl-scope-clear" onClick={() => model.filters.setBarrio("")}>Ver todos los barrios</button> : "Toca un barrio para filtrar"}</p></header>
        <StackedBars label="Candidatos por barrio" reserveRows={8} selected={model.filters.barrio} onSelect={model.filters.setBarrio} emptyText={model.loading ? "Cargando…" : "Sin barrios con estos filtros"} rows={(model.barrio_counts || []).slice(0, 8).map((row) => ({ key: row.barrio, label: row.barrio, total: row.total, parts: DICTAMENES.map(([key, label]) => ({ key, label, value: row[key] || 0, color: DICTAMEN_COLORS[key] })) }))} />
      </div>
      <aside className="cl-banco-flow" aria-label="Avance del banco">
        <h3>Avance</h3>
        {BANCO_FLOW.map(([key, label, icon]) => <button type="button" key={key} aria-pressed={model.filters.estado === key} className={model.filters.estado === key ? "is-active" : ""} onClick={() => model.filters.setEstado(key)}><Icon name={icon} /><span>{label}</span><strong><CountUp value={model.estados?.[key] || 0} /></strong></button>)}
        {permissions.can_process_banco ? <p className="cl-banco-flow-hint"><Icon name="checkCircle" />Verificar vuelve a revisar los pendientes y manda a descartados los que ya aparecen en Aguas.</p> : null}
        <div className="cl-banco-head-actions">
          <button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={imprimir} title="Imprime el listado de campo con los filtros actuales. Solo clandestinos (o el dictamen elegido); nunca los que aparecen en Aguas."><Icon name="print" />{working === "print" ? "Preparando…" : "Imprimir listado"}</button>
          {permissions.can_process_banco ? <button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={verify} title="Vuelve a dictaminar los pendientes con los padrones actuales"><Icon name="refresh" />{working === "verify" ? "Verificando…" : "Verificar"}</button> : null}
          {permissions.can_import_banco ? <><input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => importFile(event.target.files?.[0])} /><button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={() => fileInput.current?.click()} title="Importar el CSV del levantamiento de QField"><Icon name="download" />{working === "import" ? "Importando…" : "Importar CSV"}</button></> : null}
        </div>
      </aside>
    </section>
    <CargaEquipo asignaciones={model.asignaciones || []} sinAsignar={model.sin_asignar || 0} canAssign={canAssign} userId={userId} filtro={model.filters.asignado} onVerTecnico={verTecnico} onSinAsignar={verSinAsignar} />
    <div className="cl-toolbar">
      <label className="cl-search"><span>Buscar</span><div><Icon name="search" /><input value={model.filters.query} onChange={(event) => model.filters.setQuery(event.target.value)} placeholder="Clave, propietario, barrio o comentario" /></div></label>
      <label><span>Estado</span><select value={model.filters.estado} onChange={(event) => model.filters.setEstado(event.target.value)}>{ESTADOS.map(([value, label]) => <option key={value || "todos"} value={value}>{label}{value ? ` (${model.estados?.[value] || 0})` : ""}</option>)}</select></label>
      <div className="cl-picker-field"><span>Barrio</span><BarrioPicker value={model.filters.barrio} onChange={model.filters.setBarrio} options={model.barrio_counts || []} /></div>
      <button type="button" className="cl-quiet" onClick={model.filters.clear}><Icon name="refresh" />Limpiar</button>
    </div>
    {model.error ? <p className="cl-alert">{model.error}</p> : null}
    {misPendientes && model.filters.asignado !== "mine" ? <div className="cl-banco-mine" role="status"><Icon name="users" /><span><strong>Tienes {misPendientes} {misPendientes === 1 ? "candidato asignado" : "candidatos asignados"}</strong> para convertir en ficha.</span><button type="button" className="cl-primary" onClick={() => { model.filters.setEstado("pendiente"); model.filters.setAsignado("mine"); }}>Ver mis asignaciones<Icon name="arrowRight" /></button></div> : null}
    {asignadoNombre ? <div className="cl-banco-scope is-tecnico">
      <p><Icon name="users" />{model.filters.asignado === "mine" ? "Mis asignaciones" : `Asignados a ${asignadoNombre}`}<span>{model.total} {model.total === 1 ? "candidato" : "candidatos"}{model.filters.estado ? ` · ${(ESTADO_LABELS[model.filters.estado] || "").toLowerCase()}` : ""}</span></p>
      {tecnicoActivo ? <div className="cl-banco-scope-avance" aria-label={`Avance ${tecnicoActivo.avance}%`}>
        <strong>{tecnicoActivo.avance}%</strong>
        <span className="cl-banco-tech-bar is-large" aria-hidden="true"><b style={{ width: `${tecnicoActivo.avance}%` }} /></span>
        <small>{tecnicoActivo.trabajados} de {tecnicoActivo.total} trabajados · {tecnicoActivo.enviados} a ficha · {tecnicoActivo.descartados} descartados · {tecnicoActivo.pendientes} pendientes</small>
      </div> : null}
      <div className="cl-banco-scope-actions">
        <button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={imprimir}><Icon name="print" />{working === "print" ? "Preparando…" : "Imprimir"}</button>
        <button type="button" className="cl-scope-clear" onClick={() => { model.filters.setAsignado(""); model.filters.setEstado("pendiente"); }}>Ver todos</button>
      </div>
    </div> : model.filters.asignado === "none" ? <p className="cl-banco-scope"><Icon name="inbox" />Sin asignar<span>{model.total} {model.total === 1 ? "candidato" : "candidatos"}</span><button type="button" className="cl-scope-clear" onClick={verSinAsignar}>Ver todos</button></p> : null}
    {canAssign && visibleSelectable.length ? <div className={`cl-banco-selbar ${selected.size ? "is-active" : ""}`.trim()}>
      <SpringCheck checked={allVisibleSelected} onChange={toggleVisible} ariaLabel="Seleccionar los de esta página" />
      <span className="cl-banco-selcount">{selected.size ? <><strong>{selected.size}</strong> {selected.size === 1 ? "seleccionado" : "seleccionados"}</> : "Selecciona candidatos para asignarlos a técnicos"}</span>
      {model.total > visibleSelectable.length ? <button type="button" className="cl-quiet" disabled={Boolean(working)} onClick={selectAllFiltered}>{working === "select" ? "Seleccionando…" : `Seleccionar los ${model.total} del filtro`}</button> : null}
    </div> : null}
    {/* Las acciones de la selección flotan abajo: la página es larga y la barra
        de arriba se pierde al bajar a marcar más filas. */}
    {canAssign && selected.size ? <div className="cl-banco-float" role="region" aria-label="Acciones de la selección">
      <span className="cl-banco-selcount"><strong>{selected.size}</strong> {selected.size === 1 ? "seleccionado" : "seleccionados"}</span>
      <button type="button" className="cl-quiet" onClick={() => setSelected(new Map())}><Icon name="close" />Limpiar</button>
      {[...selected.values()].some((item) => item.asignado_a != null) ? <button type="button" className="cl-quiet" disabled={Boolean(working)} onClick={unassign}><Icon name="refresh" />Quitar asignación</button> : null}
      <button type="button" className="cl-primary" onClick={() => setAssigning(true)}><Icon name="users" />Asignar o repartir</button>
    </div> : null}
    {assigning ? <AsignarTecnicosDialog api={api} ids={selectedIds} notify={notify} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); setSelected(new Map()); model.reload({ silent: true }); }} /> : null}
    {model.refreshing ? <span className="cl-table-progress cl-banco-progress" role="status" aria-label="Actualizando banco" /> : null}
    <div className={`cl-banco-list ${showTecnico ? "has-tecnico" : ""} ${model.refreshing ? "is-refreshing" : ""}`.trim()} aria-busy={model.loading || model.refreshing}>
      {model.loading ? Array.from({ length: 8 }, (_, index) => <div key={index} className="cl-brow is-skeleton" aria-hidden="true" />) : model.items.length ? <>
        <div className="cl-brow-head" aria-hidden="true"><span /><span /><span>Clave</span><span>Alcaldía</span><span>Aguas</span><span>Campo</span>{showTecnico ? <span>Técnico</span> : null}<span /></div>
        {grupos.map((grupo, index) => <section key={`${grupo.key}-${index}`} className="cl-brow-section" aria-label={grupo.key === "todos" ? "Candidatos" : undefined}>
          {grupo.key !== "todos" ? cabeceraGrupo(grupo) : null}
          {grupo.items.map((item) => <CandidatoFila key={item.id} item={item} permissions={permissions} userId={userId} selectable={isSelectable(item)} selected={selected.has(item.id)} showBarrio={showBarrio} showTecnico={showTecnico} onToggle={toggleSelected} busy={busyId === item.id} onSend={send} onDiscard={discard} onRestore={restore} onOpenFicha={onOpenFicha} />)}
        </section>)}
      </> : <div className="cl-empty-state"><Icon name="inbox" /><strong>No hay candidatos con estos filtros</strong><span>{permissions.can_import_banco ? "Importa el CSV del levantamiento de QField para llenar el banco." : "Cuando administración importe un levantamiento de campo, aparecerá aquí."}</span></div>}
    </div>
    <footer className="cl-pagination"><span>{model.total} {model.total === 1 ? "candidato" : "candidatos"} · Página {model.page} de {model.total_pages}</span><div><button type="button" disabled={model.page <= 1} onClick={() => model.filters.setPage(model.page - 1)}><Icon name="arrowLeft" />Anterior</button><button type="button" disabled={model.page >= model.total_pages} onClick={() => model.filters.setPage(model.page + 1)}>Siguiente<Icon name="arrowRight" /></button></div></footer>
  </section>;
}
