// Listado de campo del banco de clandestinos (carta horizontal). Solo lleva
// candidatos por convertir en ficha: los que ya aparecen en Aguas nunca se imprimen.

export const DICTAMENES_IMPRIMIBLES = ["clandestino", "probable", "sin_determinar"];

// Sin dictamen elegido se imprimen solo los clandestinos; si el filtro es
// "registrado en Aguas" también se vuelve a clandestinos.
export const dictamenParaImprimir = (dictamen = "") => (DICTAMENES_IMPRIMIBLES.includes(dictamen) ? dictamen : "clandestino");

const DICTAMEN = {
  clandestino: ["●", "Clandestino", "is-c"],
  probable: ["▲", "Probable", "is-p"],
  sin_determinar: ["?", "Sin determinar", "is-s"]
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export const BANCO_PRINT_STYLES = `<style>
  @page { @bottom-right { content: "Hoja " counter(page) " de " counter(pages); font: 8.5px Arial, sans-serif; color: #52606d; } }
  .bl { color: #111; font: 9.6px/1.3 Arial, Helvetica, sans-serif; }
  .bl-brand { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 7px; border-bottom: 2px solid #102a43; }
  .bl-brand strong { display: block; font-size: 14px; letter-spacing: .03em; }
  .bl-brand small { color: #52606d; font-size: 9.5px; }
  .bl-brand .bl-right { text-align: right; }
  .bl-brand .bl-right strong { font-size: 13px; }
  .bl-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 18px; margin: 8px 0 6px; }
  .bl-meta p { margin: 0; }
  .bl-meta span { margin-right: 4px; color: #52606d; font-size: 8px; letter-spacing: .06em; text-transform: uppercase; }
  .bl-sum { display: flex; flex-wrap: wrap; gap: 14px; margin: 0 0 8px; padding: 6px 8px; border: 1px solid #cbd5df; background: #f5f8fb; }
  .bl table { width: 100%; border-collapse: collapse; table-layout: fixed; font: 9.6px/1.3 Arial, Helvetica, sans-serif; color: #111; }
  .bl td { font-size: 9.6px; }
  .bl th, .bl td { padding: 4px 5px; border: 1px solid #cbd5df; text-align: left; vertical-align: top; }
  .bl th { background: #edf3f8; font-size: 8.4px; letter-spacing: .04em; text-transform: uppercase; }
  .bl thead { display: table-header-group; }
  .bl tr { break-inside: avoid; }
  .bl tr.bl-grp td { padding: 5px 6px; border-top: 1.5px solid #102a43; background: #f0f3f6; }
  .bl tr.bl-grp span { float: right; color: #52606d; }
  .bl .bl-num { color: #52606d; text-align: right; }
  .bl .bl-clave, .bl .bl-qf { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .bl .bl-clave { font-size: 10.4px; font-weight: 700; }
  .bl em { color: #7b8794; font-style: normal; }
  .bl .bl-prop { font-size: 9px; text-transform: uppercase; }
  .bl .bl-dic { font-weight: 700; white-space: nowrap; }
  .bl .is-c { color: #9b202d; } .bl .is-p { color: #8a5a0b; } .bl .is-s { color: #52606d; }
  .bl .bl-serv { white-space: nowrap; }
  .bl .bl-serv i { display: inline-block; min-width: 12px; margin-right: 1px; padding: 0 2px; border: 1px solid #cbd5df; color: #b0bac5; font-size: 8.5px; font-style: normal; text-align: center; }
  .bl .bl-serv i.on { border-color: #102a43; color: #102a43; font-weight: 700; }
  .bl .bl-hall { font-size: 9px; }
  .bl .bl-chk span { display: block; width: 11px; height: 11px; margin: 1px auto; border: 1.2px solid #334e68; }
  .bl-legend { margin-top: 6px; color: #52606d; font-size: 8.5px; }
  .bl-sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; margin-top: 26px; break-inside: avoid; }
  .bl-sign div { padding-top: 5px; border-top: 1px solid #334e68; color: #52606d; text-align: center; }
  .bl-foot { margin-top: 10px; color: #52606d; font-size: 8.5px; }
</style>`;

const fechaLarga = (date) => date.toLocaleString("es-HN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * items: candidatos ya filtrados (se descartan aquí los registrados en Aguas por si acaso).
 * filtros: { estado, dictamen, barrio, query, asignadoNombre }
 */
export const buildBancoListado = (items = [], filtros = {}, now = new Date()) => {
  const rows = items.filter((item) => item.dictamen !== "registrado");
  const grupos = new Map();
  rows.forEach((item) => {
    const barrio = item.barrio_colonia || "Sin barrio";
    if (!grupos.has(barrio)) grupos.set(barrio, []);
    grupos.get(barrio).push(item);
  });
  const conteo = Object.fromEntries(Object.keys(DICTAMEN).map((key) => [key, rows.filter((item) => item.dictamen === key).length]));
  let numero = 0;
  const cuerpo = [...grupos.entries()].map(([barrio, lista]) => {
    const filas = lista.map((item) => {
      numero += 1;
      const [simbolo, etiqueta, clase] = DICTAMEN[item.dictamen] || ["?", item.dictamen, "is-s"];
      const aguas = item.aguas_clave || (item.aguas_abonado ? `Ab. ${item.aguas_abonado}` : "—");
      const servicios = [["agua", "A"], ["alcantarillado", "Al"], ["desechos", "D"]].map(([key, label]) => `<i class="${item[key] ? "on" : ""}">${label}</i>`).join("");
      const comentario = String(item.comentario_campo || "").trim();
      const hallazgo = comentario && comentario !== item.clave_catastral ? escapeHtml(comentario) : "<em>—</em>";
      return `<tr><td class="bl-num">${numero}</td><td class="bl-clave">${item.clave_catastral ? escapeHtml(item.clave_catastral) : "<em>Sin clave</em>"}</td><td><span class="bl-dic ${clase}">${simbolo} ${etiqueta}</span></td><td class="bl-prop">${item.alcaldia_propietario ? escapeHtml(item.alcaldia_propietario) : "<em>No aparece</em>"}</td><td>${escapeHtml(aguas)}</td><td class="bl-serv">${servicios}</td><td class="bl-hall">${hallazgo}</td><td class="bl-qf">#${escapeHtml(item.origen_ref)}</td><td class="bl-chk"><span></span></td><td></td></tr>`;
    }).join("");
    return `<tr class="bl-grp"><td colspan="10"><strong>${escapeHtml(barrio)}</strong><span>${lista.length} ${lista.length === 1 ? "candidato" : "candidatos"}</span></td></tr>${filas}`;
  }).join("");
  const resumen = Object.entries(DICTAMEN).filter(([key]) => conteo[key]).map(([key, [simbolo, etiqueta, clase]]) => `<span class="bl-dic ${clase}">${simbolo} ${etiqueta} <b>${conteo[key]}</b></span>`).join("");
  const asignado = filtros.asignadoNombre ? escapeHtml(filtros.asignadoNombre) : "______________________________";
  return `<article class="bl">
    <header class="bl-brand"><div><strong>AGUAS DE CHOLUTECA</strong><small>Departamento de Comercialización · Unidad Técnica de Catastro</small></div><div class="bl-right"><strong>Listado de campo · Banco de clandestinos</strong><small>Impreso el ${escapeHtml(fechaLarga(now))}</small></div></header>
    <div class="bl-meta"><p><span>Estado</span>${escapeHtml(filtros.estadoLabel || "Por revisar")}</p><p><span>Dictamen</span>${escapeHtml(DICTAMEN[filtros.dictamen]?.[1] || "Clandestino")}</p><p><span>Barrio</span>${escapeHtml(filtros.barrio || "Todos")}</p><p><span>Búsqueda</span>${escapeHtml(filtros.query || "—")}</p><p><span>Asignado a</span>${asignado}</p></div>
    <div class="bl-sum"><strong>${rows.length} ${rows.length === 1 ? "candidato" : "candidatos"}</strong>${resumen}</div>
    <table><colgroup><col style="width:3.2%"><col style="width:8.5%"><col style="width:10%"><col style="width:16.5%"><col style="width:8.5%"><col style="width:7.8%"><col style="width:19%"><col style="width:5.5%"><col style="width:5%"><col style="width:16%"></colgroup>
      <thead><tr><th>#</th><th>Clave catastral</th><th>Dictamen</th><th>Propietario (Alcaldía)</th><th>Aguas</th><th>Servicios</th><th>Hallazgo de campo</th><th>QField</th><th>Visitado</th><th>Observación del técnico</th></tr></thead>
      <tbody>${cuerpo}</tbody></table>
    <p class="bl-legend">Servicios observados: <b>A</b> agua potable · <b>Al</b> alcantarillado · <b>D</b> desechos sólidos (marcado = sí). Dictamen: ● solo en Alcaldía · ▲ el lote está en Aguas, la unidad no · ? sin clave o fuera de ambos padrones. No incluye predios registrados en Aguas.</p>
    <div class="bl-sign"><div>Técnico de campo</div><div>Fecha de visita</div><div>Revisado por (Comercialización)</div></div>
    <p class="bl-foot">Documento generado desde Control Aguas · Banco de clandestinos</p>
  </article>`;
};
