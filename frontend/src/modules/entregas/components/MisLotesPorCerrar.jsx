import { Icon } from "../../../components/Icon";
import { formatNumber, tipoDocumentoLabel } from "../utils/entregasFormatters";

// Lo primero que ve un técnico en "Hoy": sus lotes abiertos con el botón de
// cerrar a mano, sin bajar por el avance, los filtros y la tabla.
export default function MisLotesPorCerrar({ lotes = [], propioId, onCerrar, onAbrir }) {
  if (!lotes.length) return null;
  // Si hay lotes de otra persona (sin usuario en la app), cada fila dice de quién es.
  const deOtros = lotes.some((lote) => Number(lote.responsable_id) !== Number(propioId));
  return (
    <section className="ent-mis-lotes" aria-labelledby="ent-mis-lotes-titulo">
      <h3 id="ent-mis-lotes-titulo">{deOtros ? `Por cerrar hoy · ${formatNumber(lotes.length)}` : lotes.length === 1 ? "Tu lote por cerrar" : `Tus ${formatNumber(lotes.length)} lotes por cerrar`}</h3>
      <ul>
        {lotes.map((lote) => (
          <li key={lote.id}>
            <button type="button" className="ent-mis-lotes-info" onClick={() => onAbrir(lote)} aria-label={`Ver el lote ${lote.id} de ${lote.barrio_nombre || "sin barrio"}`}>
              <strong>{lote.barrio_nombre || "Sin barrio"}</strong>
              <small>{deOtros ? `${Number(lote.responsable_id) === Number(propioId) ? "Tuyo" : lote.responsable_nombre} · ` : ""}#{lote.id} · {tipoDocumentoLabel(lote.tipo_documento)} · {formatNumber(lote.total_asignadas)} asignadas</small>
            </button>
            <button type="button" className="cl-primary" onClick={() => onCerrar(lote)}>
              Cerrar lote
              <Icon name="arrowRight" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
