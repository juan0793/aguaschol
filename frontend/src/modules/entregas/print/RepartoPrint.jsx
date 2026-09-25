import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { Seccion } from "./WeeklyReportBlocks";
import RepartoMapa from "../components/RepartoMapa";
import { formatDateTime, formatNumber } from "../utils/entregasFormatters";
import { barriosDeResponsable, desvioEnFrase, formatoDesvio, tramoDeCarga } from "../utils/repartoUtils";
import "./repartoPrintStyles.css";

const Encabezado = ({ titulo, subtitulo }) => (
  <header className="ent-hoja-head">
    <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
    <div className="ent-hoja-head-texto">
      <span>Aguas de Choluteca · Control de entregas</span>
      <h1>{titulo}</h1>
      <p>{subtitulo}</p>
    </div>
  </header>
);

// Hoja de una persona: la lleva a campo, así que va su lista de barrios en orden
// de entrega, su zona resaltada en el mapa y la firma de recibido.
function HojaPersona({ persona, reparto, generadoEn }) {
  const { barrios, participantes, colores, totales, meta, mapa } = reparto;
  const suyos = barriosDeResponsable(barrios, persona.id);
  const total = totales.get(Number(persona.id)) || { claves: 0, barrios: 0 };
  return (
    <article className="ent-hoja ent-hoja-reparto">
      <Encabezado titulo="Barrios asignados para entrega" subtitulo={persona.nombre_completo} />
      <section className="ent-hoja-datos">
        <div><span>Responsable</span><strong>{persona.nombre_completo}</strong></div>
        <div><span>Barrios</span><strong>{formatNumber(total.barrios)}</strong></div>
        <div><span>Claves en el padrón</span><strong>{formatNumber(total.claves)}{meta ? ` (${desvioEnFrase(total.claves, meta)})` : ""}</strong></div>
      </section>
      <div className="ent-reparto-hoja-cuerpo">
        <Seccion titulo="Orden de entrega" descripcion="Los barrios sin número de ruta van al final, de mayor a menor carga." ancha>
          <table className="ent-hoja-tabla">
            <thead>
              <tr>
                <th className="is-num">N.º</th>
                <th>Código</th>
                <th>Barrio</th>
                <th className="is-num">Claves</th>
                <th>Entregado</th>
              </tr>
            </thead>
            <tbody>
              {suyos.map((barrio, indice) => (
                <tr key={barrio.codigo}>
                  <td className="is-num">{barrio.orden_ruta || indice + 1}</td>
                  <td className="is-clave">{barrio.codigo}</td>
                  <td>{barrio.nombre}</td>
                  <td className="is-num">{formatNumber(barrio.claves)}</td>
                  <td className="ent-reparto-casilla" aria-label="Casilla para marcar" />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3}>Total</th>
                <th className="is-num">{formatNumber(total.claves)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
        </Seccion>
        <div className="ent-reparto-hoja-mapa">
          <RepartoMapa impreso mapa={mapa} barrios={barrios} participantes={participantes} colores={colores} totales={totales} meta={meta} resaltado={persona.id} titulo={`Zona de ${persona.nombre_completo}`} />
          <p className="ent-hoja-nota">La zona de {persona.nombre_completo.split(" ")[0]} va en color; el resto, atenuado.</p>
        </div>
      </div>
      <section className="ent-hoja-firmas">
        <div><i /><span>Entrega la zona</span><small>Control de entregas</small></div>
        <div><i /><span>Recibe</span><small>{persona.nombre_completo}</small></div>
        <div><i /><span>Fecha</span><small>Día / mes / año</small></div>
      </section>
      <footer className="ent-hoja-pie">
        <span>Reparto por barrio · {persona.nombre_completo}</span>
        <span>Meta por persona: {formatNumber(meta)} claves</span>
        <span>Generado: {formatDateTime(generadoEn)}</span>
      </footer>
    </article>
  );
}

// Hoja general: el mapa con todas las zonas y la tabla de cargas contra la meta.
function HojaGeneral({ reparto, generadoEn }) {
  const { barrios, participantes, colores, totales, meta, mapa, sinAsignar } = reparto;
  const sinAsignarLista = barrios.filter((barrio) => !barrio.responsable_id && barrio.claves > 0).sort((a, b) => b.claves - a.claves);
  return (
    <article className="ent-hoja ent-hoja-reparto">
      <Encabezado titulo="Reparto de barrios por persona" subtitulo={`${formatNumber(participantes.length)} personas · meta de ${formatNumber(meta)} claves cada una`} />
      <div className="ent-reparto-hoja-mapa is-general">
        <RepartoMapa impreso mapa={mapa} barrios={barrios} participantes={participantes} colores={colores} totales={totales} meta={meta} titulo="Zonas de entrega" />
      </div>
      <Seccion titulo="Carga por persona" descripcion="Claves del padrón en los barrios de cada persona, frente a la meta pareja.">
        <table className="ent-hoja-tabla">
          <thead>
            <tr>
              <th>Persona</th>
              <th className="is-num">Barrios</th>
              <th className="is-num">Claves</th>
              <th className="is-num">Frente a la meta</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {participantes.map((persona) => {
              const total = totales.get(Number(persona.id)) || { claves: 0, barrios: 0 };
              return (
                <tr key={persona.id}>
                  <td><i className="ent-reparto-muestra" style={{ background: colores.get(Number(persona.id)) }} />{persona.nombre_completo}</td>
                  <td className="is-num">{formatNumber(total.barrios)}</td>
                  <td className="is-num">{formatNumber(total.claves)}</td>
                  <td className="is-num">{formatoDesvio(total.claves, meta)}</td>
                  <td>{tramoDeCarga(total.claves, meta).etiqueta}</td>
                </tr>
              );
            })}
          </tbody>
          {sinAsignar.barrios ? (
            <tfoot>
              <tr>
                <th>Sin asignar</th>
                <th className="is-num">{formatNumber(sinAsignar.barrios)}</th>
                <th className="is-num">{formatNumber(sinAsignar.claves)}</th>
                <th colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </Seccion>
      {sinAsignarLista.length ? (
        <p className="ent-hoja-nota">
          Sin asignar: {sinAsignarLista.slice(0, 12).map((barrio) => `${barrio.nombre} (${formatNumber(barrio.claves)})`).join(", ")}
          {sinAsignarLista.length > 12 ? ` y ${sinAsignarLista.length - 12} más.` : "."}
        </p>
      ) : null}
      <footer className="ent-hoja-pie">
        <span>Reparto por barrio</span>
        <span>{formatNumber(barrios.reduce((suma, barrio) => suma + barrio.claves, 0))} claves en el padrón</span>
        <span>Generado: {formatDateTime(generadoEn)}</span>
      </footer>
    </article>
  );
}

export default function RepartoPrint({ reparto, responsableId = null, generadoEn }) {
  if (!reparto?.barrios?.length) return null;
  const personas = reparto.participantes.filter((persona) =>
    responsableId ? Number(persona.id) === Number(responsableId) : (reparto.totales.get(Number(persona.id))?.barrios || 0) > 0
  );
  return (
    <div className="ent-hojas">
      {responsableId ? null : <HojaGeneral reparto={reparto} generadoEn={generadoEn} />}
      {personas.map((persona) => (
        <HojaPersona key={persona.id} persona={persona} reparto={reparto} generadoEn={generadoEn} />
      ))}
    </div>
  );
}
