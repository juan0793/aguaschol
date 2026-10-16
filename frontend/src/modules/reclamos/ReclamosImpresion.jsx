import logoAguasCholuteca from "../../assets/logo-aguas-choluteca.png";
import { ESTADOS, documentos, fechaHora, nombrePropio, origenTexto } from "./reclamosFormato";
import "./reclamosImpresion.css";

const valor = (texto) => (String(texto ?? "").trim() ? texto : "--");

// Ficha impresa de un reclamo: documento de oficina para entregar al técnico o
// archivar. Cada ficha lleva su encabezado para poder separarse; varias fichas
// comparten hoja si caben y ninguna se parte entre dos páginas. Sin <header> ni
// <footer>: la regla global de impresión los oculta.
export default function ReclamosImpresion({ reclamos = [], impresoPor = "", impresoEn = "" }) {
  return (
    <div className="rc-imp">
      {reclamos.map((reclamo) => {
        const estado = ESTADOS[reclamo.estado] || ESTADOS.SIN_RESPUESTA;
        return (
          <article key={reclamo.id} className="rc-imp-ficha">
            <div className="rc-imp-cabeza">
              <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
              <div className="rc-imp-titulo">
                <span>Aguas de Choluteca · Control de entregas</span>
                <h1>Reclamo de entrega #{reclamo.id}</h1>
              </div>
              <div className="rc-imp-estado">
                <strong>{estado.label}</strong>
                <span>Registrado el {fechaHora(reclamo.created_at)}</span>
              </div>
            </div>

            <table className="rc-imp-datos">
              <tbody>
                <tr>
                  <th>Abonado</th>
                  <td colSpan={3} className="is-nombre">{reclamo.abonado_nombre ? nombrePropio(reclamo.abonado_nombre) : "--"}</td>
                </tr>
                <tr>
                  <th>Clave catastral</th>
                  <td className="is-num">{valor(reclamo.clave_catastral)}</td>
                  <th>N.º de abonado</th>
                  <td className="is-num">{valor(reclamo.numero_abonado)}</td>
                </tr>
                <tr>
                  <th>Barrio</th>
                  <td>{valor(reclamo.barrio_nombre)}</td>
                  <th>Documento</th>
                  <td>{documentos(reclamo.cantidad, reclamo.tipo_documento)}</td>
                </tr>
                <tr>
                  <th>Motivo</th>
                  <td>{valor(reclamo.motivo_etiqueta)}</td>
                  <th>Registrado por</th>
                  <td>{valor(reclamo.created_by_nombre)}</td>
                </tr>
                <tr>
                  <th>Técnico responsable</th>
                  <td colSpan={3}>
                    <strong>{reclamo.responsable?.nombre || "Sin técnico asignado"}</strong>
                    <span className="rc-imp-origen"> · {origenTexto({ origen: reclamo.responsable_origen, lote: reclamo.lote })}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="rc-imp-bloque">
              <h2>Lo que dijo el abonado</h2>
              <p>{valor(reclamo.detalle)}</p>
            </div>

            <div className="rc-imp-bloque">
              <h2>Respuesta del técnico</h2>
              {reclamo.respuesta ? (
                <>
                  <p>{reclamo.respuesta}</p>
                  <p className="rc-imp-meta">
                    {reclamo.respondido_por_nombre || "El técnico"} · {fechaHora(reclamo.respondido_en)}
                  </p>
                </>
              ) : (
                <div className="rc-imp-renglones" aria-label="Espacio para escribir la respuesta">
                  <i /><i /><i />
                </div>
              )}
              {reclamo.estado === "CERRADO" ? (
                <p className="rc-imp-meta">Archivado por {reclamo.cerrado_por_nombre || "la oficina"} · {fechaHora(reclamo.cerrado_en)}</p>
              ) : null}
            </div>

            <div className="rc-imp-firmas">
              <div><i /><span>Técnico responsable</span><small>{reclamo.responsable?.nombre || "Nombre y firma"}</small></div>
              <div><i /><span>Oficina</span><small>Nombre y firma</small></div>
            </div>

            <div className="rc-imp-pie">
              <span>Impreso el {impresoEn}{impresoPor ? ` por ${impresoPor}` : ""}</span>
              <span>Control Aguas</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
