import StatusMark from "../../../components/micro/StatusMark";
import { formatDate, resultadoIntentoLabel } from "../utils/entregasFormatters";

// Cada resultado de intento tiene un glifo: entregado cierra el caso (tick
// verde), no localizado es un fallo firme (aspa roja) y los demás son intentos
// sin exito que no descartan al abonado (aspa ambar).
const NO_LOCALIZADO = { estado: "failed", color: "var(--danger, #b42332)" };
const SIN_EXITO = { estado: "failed", color: "var(--alert, #925a08)" };
const MARCA_INTENTO = {
  ENTREGADO: { estado: "done" },
  NO_LOCALIZADO,
  SIN_RESPUESTA: SIN_EXITO,
  CASA_CERRADA: SIN_EXITO,
  OTRO: SIN_EXITO
};

const marcaIntento = (resultado) => MARCA_INTENTO[resultado] || { estado: "pending" };

// Línea de tiempo del seguimiento: cada intento se conserva, nunca se sobrescribe.
export default function IntentosTimeline({ documento }) {
  const eventos = [
    {
      id: "origen",
      fecha: documento.fecha_lote,
      titulo: "No entregada",
      detalle: documento.motivo_etiqueta || documento.motivo,
      responsable: documento.responsable_nombre,
      observacion: documento.observacion,
      estado: NO_LOCALIZADO.estado,
      color: NO_LOCALIZADO.color,
      estadoTexto: "No entregada"
    },
    ...(documento.intentos_detalle || []).map((intento, index) => {
      const marca = marcaIntento(intento.resultado);
      return {
        id: intento.id,
        fecha: intento.fecha,
        titulo: `Intento ${index + 1}`,
        detalle: resultadoIntentoLabel(intento.resultado),
        responsable: intento.responsable_nombre,
        observacion: intento.observacion,
        estado: marca.estado,
        color: marca.color,
        estadoTexto: resultadoIntentoLabel(intento.resultado)
      };
    })
  ];

  return (
    <ul className="cl-history ent-timeline">
      {eventos.map((evento) => (
        <li key={evento.id}>
          <StatusMark status={evento.estado} errorColor={evento.color} spokenStatus={evento.estadoTexto} size={18} />
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
