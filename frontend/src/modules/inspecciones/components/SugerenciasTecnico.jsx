// Tecnicos sugeridos para una inspeccion segun el reparto de barrios de Control de
// entregas (ver GET /inspecciones/sugerencia-tecnico). Solo ayuda a elegir: el
// selector de siempre sigue debajo.

const formatDistancia = (metros) =>
  metros < 1000 ? `${metros} m` : `${(metros / 1000).toLocaleString("es-HN", { maximumFractionDigits: 1 })} km`;

export default function SugerenciasTecnico({ sugerencia, selectedId, onSelect }) {
  if (!sugerencia) return null;
  return (
    <>
      {sugerencia.sugerencias?.length ? (
        <div className="ins-sugerencias" role="group" aria-label={`Técnicos cercanos a ${sugerencia.barrio_nombre}`}>
          {sugerencia.sugerencias.map((item, index) => (
            <button
              key={item.tecnico_id}
              type="button"
              className={`ins-sugerencia ${String(selectedId) === String(item.tecnico_id) ? "is-active" : ""}`}
              aria-pressed={String(selectedId) === String(item.tecnico_id)}
              onClick={() => onSelect(item.tecnico_id)}
            >
              <strong>
                {item.nombre}
                {index === 0 ? <span className="ins-sugerencia-tag">Sugerido</span> : null}
              </strong>
              <small>
                {item.es_su_zona
                  ? `${sugerencia.barrio_nombre} está en su zona`
                  : `Atiende ${item.barrio_cercano_nombre}, a ${formatDistancia(item.distancia_m)}`}
              </small>
              <em>{item.inspecciones_activas} {item.inspecciones_activas === 1 ? "activa" : "activas"}</em>
            </button>
          ))}
        </div>
      ) : null}
      {sugerencia.aviso ? <p className="ins-sugerencia-aviso">{sugerencia.aviso}</p> : null}
    </>
  );
}
