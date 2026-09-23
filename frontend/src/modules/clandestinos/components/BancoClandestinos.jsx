import { useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import { CountUp, DonutChart, MeterLegend, StackedBars } from "./ClCharts";

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

const mapUrl = (item) => `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;

function Candidato({ item, permissions, busy, onSend, onDiscard, onRestore, onOpenFicha }) {
  const [clave, setClave] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [motivo, setMotivo] = useState("");
  const pendiente = item.estado === "pendiente";
  const canProcess = permissions.can_process_banco && pendiente;
  const canSend = canProcess && item.dictamen !== "registrado";
  const needsClave = canSend && !item.clave_catastral;
  const enAguas = item.aguas_clave || item.aguas_abonado;
  return <article className={`cl-bcard is-${item.dictamen} ${busy ? "is-busy" : ""}`.trim()}>
    <header>
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
    {item.estado === "descartado" ? <p className="cl-bcard-warn is-muted"><Icon name="archive" />Descartado: {item.motivo_descarte}</p> : null}
    {discarding ? <form className="cl-bcard-form" onSubmit={(event) => { event.preventDefault(); onDiscard(item, motivo); }}>
      <input autoFocus aria-label="Motivo del descarte" value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Motivo del descarte" />
      <button type="button" className="cl-bcard-icon" title="Cancelar" aria-label="Cancelar descarte" onClick={() => { setDiscarding(false); setMotivo(""); }}><Icon name="close" /></button>
      <button type="submit" className="cl-bcard-go is-danger" disabled={busy || !motivo.trim()}><Icon name="archive" />Descartar</button>
    </form> : needsClave ? <form className="cl-bcard-form" onSubmit={(event) => { event.preventDefault(); onSend(item, clave); }}>
      <input aria-label="Clave catastral" value={clave} onChange={(event) => setClave(event.target.value)} placeholder="Escribe la clave, ej. 89-13-15" />
    </form> : null}
    <footer>
      <div className="cl-bcard-meta">
        {item.latitude != null ? <a href={mapUrl(item)} target="_blank" rel="noreferrer" title="Ver ubicación en el mapa"><Icon name="map" /><span>Mapa</span></a> : <span title="Sin coordenadas"><Icon name="map" /><span>—</span></span>}
        <span title="Punto del levantamiento en QField"><Icon name="pin" />#{item.origen_ref}</span>
      </div>
      <div className="cl-bcard-actions">
        {canProcess && !discarding ? <button type="button" className="cl-bcard-icon" title="Descartar candidato" aria-label="Descartar candidato" disabled={busy} onClick={() => setDiscarding(true)}><Icon name="archive" /></button> : null}
        {canSend && !discarding ? <button type="button" className="cl-bcard-go" disabled={busy || (needsClave && !clave.trim())} onClick={() => onSend(item, clave)}><Icon name="send" />{busy ? "Verificando…" : "Enviar a ficha"}</button> : null}
        {item.estado === "enviado" && item.inmueble_id ? <button type="button" className="cl-bcard-go is-soft" onClick={() => onOpenFicha(item)}><Icon name="eye" />Abrir ficha</button> : null}
        {item.estado === "descartado" && permissions.can_process_banco ? <button type="button" className="cl-bcard-go is-soft" disabled={busy} onClick={() => onRestore(item)}><Icon name="refresh" />Devolver</button> : null}
      </div>
    </footer>
  </article>;
}

export default function BancoClandestinos({ api, model, permissions, notify, onOpenFicha, onFichaCreated }) {
  const [busyId, setBusyId] = useState(null);
  const [working, setWorking] = useState("");
  const fileInput = useRef(null);
  const run = async (id, action) => { setBusyId(id); try { await action(); } catch (error) { notify(error.message); } finally { setBusyId(null); } };
  const send = (item, clave) => run(item.id, async () => {
    const result = await api.bancoSend(item.id, clave);
    notify(result.ficha_existente ? `La clave ${result.ficha.clave_catastral} ya tenía ficha; quedó vinculada.` : `Ficha ${result.ficha.clave_catastral} creada desde el banco.`);
    await model.reload({ silent: true });
    onFichaCreated?.(result.ficha);
  });
  const discard = (item, motivo) => run(item.id, async () => { await api.bancoDiscard(item.id, motivo); notify("Candidato descartado."); await model.reload({ silent: true }); });
  const restore = (item) => run(item.id, async () => { await api.bancoRestore(item.id); notify("Candidato devuelto al banco."); await model.reload({ silent: true }); });
  const verify = async () => {
    setWorking("verify");
    try {
      const result = await api.bancoVerify();
      notify(result.cambiaron ? `${result.verificados} verificados contra los padrones; ${result.cambiaron} cambiaron de dictamen.` : `${result.verificados} verificados contra los padrones; sin cambios.`);
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

  return <section className="cl-banco" aria-label="Banco de clandestinos">
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
        <StackedBars label="Candidatos por barrio" selected={model.filters.barrio} onSelect={model.filters.setBarrio} emptyText={model.loading ? "Cargando…" : "Sin barrios con estos filtros"} rows={(model.barrio_counts || []).map((row) => ({ key: row.barrio, label: row.barrio, total: row.total, parts: DICTAMENES.map(([key, label]) => ({ key, label, value: row[key] || 0, color: DICTAMEN_COLORS[key] })) }))} />
      </div>
      <aside className="cl-banco-flow" aria-label="Avance del banco">
        <h3>Avance</h3>
        {BANCO_FLOW.map(([key, label, icon]) => <button type="button" key={key} aria-pressed={model.filters.estado === key} className={model.filters.estado === key ? "is-active" : ""} onClick={() => model.filters.setEstado(key)}><Icon name={icon} /><span>{label}</span><strong><CountUp value={model.estados?.[key] || 0} /></strong></button>)}
        <div className="cl-banco-head-actions">
          {permissions.can_process_banco ? <button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={verify} title="Vuelve a dictaminar los pendientes con los padrones actuales"><Icon name="refresh" />{working === "verify" ? "Verificando…" : "Verificar"}</button> : null}
          {permissions.can_import_banco ? <><input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => importFile(event.target.files?.[0])} /><button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={() => fileInput.current?.click()} title="Importar el CSV del levantamiento de QField"><Icon name="download" />{working === "import" ? "Importando…" : "Importar CSV"}</button></> : null}
        </div>
      </aside>
    </section>
    <div className="cl-toolbar">
      <label className="cl-search"><span>Buscar</span><div><Icon name="search" /><input value={model.filters.query} onChange={(event) => model.filters.setQuery(event.target.value)} placeholder="Clave, propietario, barrio o comentario" /></div></label>
      <label><span>Estado</span><select value={model.filters.estado} onChange={(event) => model.filters.setEstado(event.target.value)}>{ESTADOS.map(([value, label]) => <option key={value || "todos"} value={value}>{label}{value ? ` (${model.estados?.[value] || 0})` : ""}</option>)}</select></label>
      <label><span>Barrio</span><select value={model.filters.barrio} onChange={(event) => model.filters.setBarrio(event.target.value)}><option value="">Todos</option>{(model.barrios || []).map((item) => <option key={item}>{item}</option>)}</select></label>
      <button type="button" className="cl-quiet" onClick={model.filters.clear}><Icon name="refresh" />Limpiar</button>
    </div>
    {model.error ? <p className="cl-alert">{model.error}</p> : null}
    {model.refreshing ? <span className="cl-table-progress cl-banco-progress" role="status" aria-label="Actualizando banco" /> : null}
    <div className={`cl-banco-list ${model.refreshing ? "is-refreshing" : ""}`.trim()} aria-busy={model.loading || model.refreshing}>
      {model.loading ? Array.from({ length: 6 }, (_, index) => <div key={index} className="cl-bcard is-skeleton" aria-hidden="true" />) : model.items.length ? model.items.map((item) => <Candidato key={item.id} item={item} permissions={permissions} busy={busyId === item.id} onSend={send} onDiscard={discard} onRestore={restore} onOpenFicha={onOpenFicha} />) : <div className="cl-empty-state"><Icon name="inbox" /><strong>No hay candidatos con estos filtros</strong><span>{permissions.can_import_banco ? "Importa el CSV del levantamiento de QField para llenar el banco." : "Cuando administración importe un levantamiento de campo, aparecerá aquí."}</span></div>}
    </div>
    <footer className="cl-pagination"><span>{model.total} {model.total === 1 ? "candidato" : "candidatos"} · Página {model.page} de {model.total_pages}</span><div><button type="button" disabled={model.page <= 1} onClick={() => model.filters.setPage(model.page - 1)}><Icon name="arrowLeft" />Anterior</button><button type="button" disabled={model.page >= model.total_pages} onClick={() => model.filters.setPage(model.page + 1)}>Siguiente<Icon name="arrowRight" /></button></div></footer>
  </section>;
}
