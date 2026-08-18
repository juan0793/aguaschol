import { formatDate, resultadoIntentoLabel } from "../utils/entregasFormatters";

// Línea de tiempo del seguimiento: cada intento se conserva, nunca se sobrescribe.
export default function IntentosTimeline({ documento }) {
  const eventos = [
    {
      id: "origen",
      fecha: documento.fecha_lote,
      titulo: "No entregada",
      detalle: documento.motivo_etiqueta || documento.motivo,
      responsable: documento.responsable_nombre,
      observacion: documento.observacion
    },
    ...(documento.intentos_detalle || []).map((intento, index) => ({
      id: intento.id,
      fecha: intento.fecha,
      titulo: `Intento ${index + 1}`,
      detalle: resultadoIntentoLabel(intento.resultado),
      responsable: intento.responsable_nombre,
      observacion: intento.observacion
    }))
  ];

  return (
    <ul className="cl-history ent-timeline">
      {eventos.map((evento) => (
        <li key={evento.id}>
          <i />
          <div>
            <strong>
              {formatDate(evento.fecha)} · {evento.titulo}
            </strong>
            <span>
              {evento.detalle}
              {evento.responsable ? ` · ${evento.responsable}` : ""}
            </span>
            {evento.observacion ? <small>{evento.observacion}</small> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
