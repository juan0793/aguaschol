import { useRef, useState } from "react";
import { Icon } from "../../../components/Icon";

const DICTAMENES = [
  ["clandestino", "Clandestino", "Solo aparece en Alcaldía", "warning"],
  ["probable", "Probable", "El lote está en Aguas, la unidad no", "flag"],
  ["sin_determinar", "Sin determinar", "Sin clave o fuera de ambos padrones", "search"],
  ["registrado", "Registrado en Aguas", "No es clandestino", "checkCircle"]
];
const DICTAMEN_LABELS = Object.fromEntries(DICTAMENES.map(([key, label]) => [key, label]));
const ESTADOS = [["pendiente", "Por revisar"], ["enviado", "Enviados a ficha"], ["descartado", "Descartados"], ["", "Todos"]];
const SERVICES = [["agua", "Agua potable", "water"], ["alcantarillado", "Alcantarillado", "sewer"], ["desechos", "Desechos sólidos", "waste"]];

const mapUrl = (item) => `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;

function Candidato({ item, permissions, busy, onSend, onDiscard, onRestore, onOpenFicha }) {
  const [clave, setClave] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [motivo, setMotivo] = useState("");
  const pendiente = item.estado === "pendiente";
  const canSend = permissions.can_process_banco && pendiente && item.dictamen !== "registrado";
  return <article className={`cl-banco-card is-${item.dictamen}`}>
    <header>
      <div>
        <span className={`cl-banco-dictamen is-${item.dictamen}`}><i />{DICTAMEN_LABELS[item.dictamen] || item.dictamen}</span>
        <h3>{item.clave_catastral || "Sin clave"}</h3>
        <p>{item.barrio_colonia || "Sin barrio"}{item.clave_origen === "plano" ? " · clave tomada del plano" : ""}</p>
      </div>
      <div className="cl-banco-services" aria-label="Servicios observados en campo">
        {SERVICES.map(([key, label, icon]) => <span key={key} className={item[key] ? "is-on" : ""} title={`${label}: ${item[key] ? "sí" : "no"}`}><Icon name={icon} /></span>)}
        {item.lote_baldio ? <span className="cl-banco-tag">Lote baldío</span> : null}
      </div>
    </header>
    <dl className="cl-banco-padrones">
      <div><dt>Alcaldía</dt><dd>{item.alcaldia_propietario ? <><strong>{item.alcaldia_propietario}</strong><small>{[item.alcaldia_clave, item.alcaldia_caserio].filter(Boolean).join(" · ")}</small></> : <span>No aparece</span>}</dd></div>
      <div><dt>Aguas</dt><dd>{item.aguas_clave || item.aguas_abonado ? <><strong>{item.aguas_inquilino || "Sin nombre"}</strong><small>{[item.aguas_clave, item.aguas_abonado && `abonado ${item.aguas_abonado}`].filter(Boolean).join(" · ")}</small></> : <span>No aparece</span>}</dd></div>
    </dl>
    <p className="cl-banco-motivo"><Icon name="clipboard" />{item.motivo_dictamen}</p>
    {item.comentario_campo ? <p className="cl-report-finding">{item.comentario_campo}</p> : null}
    {item.nota_revision ? <p className="cl-banco-nota"><Icon name="warning" />{item.nota_revision}</p> : null}
    <footer>
      <div className="cl-report-meta">
        {item.latitude != null ? <a href={mapUrl(item)} target="_blank" rel="noreferrer"><Icon name="map" />Ver ubicación</a> : <span><Icon name="map" />Sin coordenadas</span>}
        <span><Icon name="pin" />QField #{item.origen_ref}</span>
        {item.estado === "descartado" ? <span><Icon name="archive" />Descartado: {item.motivo_descarte}</span> : null}
      </div>
      {canSend && !discarding ? <div className="cl-banco-actions">
        {!item.clave_catastral ? <label><span>Clave catastral</span><input value={clave} onChange={(event) => setClave(event.target.value)} placeholder="Ej. 89-13-15" /></label> : null}
        <button type="button" className="cl-quiet" disabled={busy} onClick={() => setDiscarding(true)}><Icon name="archive" />Descartar</button>
        <button type="button" className="cl-primary" disabled={busy || (!item.clave_catastral && !clave.trim())} onClick={() => onSend(item, clave)}><Icon name="send" />{busy ? "Verificando…" : "Enviar a ficha"}</button>
      </div> : null}
      {permissions.can_process_banco && pendiente && item.dictamen === "registrado" && !discarding ? <div className="cl-banco-actions"><button type="button" className="cl-quiet" disabled={busy} onClick={() => setDiscarding(true)}><Icon name="archive" />Descartar</button></div> : null}
      {discarding ? <form className="cl-banco-actions" onSubmit={(event) => { event.preventDefault(); onDiscard(item, motivo); }}>
        <label><span>Motivo del descarte</span><input autoFocus value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Ej. Registrado en Aguas, sin conexión" /></label>
        <button type="button" className="cl-quiet" onClick={() => { setDiscarding(false); setMotivo(""); }}>Cancelar</button>
        <button type="submit" className="cl-danger" disabled={busy || !motivo.trim()}><Icon name="archive" />Confirmar descarte</button>
      </form> : null}
      {item.estado === "enviado" && item.inmueble_id ? <div className="cl-banco-actions"><button type="button" className="cl-secondary" onClick={() => onOpenFicha(item)}><Icon name="eye" />Abrir ficha</button></div> : null}
      {item.estado === "descartado" && permissions.can_process_banco ? <div className="cl-banco-actions"><button type="button" className="cl-quiet" disabled={busy} onClick={() => onRestore(item)}><Icon name="refresh" />Devolver al banco</button></div> : null}
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
  const totalDictamenes = DICTAMENES.reduce((sum, [key]) => sum + Number(model.counts[key] || 0), 0);

  return <section className="cl-banco" aria-label="Banco de clandestinos">
    <header className="cl-inbox-head">
      <div><span className="cl-kicker">Levantamiento de campo</span><h2>Banco de clandestinos</h2><p>Puntos de campo verificados contra el padrón activo de Aguas y el de Alcaldía. Nada entra a Fichas hasta que lo envíes.</p></div>
      <div className="cl-banco-head-actions">
        {permissions.can_process_banco ? <button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={verify}><Icon name="refresh" />{working === "verify" ? "Verificando…" : "Verificar en padrones"}</button> : null}
        {permissions.can_import_banco ? <><input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => importFile(event.target.files?.[0])} /><button type="button" className="cl-secondary" disabled={Boolean(working)} onClick={() => fileInput.current?.click()}><Icon name="download" />{working === "import" ? "Importando…" : "Importar CSV"}</button></> : null}
      </div>
    </header>
    <div className="cl-indicators" role="group" aria-label="Filtrar por dictamen">
      <button type="button" aria-pressed={!model.filters.dictamen} className={!model.filters.dictamen ? "is-active" : ""} onClick={() => model.filters.setDictamen("")}><Icon name="inbox" /><span>Todos</span><strong>{totalDictamenes}</strong></button>
      {DICTAMENES.map(([key, label, hint, icon]) => <button type="button" key={key} title={hint} aria-pressed={model.filters.dictamen === key} className={model.filters.dictamen === key ? "is-active" : ""} onClick={() => model.filters.setDictamen(model.filters.dictamen === key ? "" : key)}><Icon name={icon} /><span>{label}</span><strong>{model.counts[key] || 0}</strong></button>)}
    </div>
    <div className="cl-toolbar">
      <label className="cl-search"><span>Buscar</span><div><Icon name="search" /><input value={model.filters.query} onChange={(event) => model.filters.setQuery(event.target.value)} placeholder="Clave, propietario, barrio o comentario" /></div></label>
      <label><span>Estado</span><select value={model.filters.estado} onChange={(event) => model.filters.setEstado(event.target.value)}>{ESTADOS.map(([value, label]) => <option key={value || "todos"} value={value}>{label}{value ? ` (${model.estados?.[value] || 0})` : ""}</option>)}</select></label>
      <label><span>Barrio</span><select value={model.filters.barrio} onChange={(event) => model.filters.setBarrio(event.target.value)}><option value="">Todos</option>{(model.barrios || []).map((item) => <option key={item}>{item}</option>)}</select></label>
      <button type="button" className="cl-quiet" onClick={model.filters.clear}><Icon name="refresh" />Limpiar</button>
    </div>
    {model.error ? <p className="cl-alert">{model.error}</p> : null}
    <div className={`cl-banco-list ${model.refreshing ? "is-refreshing" : ""}`.trim()} aria-busy={model.loading || model.refreshing}>
      {model.loading ? <p className="cl-empty">Cargando banco…</p> : model.items.length ? model.items.map((item) => <Candidato key={item.id} item={item} permissions={permissions} busy={busyId === item.id} onSend={send} onDiscard={discard} onRestore={restore} onOpenFicha={onOpenFicha} />) : <div className="cl-empty-state"><Icon name="inbox" /><strong>No hay candidatos con estos filtros</strong><span>{permissions.can_import_banco ? "Importa el CSV del levantamiento de QField para llenar el banco." : "Cuando administración importe un levantamiento de campo, aparecerá aquí."}</span></div>}
    </div>
    <footer className="cl-pagination"><span>{model.total} {model.total === 1 ? "candidato" : "candidatos"} · Página {model.page} de {model.total_pages}</span><div><button type="button" disabled={model.page <= 1} onClick={() => model.filters.setPage(model.page - 1)}><Icon name="arrowLeft" />Anterior</button><button type="button" disabled={model.page >= model.total_pages} onClick={() => model.filters.setPage(model.page + 1)}>Siguiente<Icon name="arrowRight" /></button></div></footer>
  </section>;
}
