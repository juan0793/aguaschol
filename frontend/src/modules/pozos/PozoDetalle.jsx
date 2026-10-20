import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/Icon";
import PozosMapa from "./PozosMapa";
import { RANGOS, conCalidad, formatoNumero, fueraDeRango } from "./pozosFiltros";

const NADA = () => {};
const Dato = ({ label, children, ancho = false }) => <div className={`pz-dato${ancho ? " is-ancho" : ""}`}><dt>{label}</dt><dd>{children ?? "—"}</dd></div>;
const conUnidad = (valor, unidad, decimales = 2) => (valor === null || valor === undefined ? null : `${formatoNumero(valor, decimales)} ${unidad}`);

function Medicion({ campo, label, valor, unidad = "", decimales = 2 }) {
  const fuera = fueraDeRango(campo, valor);
  const rango = RANGOS[campo];
  const hay = valor !== null && valor !== undefined;
  return <div className={`pz-medicion${fuera ? " is-fuera" : ""}`}>
    <dt>{label}</dt>
    <dd>
      <strong>{formatoNumero(valor, decimales)}</strong>{hay && unidad ? <span>{unidad}</span> : null}
      {rango && hay ? <small>{fuera ? <Icon name="warning" /> : null}{fuera ? "Fuera del valor guía" : "Dentro del valor guía"} ({rango.texto})</small> : null}
    </dd>
  </div>;
}

// Ficha de un pozo en el cajón del sistema (el mismo de Clandestinos e Inspecciones):
// se abre encima de la bandeja, así la lista no se mueve. Flechas ← → recorren la lista filtrada.
export default function PozoDetalle({ pozo, posicion, total, onAnterior, onSiguiente, onCerrar }) {
  const cerrarRef = useRef(null);
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

  return createPortal(<div className="cl-drawer-backdrop pz-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCerrar()}>
    <aside className="cl-drawer pz-drawer" role="dialog" aria-modal="true" aria-labelledby="pz-drawer-titulo">
      <header>
        <div className="pz-drawer-id">
          <h2 id="pz-drawer-titulo"><span className="pz-codigo">{pozo.codigo}</span>{pozo.nombre || "Sin nombre"}</h2>
          <p>{[pozo.colonia, pozo.municipio].filter(Boolean).join(" · ") || "Sin colonia"}</p>
          <div className="pz-estados">
            <span className={`cl-status ${pozo.en_uso ? "is-approved" : ""}`}><i />{pozo.en_uso ? "En uso" : "Sin dato de uso"}</span>
            <span className={`cl-status ${conCalidad(pozo) ? "is-review" : ""}`}><i />{conCalidad(pozo) ? "Calidad medida" : "Sin mediciones de calidad"}</span>
            {pozo.codigo_repetido ? <span className="cl-status is-info_requested"><i />Código repetido en otro pozo</span> : null}
            {!pozo.coordenada_valida ? <span className="cl-status is-info_requested"><i />Coordenada fuera de Choluteca</span> : null}
          </div>
        </div>
        <button ref={cerrarRef} type="button" className="cl-icon-button" onClick={onCerrar} aria-label="Cerrar ficha del pozo"><Icon name="close" /></button>
      </header>

      <div className="cl-drawer-scroll pz-drawer-cuerpo">
        <div className="pz-drawer-datos">
          <section aria-labelledby="pz-sec-calidad">
            <h3 id="pz-sec-calidad">Calidad del agua</h3>
            {!conCalidad(pozo) ? <p className="pz-sin-medir">No hay mediciones de calidad para este pozo.</p> : <dl className="pz-mediciones">
              <Medicion campo="ph" label="pH" valor={pozo.ph} />
              <Medicion campo="tds_g_l" label="Sólidos disueltos (TDS)" valor={pozo.tds_g_l} unidad="g/L" decimales={3} />
              <Medicion campo="salinidad" label="Salinidad" valor={pozo.salinidad} />
              <Medicion campo="temperatura_c" label="Temperatura" valor={pozo.temperatura_c} unidad="°C" decimales={1} />
              <Medicion campo="oxigeno_disuelto" label="Oxígeno disuelto" valor={pozo.oxigeno_disuelto} unidad="%" decimales={1} />
              <Medicion campo="cloro_residual" label="Cloro residual" valor={pozo.cloro_residual} />
              <div className="pz-medicion"><dt>Conductividad</dt><dd><strong>{pozo.conductividad || "—"}</strong></dd></div>
            </dl>}
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
          <button type="button" className="cl-secondary" onClick={onAnterior} disabled={!onAnterior}><Icon name="arrowLeft" />Anterior</button>
          <button type="button" className="cl-secondary" onClick={onSiguiente} disabled={!onSiguiente}>Siguiente<Icon name="arrowRight" /></button>
        </div>
      </footer>
    </aside>
  </div>, document.body);
}
