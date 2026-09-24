import { useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import SpringCheck from "../../../components/micro/SpringCheck";
import { printDocument } from "../../../utils/printDocument";
import AsignarTecnicosDialog from "./AsignarTecnicosDialog";
import { BANCO_PRINT_STYLES, buildBancoListado, dictamenParaImprimir } from "../services/bancoPrint";
import { CountUp, DonutChart, MeterLegend, StackedBars } from "./ClCharts";
import BarrioPicker from "./BarrioPicker";

const DICTAMENES = [
  ["clandestino", "Clandestino", "Solo aparece en Alcaldía", "warning"],
  ["probable", "Probable", "El lote está en Aguas, la unidad no", "flag"],
  ["sin_determinar", "Sin determinar", "Sin clave o fuera de ambos padrones", "search"],
  ["registrado", "Registrado en Aguas", "No es clandestino", "checkCircle"]
];
const DICTAMEN_LABELS = Object.fromEntries(DICTAMENES.map(([key, label]) => [key, label]));
const DICTAMEN_ICONS = Object.fromEntries(DICTAMENES.map(([key, , , icon]) => [key, icon]));
// Colores de estado (reservados): rojo crítico, ámbar advertencia, gris neutro, verde bien.
const DICTAMEN_COLORS = { clandestino: "#c2414b", probable: "#d08a1f", sin_determinar: "#8fa3b8", registrado: "#1f9463" };
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

function Candidato({ item, permissions, userId, busy, selectable, selected, onToggle, onSend, onDiscard, onRestore, onOpenFicha }) {
  const [clave, setClave] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const pendiente = item.estado === "pendiente";
  const descartado = item.estado === "descartado";
  // La validadora de campo solo trabaja lo que le asignaron.
  const canWork = permissions.can_process_banco || (permissions.can_work_assigned_banco && item.asignado_a != null && Number(item.asignado_a) === Number(userId));
  const canProcess = pendiente && canWork;
  // Quien puede descartar también puede deshacerlo, por si fue un error.
  const canRestore = descartado && canWork;
  const canSend = canProcess && item.dictamen !== "registrado";
  const needsClave = canSend && !item.clave_catastral;
  const enAguas = item.aguas_clave || item.aguas_abonado;
  return <article className={`cl-bcard is-${item.dictamen} ${descartado ? "is-descartado" : ""} ${discarding ? "is-discarding" : ""} ${busy ? "is-busy" : ""} ${selected ? "is-selected" : ""}`.trim()}>
    <header>
      {selectable ? <SpringCheck checked={selected} onChange={() => onToggle(item)} ariaLabel={`Seleccionar ${item.clave_catastral || `punto ${item.origen_ref}`}`} /> : null}
      <span className={`cl-bcard-badge is-${item.dictamen}`} title={`${DICTAMEN_LABELS[item.dictamen] || item.dictamen}: ${item.motivo_dictamen || ""}`}><Icon name={DICTAMEN_ICONS[item.dictamen] || "search"} /></span>
      <div className="cl-bcard-id">
        <h3>{item.clave_catastral || "Sin clave"}</h3>
        <p title={item.barrio_colonia}>{item.barrio_colonia || "Sin barrio"}{item.clave_origen === "plano" ? " · del plano" : ""}</p>
      </div>
      <div className="cl-bcard-services" aria-label="Servicios observados en campo">
        {SERVICES.map(([key, label, icon]) => <span key={key} className={item[key] ? "is-on" : ""} title={`${label}: ${item[key] ? "sí" : "no"}`}><Icon name={icon} /></span>)}
        {item.lote_baldio ? <span className="cl-bcard-tag" title="Lote baldío">Baldío</span> : null}
      </div>
    </header>
    <dl className="cl-bcard-padrones">
      <div className={item.alcaldia_propietario ? "is-found" : ""} title={item.alcaldia_propietario ? [item.alcaldia_clave, item.alcaldia_caserio].filter(Boolean).join(" · ") : "No aparece en Alcaldía"}>
        <dt><Icon name="home" /><span>Alcaldía</span></dt>
        <dd>{item.alcaldia_propietario || "No aparece"}</dd>
      </div>
      <div className={enAguas ? "is-found" : ""} title={enAguas ? [item.aguas_clave, item.aguas_abonado && `abonado ${item.aguas_abonado}`].filter(Boolean).join(" · ") : "No aparece en Aguas"}>
        <dt><Icon name="water" /><span>Aguas</span></dt>
        <dd>{enAguas ? item.aguas_inquilino || `Abonado ${item.aguas_abonado || item.aguas_clave}` : "No aparece"}</dd>
      </div>
    </dl>
    {item.comentario_campo ? <p className="cl-bcard-note" title={item.comentario_campo}><Icon name="notes" /><span>{item.comentario_campo}</span></p> : null}
    {item.nota_revision ? <p className="cl-bcard-warn"><Icon name="warning" />{item.nota_revision}</p> : null}
    {descartado ? <div className="cl-bcard-motivo">
      <span className="cl-bcard-motivo-label"><Icon name="archive" />Motivo del descarte</span>
      <p>{item.motivo_descarte || "Sin motivo registrado"}</p>
      {item.procesado_por_nombre || item.procesado_at ? <small>{[item.procesado_por_nombre && `Por ${item.procesado_por_nombre}`, fechaCorta(item.procesado_at)].filter(Boolean).join(" · ")}</small> : null}
    </div> : null}
    {discarding ? <DescartePanel busy={busy} onCancel={() => setDiscarding(false)} onConfirm={(motivo) => onDiscard(item, motivo)} /> : needsClave ? <form className="cl-bcard-form" onSubmit={(event) => { event.preventDefault(); onSend(item, clave); }}>
      <input aria-label="Clave catastral" value={clave} onChange={(event) => setClave(event.target.value)} placeholder="Escribe la clave, ej. 89-13-15" />
    </form> : null}
    <footer>
      <div className="cl-bcard-meta">
        {item.latitude != null ? <a href={mapUrl(item)} target="_blank" rel="noreferrer" title="Ver ubicación en el mapa"><Icon name="map" /><span>Mapa</span></a> : <span title="Sin coordenadas"><Icon name="map" /><span>—</span></span>}
        <span title="Punto del levantamiento en QField"><Icon name="pin" />#{item.origen_ref}</span>
        {item.asignado_nombre ? <span className={`cl-bcard-owner ${Number(item.asignado_a) === Number(userId) ? "is-mine" : ""}`.trim()} title={`Asignado a ${item.asignado_nombre}`}><Icon name="users" />{Number(item.asignado_a) === Number(userId) ? "Tuyo" : item.asignado_nombre.split(" ")[0]}</span> : null}
      </div>
      <div className="cl-bcard-actions">
        {canProcess && !discarding ? <button type="button" className="cl-bcard-icon" title="Descartar candidato" aria-label="Descartar candidato" disabled={busy} onClick={() => setDiscarding(true)}><Icon name="archive" /></button> : null}
        {canSend && !discarding ? <button type="button" className="cl-bcard-go" disabled={busy || (needsClave && !clave.trim())} onClick={() => onSend(item, clave)}><Icon name="send" />{busy ? "Verificando…" : "Enviar a ficha"}</button> : null}
        {item.estado === "enviado" && item.inmueble_id ? <button type="button" className="cl-bcard-go is-soft" onClick={() => onOpenFicha(item)}><Icon name="eye" />Abrir ficha</button> : null}
        {canRestore ? <button type="button" className="cl-bcard-go is-soft" disabled={busy} title="Deshacer el descarte: vuelve a Por revisar" onClick={() => onRestore(item)}><Icon name="refresh" />Devolver al banco</button> : null}
      </div>
    </footer>
  </article>;
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
  // Listado de campo: solo clandestinos (o el dictamen elegido); nunca los que están en Aguas.
  const imprimir = async () => {
    setWorking("print");
    try {
      const dictamen = dictamenParaImprimir(model.filters.dictamen);
      const { items, limite } = await api.bancoListado({ ...filtrosActuales, dictamen });
      if (!items.length) { notify("No hay candidatos para imprimir con estos filtros."); return; }
      const markup = buildBancoListado(items, { ...model.filters, dictamen, estadoLabel: ESTADO_LABELS[model.filters.estado] || "Todos", asignadoNombre });
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
      notify([`${result.verificados} verificados contra los padrones`, result.descartados ? `${result.descartados} pasaron a descartados por aparecer en Aguas` : "ninguno aparece en Aguas", result.cambiaron ? `${result.cambiaron} cambiaron de dictamen` : ""].filter(Boolean).join("; ") + ".");
      await model.reload();
    } catch (error) { notify(error.message); } finally { setWorking(""); }
  };
  const importFile = async (file) => {
    if (!file) return;
    setWorking("import");
    try {
      const result = await api.bancoImport(await file.text(), file.name);
      notify(`Importación lista: ${result.nuevos} nuevos, ${result.actualizados} actualizados${result.sin_cambios_procesados ? `, ${result.sin_cambios_procesados} ya procesados sin tocar` : ""}.`);
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
        {canAssign || model.asignaciones?.length ? <div className="cl-banco-team" aria-label="Asignaciones por técnico">
          <h4>Técnicos</h4>
          {canAssign ? <button type="button" aria-pressed={model.filters.asignado === "none"} className={model.filters.asignado === "none" ? "is-active" : ""} onClick={() => model.filters.setAsignado(model.filters.asignado === "none" ? "" : "none")}><Icon name="inbox" /><span>Sin asignar</span><strong><CountUp value={model.sin_asignar || 0} /></strong></button> : null}
          {(model.asignaciones || []).filter((item) => canAssign || Number(item.id) === Number(userId)).slice(0, 8).map((item) => { const key = Number(item.id) === Number(userId) ? "mine" : String(item.id); const active = model.filters.asignado === key || model.filters.asignado === String(item.id); return <button type="button" key={item.id} aria-pressed={active} className={active ? "is-active" : ""} onClick={() => model.filters.setAsignado(active ? "" : key)}><Icon name="users" /><span>{Number(item.id) === Number(userId) ? "Mis asignaciones" : item.nombre}</span><strong>{item.pendientes}</strong></button>; })}
        </div> : null}
        {permissions.can_process_banco ? <p className="cl-banco-flow-hint"><Icon name="checkCircle" />Verificar vuelve a revisar los pendientes y manda a descartados los que ya aparecen en Aguas.</p> : null}
        <div className="cl-banco-head-actions">
          <button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={imprimir} title="Imprime el listado de campo con los filtros actuales. Solo clandestinos (o el dictamen elegido); nunca los que aparecen en Aguas."><Icon name="print" />{working === "print" ? "Preparando…" : "Imprimir listado"}</button>
          {permissions.can_process_banco ? <button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={verify} title="Vuelve a dictaminar los pendientes con los padrones actuales"><Icon name="refresh" />{working === "verify" ? "Verificando…" : "Verificar"}</button> : null}
          {permissions.can_import_banco ? <><input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => importFile(event.target.files?.[0])} /><button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={() => fileInput.current?.click()} title="Importar el CSV del levantamiento de QField"><Icon name="download" />{working === "import" ? "Importando…" : "Importar CSV"}</button></> : null}
        </div>
      </aside>
    </section>
    <div className="cl-toolbar">
      <label className="cl-search"><span>Buscar</span><div><Icon name="search" /><input value={model.filters.query} onChange={(event) => model.filters.setQuery(event.target.value)} placeholder="Clave, propietario, barrio o comentario" /></div></label>
      <label><span>Estado</span><select value={model.filters.estado} onChange={(event) => model.filters.setEstado(event.target.value)}>{ESTADOS.map(([value, label]) => <option key={value || "todos"} value={value}>{label}{value ? ` (${model.estados?.[value] || 0})` : ""}</option>)}</select></label>
      <div className="cl-picker-field"><span>Barrio</span><BarrioPicker value={model.filters.barrio} onChange={model.filters.setBarrio} options={model.barrio_counts || []} /></div>
      <button type="button" className="cl-quiet" onClick={model.filters.clear}><Icon name="refresh" />Limpiar</button>
    </div>
    {model.error ? <p className="cl-alert">{model.error}</p> : null}
    {misPendientes && model.filters.asignado !== "mine" ? <div className="cl-banco-mine" role="status"><Icon name="users" /><span><strong>Tienes {misPendientes} {misPendientes === 1 ? "candidato asignado" : "candidatos asignados"}</strong> para convertir en ficha.</span><button type="button" className="cl-primary" onClick={() => { model.filters.setEstado("pendiente"); model.filters.setAsignado("mine"); }}>Ver mis asignaciones<Icon name="arrowRight" /></button></div> : null}
    {asignadoNombre ? <p className="cl-banco-scope"><Icon name="users" />{model.filters.asignado === "mine" ? "Mis asignaciones" : `Asignados a ${asignadoNombre}`}<span>{model.total} {model.total === 1 ? "candidato" : "candidatos"}</span><button type="button" className="cl-scope-clear" onClick={() => model.filters.setAsignado("")}>Ver todos</button></p> : model.filters.asignado === "none" ? <p className="cl-banco-scope"><Icon name="inbox" />Sin asignar<span>{model.total} {model.total === 1 ? "candidato" : "candidatos"}</span><button type="button" className="cl-scope-clear" onClick={() => model.filters.setAsignado("")}>Ver todos</button></p> : null}
    {canAssign && visibleSelectable.length ? <div className={`cl-banco-selbar ${selected.size ? "is-active" : ""}`.trim()}>
      <SpringCheck checked={allVisibleSelected} onChange={toggleVisible} ariaLabel="Seleccionar los de esta página" />
      <span className="cl-banco-selcount">{selected.size ? <><strong>{selected.size}</strong> {selected.size === 1 ? "seleccionado" : "seleccionados"}</> : "Selecciona candidatos para asignarlos a técnicos"}</span>
      {model.total > visibleSelectable.length ? <button type="button" className="cl-quiet" disabled={Boolean(working)} onClick={selectAllFiltered}>{working === "select" ? "Seleccionando…" : `Seleccionar los ${model.total} del filtro`}</button> : null}
    </div> : null}
    {/* Las acciones de la selección flotan abajo: la página es larga y la barra
        de arriba se pierde al bajar a marcar más tarjetas. */}
    {canAssign && selected.size ? <div className="cl-banco-float" role="region" aria-label="Acciones de la selección">
      <span className="cl-banco-selcount"><strong>{selected.size}</strong> {selected.size === 1 ? "seleccionado" : "seleccionados"}</span>
      <button type="button" className="cl-quiet" onClick={() => setSelected(new Map())}><Icon name="close" />Limpiar</button>
      {[...selected.values()].some((item) => item.asignado_a != null) ? <button type="button" className="cl-quiet" disabled={Boolean(working)} onClick={unassign}><Icon name="refresh" />Quitar asignación</button> : null}
      <button type="button" className="cl-primary" onClick={() => setAssigning(true)}><Icon name="users" />Asignar o repartir</button>
    </div> : null}
    {assigning ? <AsignarTecnicosDialog api={api} ids={selectedIds} notify={notify} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); setSelected(new Map()); model.reload({ silent: true }); }} /> : null}
    {model.refreshing ? <span className="cl-table-progress cl-banco-progress" role="status" aria-label="Actualizando banco" /> : null}
    <div className={`cl-banco-list ${model.refreshing ? "is-refreshing" : ""}`.trim()} aria-busy={model.loading || model.refreshing}>
      {model.loading ? Array.from({ length: 6 }, (_, index) => <div key={index} className="cl-bcard is-skeleton" aria-hidden="true" />) : model.items.length ? model.items.map((item) => <Candidato key={item.id} item={item} permissions={permissions} userId={userId} selectable={isSelectable(item)} selected={selected.has(item.id)} onToggle={toggleSelected} busy={busyId === item.id} onSend={send} onDiscard={discard} onRestore={restore} onOpenFicha={onOpenFicha} />) : <div className="cl-empty-state"><Icon name="inbox" /><strong>No hay candidatos con estos filtros</strong><span>{permissions.can_import_banco ? "Importa el CSV del levantamiento de QField para llenar el banco." : "Cuando administración importe un levantamiento de campo, aparecerá aquí."}</span></div>}
    </div>
    <footer className="cl-pagination"><span>{model.total} {model.total === 1 ? "candidato" : "candidatos"} · Página {model.page} de {model.total_pages}</span><div><button type="button" disabled={model.page <= 1} onClick={() => model.filters.setPage(model.page - 1)}><Icon name="arrowLeft" />Anterior</button><button type="button" disabled={model.page >= model.total_pages} onClick={() => model.filters.setPage(model.page + 1)}>Siguiente<Icon name="arrowRight" /></button></div></footer>
  </section>;
}
