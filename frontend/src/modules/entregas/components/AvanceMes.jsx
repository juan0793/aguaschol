import { useState } from "react";
import { formatNumber, formatPercent } from "../utils/entregasFormatters";
import { gruposPorTecnico } from "../utils/avanceMes.js";

const ESTADOS = { entregado: "Entregado", en_curso: "Lote abierto", pendiente: "Pendiente" };
const fechaCorta = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-HN", { day: "numeric", month: "short" }).replace(".", "") : "");

// Avance del mes: un tramo por barrio del reparto, agrupado por técnico. El tramo se
// llena cuando el barrio queda entregado en el ciclo; rayado si tiene un lote abierto.
export default function AvanceMes({ mes }) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(null);
  if (!mes || !mes.total) return null;
  const grupos = gruposPorTecnico(mes.barrios);
  const lectura = activo
    ? `${activo.nombre} · ${activo.responsable_nombre} · ${ESTADOS[activo.estado]}${activo.estado !== "pendiente" ? ` · ${formatNumber(activo.entregadas)} entregadas` : ""}`
    : `${formatNumber(mes.en_curso)} con lote abierto · ${formatNumber(mes.pendientes)} pendientes · ${formatNumber(mes.documentos_entregados)} documentos entregados`;
  return (
    <div className="ent-mes" aria-labelledby="ent-mes-titulo">
      <div className="ent-mes-head">
        <div>
          <h3 id="ent-mes-titulo">Avance del mes</h3>
          <small>{mes.ciclo_declarado ? "Ciclo" : "Mes"} desde el {fechaCorta(mes.desde)} · barrios del reparto</small>
        </div>
        <p><strong>{formatNumber(mes.entregados)} de {formatNumber(mes.total)}</strong> barrios entregados <span>{formatPercent(mes.porcentaje)}</span></p>
      </div>
      <div
        className="ent-mes-track"
        role="img"
        aria-label={`Avance del mes: ${mes.entregados} de ${mes.total} barrios entregados, ${mes.en_curso} con lote abierto y ${mes.pendientes} pendientes.`}
        onMouseLeave={() => setActivo(null)}
      >
        {grupos.map((grupo) => (
          <span key={grupo.id} className="ent-mes-grupo" style={{ flexGrow: grupo.barrios.length }}>
            {grupo.barrios.map((barrio) => (
              <i key={barrio.codigo} className={`is-${barrio.estado}${activo?.codigo === barrio.codigo ? " is-activo" : ""}`} onMouseEnter={() => setActivo(barrio)} />
            ))}
          </span>
        ))}
      </div>
      <div className="ent-mes-pie">
        <small aria-live="polite">{lectura}</small>
        <button type="button" className="cl-quiet" aria-expanded={abierto} onClick={() => setAbierto((valor) => !valor)}>{abierto ? "Ocultar detalle" : "Ver por técnico"}</button>
      </div>
      {abierto ? (
        <ul className="ent-mes-tecnicos">
          {grupos.map((grupo) => (
            <li key={grupo.id}>
              <div className="ent-mes-tecnico">
                <strong>{grupo.nombre}</strong>
                <span>{grupo.entregados} de {grupo.barrios.length}</span>
              </div>
              <ul>
                {grupo.barrios.map((barrio) => <li key={barrio.codigo} className={`is-${barrio.estado}`}><i aria-hidden="true" />{barrio.nombre}<span className="sr-only"> · {ESTADOS[barrio.estado]}</span></li>)}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
