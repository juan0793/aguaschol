import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { formatDate, formatDateTime, formatLempiras, formatNumber } from "../utils/entregasFormatters";
import { NIVELES, agruparPorTecnico, resumenPrioridad, textoCarga, textoFiltros, textoMotivos } from "../utils/prioridadBarrios.js";
import "./loteSobrantesStyles.css";
import "./prioridadPrint.css";

// Hoja de barrios por prioridad: lo que falta del ciclo, del más urgente al menos,
// con su técnico, el motivo, la carga y una casilla para marcar en campo. La mora
// solo sale para administración y Gerencia.
export default function PrioridadPrint({ hoja }) {
  if (!hoja) return null;
  const { barrios, opciones, datos, generadoEn } = hoja;
  const { conMora, agrupar, tecnicoNombre } = opciones;
  const resumen = resumenPrioridad(barrios);
  const grupos = agrupar ? agruparPorTecnico(barrios) : [{ id: "todos", nombre: "", barrios, documentos: resumen.documentos }];
  const conTecnico = !tecnicoNombre && !agrupar;
  const periodo = `${datos.ciclo_declarado ? "Ciclo" : "Mes"} desde el ${formatDate(datos.desde)} · al ${formatDate(datos.hoy)}`;
  const columnas = 6 + (conTecnico ? 1 : 0) + (conMora ? 1 : 0);

  return (
    <div className="ent-hojas">
      <article className="ent-hoja ent-prio-hoja">
        <header className="ent-hoja-head">
          <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
          <div className="ent-hoja-head-texto">
            <span>Aguas de Choluteca · Control de entregas</span>
            <h1>Barrios por prioridad</h1>
            <p>{tecnicoNombre ? `${tecnicoNombre} · ` : ""}{periodo}</p>
          </div>
        </header>

        <dl className={`ent-hoja-kpis ent-prio-kpis${conMora ? " con-mora" : ""}`}>
          <div className="is-destacado"><dt>Faltan</dt><dd>{formatNumber(resumen.barrios)} {resumen.barrios === 1 ? "barrio" : "barrios"}</dd></div>
          <div><dt>Alta</dt><dd>{formatNumber(resumen.alta)}</dd></div>
          <div><dt>Media</dt><dd>{formatNumber(resumen.media)}</dd></div>
          <div><dt>Baja</dt><dd>{formatNumber(resumen.baja)}</dd></div>
          <div><dt>Documentos</dt><dd>≈{formatNumber(resumen.documentos)}</dd></div>
          {conMora ? <div><dt>Mora</dt><dd>{formatLempiras(resumen.mora)}</dd></div> : null}
        </dl>

        <p className="ent-prio-filtros">{textoFiltros(opciones)}</p>

        <table className="ent-hoja-tabla ent-prio-tabla">
          <thead>
            <tr>
              <th className="is-num">#</th>
              <th>Barrio</th>
              {conTecnico ? <th>Técnico</th> : null}
              <th>Motivo</th>
              <th className="is-num">Docs.</th>
              {conMora ? <th className="is-num">Mora</th> : null}
              <th>Prioridad</th>
              <th className="ent-prio-casilla-th">✓</th>
            </tr>
          </thead>
          {grupos.map((grupo) => (
            <tbody key={grupo.id} className="ent-prio-grupo">
              {agrupar ? (
                <tr className="ent-prio-grupo-head">
                  <td colSpan={columnas}>
                    <strong>{grupo.nombre}</strong>
                    <span>{formatNumber(grupo.barrios.length)} {grupo.barrios.length === 1 ? "barrio" : "barrios"} · ≈{formatNumber(grupo.documentos)} documentos</span>
                  </td>
                </tr>
              ) : null}
              {grupo.barrios.map((barrio) => (
                <tr key={barrio.codigo}>
                  <td className="is-num">{barrio.posicion}</td>
                  <td className="ent-prio-barrio"><strong>{barrio.nombre}</strong> <span>{barrio.codigo}</span></td>
                  {conTecnico ? <td className="ent-prio-tecnico">{barrio.responsable_nombre}</td> : null}
                  <td className="ent-prio-motivo">{textoMotivos(barrio)}</td>
                  <td className="is-num">{textoCarga(barrio, formatNumber)}</td>
                  {conMora ? <td className="is-num">{formatLempiras(barrio.mora?.mora)}</td> : null}
                  <td><span className={`ent-prio-nivel is-${barrio.nivel}`}>{NIVELES[barrio.nivel]}</span></td>
                  <td className="ent-prio-casilla" aria-label="Casilla para marcar" />
                </tr>
              ))}
            </tbody>
          ))}
        </table>

        <p className="ent-prio-hoja-nota">
          Alta: lote abierto, anotado para la próxima jornada, sin entregas registradas o 31 días o más desde la última. Media: de 27 a 30 días. Baja: el resto.
          Documentos: promedio de los últimos ciclos (≈) o claves del padrón si no hay historial (~).
        </p>

        <footer className="ent-hoja-pie">
          <span>Barrios por prioridad · {periodo}</span>
          <span>{formatNumber(resumen.barrios)} barrios</span>
          <span>Generado: {formatDateTime(generadoEn)}</span>
        </footer>
      </article>
    </div>
  );
}
