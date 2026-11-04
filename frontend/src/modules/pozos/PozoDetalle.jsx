import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/Icon";
import PozoQuimica from "./PozoQuimica";
import PozosMapa from "./PozosMapa";
import { conductividadDe, revisionesDelDato } from "./pozosQuimica";
import { ESTADOS_LEGALES, RANGOS, USOS_LEGALES, calidadDe, conCalidad, estadoLegalDe, etiquetaLegal, faltaDeclaracionDe, faltantesDe, formatoNumero, fueraDeRango, usoLegalDe } from "./pozosFiltros";

const NADA = () => {};
const Dato = ({ label, children, ancho = false }) => <div className={`pz-dato${ancho ? " is-ancho" : ""}`}><dt>{label}</dt><dd>{children ?? "—"}</dd></div>;
const conUnidad = (valor, unidad, decimales = 2) => (valor === null || valor === undefined ? null : `${formatoNumero(valor, decimales)} ${unidad}`);
const fechaInput = (valor) => valor ? String(valor).slice(0, 10) : "";
const valorLegal = (valor) => valor ?? "";
const USOS_PRODUCTIVOS = new Set(["industrial_comercial", "purificadora", "agroforestal", "sanitario", "turistico", "otro"]);

// Escala de pH y TDS: la banda es el valor guía y la marca, la medición del pozo.
const ESCALAS = { ph: { min: 4, max: 10 }, tds_g_l: { min: 0, max: 2 } };
function Escala({ campo, valor }) {
  const escala = ESCALAS[campo];
  const rango = RANGOS[campo];
  const pos = (numero) => `${((Math.min(Math.max(numero, escala.min), escala.max) - escala.min) / (escala.max - escala.min)) * 100}%`;
  const desde = rango.min ?? escala.min;
  return <span className="pz-escala" aria-hidden="true">
    <i className="pz-escala-guia" style={{ left: pos(desde), width: `calc(${pos(rango.max)} - ${pos(desde)})` }} />
    <i className="pz-escala-marca" style={{ left: pos(valor) }} />
  </span>;
}

// Cada medición es un botón: abre debajo su lectura (qué mide, la norma y qué significa).
function Medicion({ campo, label, valor, unidad = "", decimales = 2, detalle = "", revisar = false, activa, onElegir }) {
  const fuera = fueraDeRango(campo, valor);
  const rango = RANGOS[campo];
  const hay = valor !== null && valor !== undefined;
  return <li>
    <button type="button" className={`pz-medicion${fuera ? " is-fuera" : ""}${activa ? " is-activa" : ""}`} aria-expanded={activa} aria-controls={activa ? "pz-lectura-quimica" : undefined} disabled={!hay} onClick={() => onElegir(campo)}>
      <span className="pz-m-label">{label}{revisar ? <Icon name="warning" /> : null}</span>
      <span className="pz-m-valor"><strong>{formatoNumero(valor, decimales)}</strong>{hay && unidad ? <span>{unidad}</span> : null}</span>
      {detalle ? <span className="pz-m-detalle">{detalle}</span> : null}
      {rango && hay ? <Escala campo={campo} valor={valor} /> : null}
      {rango && hay ? <small>{fuera ? <Icon name="warning" /> : null}{fuera ? "Fuera del valor guía" : "Dentro del valor guía"} ({rango.texto})</small> : null}
      {hay ? <span className="pz-m-abrir" aria-hidden="true">{activa ? "Ocultar" : "Qué significa"}</span> : null}
    </button>
  </li>;
}

// Ficha de un pozo en el cajón del sistema (el mismo de Clandestinos e Inspecciones):
// se abre encima de la bandeja, así la lista no se mueve. Flechas ← → recorren la lista filtrada.
export default function PozoDetalle({ pozo, posicion, total, onAnterior, onSiguiente, onCerrar, onFicha, apiFetch, isAdmin, onLegalActualizado }) {
  const cerrarRef = useRef(null);
  const [lectura, setLectura] = useState(null);
  const [draft, setDraft] = useState({});
  const [errorLegal, setErrorLegal] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [padron, setPadron] = useState(null);
  useEffect(() => { setDraft(pozo?.legal || {}); setErrorLegal(""); }, [pozo]);
  useEffect(() => {
    const clave = pozo?.legal?.clave_catastral;
    setPadron(null);
    if (!clave || !apiFetch) return;
    let vigente = true;
    apiFetch(`/claves/search?field=clave&clave=${encodeURIComponent(clave)}`).then(async (r) => { if (!r.ok) throw new Error(); return r.json(); }).then((data) => { if (vigente) setPadron(data); }).catch(() => { if (vigente) setPadron({ error: true }); });
    return () => { vigente = false; };
  }, [pozo?.legal?.clave_catastral, apiFetch]);
  const guardarLegal = async (event) => {
    event.preventDefault(); setGuardando(true); setErrorLegal("");
    try {
      const response = await apiFetch(`/pozos/${pozo.id}/legal`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "No se pudo guardar.");
      onLegalActualizado(body.pozo || body);
    } catch (error) { setErrorLegal(error.message); } finally { setGuardando(false); }
  };
  useEffect(() => { setLectura(null); }, [pozo?.id]);
  const soloEste = useMemo(() => (pozo?.coordenada_valida ? [pozo] : []), [pozo]);

  useEffect(() => {
    const teclas = (event) => {
      if (event.key === "Escape") onCerrar();
      if (event.key === "ArrowLeft" && onAnterior) onAnterior();
      if (event.key === "ArrowRight" && onSiguiente) onSiguiente();
    };
    document.addEventListener("keydown", teclas);
    return () => document.removeEventListener("keydown", teclas);
  }, [onAnterior, onSiguiente, onCerrar]);
  useEffect(() => { cerrarRef.current?.focus(); }, []);

  if (!pozo) return null;
  const mapsUrl = pozo.coordenada_valida ? `https://www.google.com/maps?q=${pozo.latitud},${pozo.longitud}` : null;
  const faltan = faltantesDe(pozo);
  const conductividad = conductividadDe(pozo);
  const revisar = new Set(revisionesDelDato(pozo).map((aviso) => aviso.campo));
  const elegir = (campo) => setLectura((actual) => (actual === campo ? null : campo));
  const comun = (campo) => ({ campo, revisar: revisar.has(campo), activa: lectura === campo, onElegir: elegir });

  return createPortal(<div className="cl-drawer-backdrop pz-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCerrar()}>
    <aside className="cl-drawer pz-drawer" role="dialog" aria-modal="true" aria-labelledby="pz-drawer-titulo">
      <header>
        <div className="pz-drawer-id">
          <h2 id="pz-drawer-titulo"><span className="pz-codigo">{pozo.codigo}</span>{pozo.nombre || "Sin nombre"}</h2>
          <p>{[pozo.colonia, pozo.municipio].filter(Boolean).join(" · ") || "Sin colonia"}</p>
          <div className="pz-estados">
            <span className={`cl-status ${pozo.en_uso ? "is-approved" : ""}`}><i />{pozo.en_uso ? "En uso" : "Sin dato de uso"}</span>
            <span className={`cl-status ${{ dentro: "is-approved", fuera: "is-discarded", sin: "" }[calidadDe(pozo)]}`}><i />{{ dentro: "Dentro del valor guía", fuera: "Fuera del valor guía", sin: "Sin medición de calidad" }[calidadDe(pozo)]}</span>
            {pozo.codigo_repetido ? <span className="cl-status is-info_requested"><i />Código repetido en otro pozo</span> : null}
            {!pozo.coordenada_valida ? <span className="cl-status is-info_requested"><i />Coordenada fuera de Choluteca</span> : null}
          </div>
        </div>
        <button ref={cerrarRef} type="button" className="cl-icon-button" onClick={onCerrar} aria-label="Cerrar ficha del pozo"><Icon name="close" /></button>
      </header>

      <div className="cl-drawer-scroll pz-drawer-cuerpo">
        <div className="pz-drawer-datos">
          {faltan.length ? <p className="pz-faltan"><Icon name="flag" /><span><strong>Falta levantar:</strong> {faltan.join(", ")}.</span></p> : null}
          <section aria-labelledby="pz-sec-calidad">
            <h3 id="pz-sec-calidad">Calidad del agua</h3>
            {!conCalidad(pozo) ? <p className="pz-sin-medir">No hay mediciones de calidad para este pozo.</p> : <>
              <p className="pz-m-ayuda">Toca una medición para ver qué significa y qué dice la norma.</p>
              <ul className="pz-mediciones">
                <Medicion {...comun("ph")} label="pH" valor={pozo.ph} />
                <Medicion {...comun("tds_g_l")} label="Sólidos disueltos (TDS)" valor={pozo.tds_g_l} unidad="g/L" decimales={3} />
                <Medicion {...comun("conductividad")} label="Conductividad" valor={conductividad?.spc ?? null} unidad="µS/cm" decimales={0} detalle={conductividad ? `a 25 °C${conductividad.temperatura ? ` · ${formatoNumero(conductividad.temperatura, 0)} a la muestra` : ""}` : ""} />
                <Medicion {...comun("salinidad")} label="Salinidad" valor={pozo.salinidad} unidad="ppt" />
                <Medicion {...comun("temperatura_c")} label="Temperatura" valor={pozo.temperatura_c} unidad="°C" decimales={1} />
                <Medicion {...comun("oxigeno_disuelto")} label="Oxígeno disuelto" valor={pozo.oxigeno_disuelto} unidad="%" decimales={1} />
                <Medicion {...comun("cloro_residual")} label="Cloro residual" valor={pozo.cloro_residual} unidad="mg/L" />
              </ul>
              {lectura ? <PozoQuimica campo={lectura} pozo={pozo} onCerrar={() => setLectura(null)} /> : null}
            </>}
          </section>
          <section aria-labelledby="pz-sec-pozo">
            <h3 id="pz-sec-pozo">Pozo y bomba</h3>
            <dl className="pz-datos">
              <Dato label="Profundidad">{conUnidad(pozo.profundidad_m, "m")}</Dato>
              <Dato label="Nivel freático">{conUnidad(pozo.nivel_freatico_m, "m")}</Dato>
              <Dato label="Diámetro">{conUnidad(pozo.diametro_pulg, "pulg")}</Dato>
              <Dato label="Bomba" ancho>{pozo.tipo_bomba}</Dato>
            </dl>
          </section>
          <section aria-labelledby="pz-sec-legal">
            <h3 id="pz-sec-legal">Situación legal</h3>
            <dl className="pz-datos">
              <Dato label="Estado">{etiquetaLegal(ESTADOS_LEGALES, estadoLegalDe(pozo))}{faltaDeclaracionDe(pozo) ? " · Falta declaración" : ""}</Dato>
              <Dato label="Uso">{etiquetaLegal(USOS_LEGALES, usoLegalDe(pozo))}</Dato>
              <Dato label="Permiso">{pozo.legal?.permiso_tipo?.replaceAll("_", " ") || "Sin dato"}</Dato>
              <Dato label="Vence">{fechaInput(pozo.legal?.permiso_vence) || "—"}</Dato>
              <Dato label="Caudal autorizado">{conUnidad(pozo.legal?.caudal_autorizado_lps, "L/s")}</Dato>
              <Dato label="Volumen anual estimado">{conUnidad(pozo.legal?.volumen_estimado_m3, "m³")}</Dato>
              <Dato label="Canon anual estimado">{conUnidad(pozo.legal?.canon_estimado_l, "L")}</Dato>
            </dl>
            <p>Según el Reglamento ({pozo.legal?.articulo || "arts. 57 y 135"}). Verificar con el área legal.</p>
            {pozo.legal?.clave_catastral ? <p>Padrón: {padron?.error ? "No se pudo consultar" : !padron ? "Consultando…" : !padron.matches?.length ? "No existe en Aguas" : padron.matches.some((m) => String(m.agua).toUpperCase() === "S") ? "Existe y tiene servicio de agua" : "Existe sin servicio de agua"}{padron && !padron.error && USOS_PRODUCTIVOS.has(pozo.legal.uso) && !padron.matches?.some((m) => String(m.agua).toUpperCase() === "S") ? " · Posible cliente / revisar" : ""}</p> : null}
            {isAdmin ? <details><summary>Editar situación legal</summary>
              <form onSubmit={guardarLegal} className="pz-legal-form">
                <p>Uso sugerido por el nombre: {etiquetaLegal(USOS_LEGALES, pozo.legal?.uso_sugerido || "sin_dato")}. Confírmalo antes de guardar.</p>
                {[["uso", "Uso", USOS_LEGALES], ["tamano_empresa", "Tamaño de empresa", [["no_aplica", "No aplica"], ["micro_pequena", "Micro o pequeña"], ["mediana_grande", "Mediana o grande"]]], ["permiso_tipo", "Tipo de permiso", [["sin_dato", "Sin dato"], ["ninguno", "Ninguno"], ["permiso_municipal", "Permiso municipal"], ["licencia_municipal", "Licencia municipal"], ["concesion", "Concesión"], ["en_tramite", "En trámite"]]]].map(([campo, etiqueta, opciones]) => <label key={campo}>{etiqueta}<select value={draft[campo] || opciones[0][0]} onChange={(e) => setDraft({ ...draft, [campo]: e.target.value })}>{opciones.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}</select></label>)}
                {[["clave_catastral", "Clave catastral", "text"], ["titular", "Titular", "text"], ["permiso_numero", "Número de permiso", "text"], ["permiso_fecha", "Fecha del permiso", "date"], ["permiso_vence", "Vencimiento", "date"], ["caudal_autorizado_lps", "Caudal autorizado (L/s)", "number"], ["caudal_lps", "Caudal estimado (L/s)", "number"], ["horas_bombeo_dia", "Horas de bombeo al día", "number"], ["dias_mes", "Días al mes", "number"], ["volumen_declarado_m3", "Volumen declarado (m³)", "number"], ["anio_declarado", "Año declarado", "number"], ["notas", "Notas", "text"]].map(([campo, etiqueta, tipo]) => <label key={campo}>{etiqueta}<input type={tipo} min={tipo === "number" ? 0 : undefined} step={tipo === "number" ? "any" : undefined} value={tipo === "date" ? fechaInput(draft[campo]) : valorLegal(draft[campo])} onChange={(e) => setDraft({ ...draft, [campo]: e.target.value })} /></label>)}
                {errorLegal ? <p role="alert">{errorLegal}</p> : null}<button className="cl-primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar situación legal"}</button>
              </form>
            </details> : null}
          </section>
          <section aria-labelledby="pz-sec-ubicacion">
            <h3 id="pz-sec-ubicacion">Ubicación</h3>
            <dl className="pz-datos">
              <Dato label="UTM 16N">{`${formatoNumero(pozo.utm_x, 0)} E · ${formatoNumero(pozo.utm_y, 0)} N`}</Dato>
              <Dato label="Latitud, longitud">{pozo.coordenada_valida ? `${pozo.latitud.toFixed(6)}, ${pozo.longitud.toFixed(6)}` : "No se puede ubicar: la Y tiene un dígito de más"}</Dato>
              <Dato label="Elevación">{conUnidad(pozo.elevacion_m, "m", 0)}</Dato>
            </dl>
          </section>
          {pozo.observaciones ? <section aria-labelledby="pz-sec-obs"><h3 id="pz-sec-obs">Observaciones</h3><p className="pz-observaciones">{pozo.observaciones}</p></section> : null}
        </div>
        <div className="pz-drawer-mapa">
          {soloEste.length ? <PozosMapa pozos={soloEste} seleccionadoId={pozo.id} onSeleccionar={NADA} compacto /> : <div className="pz-sin-mapa"><Icon name="map" /><strong>Sin ubicación en el mapa</strong><span>La coordenada de la fuente cae fuera de Choluteca. Corrígela en el shapefile para verlo aquí.</span></div>}
          {mapsUrl ? <a className="cl-secondary pz-maps" href={mapsUrl} target="_blank" rel="noreferrer"><Icon name="map" />Abrir en Google Maps</a> : null}
        </div>
      </div>

      <footer className="pz-drawer-pie">
        <span>Pozo {posicion} de {total} en la lista</span>
        <div>
          <button type="button" className="cl-secondary pz-ficha-pdf" onClick={onFicha} disabled={!onFicha}><Icon name="print" />{onFicha ? "Ficha PDF" : "Generando…"}</button>
          <button type="button" className="cl-secondary" onClick={onAnterior} disabled={!onAnterior}><Icon name="arrowLeft" />Anterior</button>
          <button type="button" className="cl-secondary" onClick={onSiguiente} disabled={!onSiguiente}>Siguiente<Icon name="arrowRight" /></button>
        </div>
      </footer>
    </aside>
  </div>, document.body);
}
