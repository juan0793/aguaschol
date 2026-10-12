import { useState } from "react";
import { formatNumber, formatPercent } from "../utils/entregasFormatters";
import { gruposPorTecnico, listaAvance } from "../utils/avanceMes.js";

const ESTADOS = { entregado: "Entregado", en_curso: "Lote abierto", pendiente: "Pendiente" };
const fechaCorta = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-HN", { day: "numeric", month: "short" }).replace(".", "") : "");

// Avance del mes: un tramo por barrio del reparto, agrupado por técnico. El tramo se
// llena cuando el barrio queda entregado en el ciclo; rayado si tiene un lote abierto.
// Tocar la barra abre la lista de lo entregado y lo que falta; tocar el tramo de un
// técnico la abre filtrada a él.
export default function AvanceMes({ mes, onAbrirLote }) {
  const [abierto, setAbierto] = useState(false);
  const [tecnico, setTecnico] = useState(null);
  const [activo, setActivo] = useState(null);
  if (!mes || !mes.total) return null;
  const grupos = gruposPorTecnico(mes.barrios);
  const { entregados, faltan } = listaAvance(mes.barrios, tecnico);
  const elegido = grupos.find((grupo) => grupo.id === tecnico);
  const abrir = (id) => {
    if (abierto && tecnico === id) { setAbierto(false); return; }
    setTecnico(id);
    setAbierto(true);
  };
  const lectura = activo
    ? `${activo.nombre} · ${activo.responsable_nombre} · ${ESTADOS[activo.estado]}${activo.estado !== "pendiente" ? ` · ${formatNumber(activo.entregadas)} entregadas` : ""}`
    : `${formatNumber(mes.en_curso)} con lote abierto · ${formatNumber(mes.pendientes)} pendientes · ${formatNumber(mes.documentos_entregados)} documentos entregados`;

  return (
    <div className="ent-mes">
      <div className="ent-mes-head">
        <div>
          <h3 id="ent-mes-titulo">Avance del mes</h3>
          <small>{mes.ciclo_declarado ? "Ciclo" : "Mes"} desde el {fechaCorta(mes.desde)} · barrios del reparto</small>
        </div>
        <p><strong>{formatNumber(mes.entregados)} de {formatNumber(mes.total)}</strong> barrios entregados <span>{formatPercent(mes.porcentaje)}</span></p>
      </div>
      <div className="ent-mes-track" onMouseLeave={() => setActivo(null)}>
        {grupos.map((grupo) => (
          <button
            type="button"
            key={grupo.id}
            className={`ent-mes-grupo${abierto && tecnico === grupo.id ? " is-elegido" : ""}`}
            style={{ flexGrow: grupo.barrios.length }}
            onClick={() => abrir(grupo.id)}
            aria-label={`${grupo.nombre}: ${grupo.entregados} de ${grupo.barrios.length} barrios entregados. Ver su lista.`}
            aria-expanded={abierto && tecnico === grupo.id}
          >
            {grupo.barrios.map((barrio) => (
              <i key={barrio.codigo} className={`is-${barrio.estado}${activo?.codigo === barrio.codigo ? " is-activo" : ""}`} onMouseEnter={() => setActivo(barrio)} />
            ))}
          </button>
        ))}
      </div>
      <div className="ent-mes-pie">
        <small aria-live="polite">{lectura}</small>
        <button type="button" className="cl-quiet" aria-expanded={abierto && tecnico == null} onClick={() => abrir(null)}>
          {abierto ? "Ocultar lista" : "Ver entregados y pendientes"}
        </button>
      </div>

      {abierto ? (
        <section className="ent-mes-lista" aria-label={elegido ? `Barrios de ${elegido.nombre}` : "Barrios del reparto"}>
          <div className="ent-mes-filtros" role="group" aria-label="Filtrar por técnico">
            <button type="button" className={tecnico == null ? "is-activo" : ""} aria-pressed={tecnico == null} onClick={() => setTecnico(null)}>
              Todos <span>{mes.entregados}/{mes.total}</span>
            </button>
            {grupos.map((grupo) => (
              <button type="button" key={grupo.id} className={tecnico === grupo.id ? "is-activo" : ""} aria-pressed={tecnico === grupo.id} onClick={() => setTecnico(grupo.id)}>
                {grupo.nombre} <span>{grupo.entregados}/{grupo.barrios.length}</span>
              </button>
            ))}
          </div>
          <div className="ent-mes-columnas">
            <div>
              <h4>Ya entregados <span>{entregados.length}</span></h4>
              {!entregados.length ? <p className="ent-mes-vacio">Todavía ningún barrio entregado.</p> : (
                <ul>
                  {entregados.map((barrio) => (
                    <li key={barrio.codigo}>
                      <span className="ent-mes-barrio"><i className="is-entregado" aria-hidden="true" /><strong>{barrio.nombre}</strong><small>{tecnico == null ? `${barrio.responsable_nombre} · ` : ""}{formatNumber(barrio.entregadas)} entregadas</small></span>
                      <span className="ent-mes-lotes">
                        {barrio.lotes_cerrados.slice(0, 3).map((id) => (
                          <button type="button" key={id} onClick={() => onAbrirLote?.({ id })} disabled={!onAbrirLote} title={`Abrir el lote #${id}`}>#{id}</button>
                        ))}
                        {barrio.lotes_cerrados.length > 3 ? <small>+{barrio.lotes_cerrados.length - 3}</small> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4>Faltan <span>{faltan.length}</span></h4>
              {!faltan.length ? <p className="ent-mes-vacio">No falta ningún barrio.</p> : (
                <ul>
                  {faltan.map((barrio) => (
                    <li key={barrio.codigo}>
                      <span className="ent-mes-barrio"><i className={`is-${barrio.estado}`} aria-hidden="true" /><strong>{barrio.nombre}</strong><small>{tecnico == null ? `${barrio.responsable_nombre} · ` : ""}{ESTADOS[barrio.estado]}</small></span>
                      {barrio.lotes_abiertos.length ? (
                        <span className="ent-mes-lotes">
                          {barrio.lotes_abiertos.slice(0, 2).map((id) => (
                            <button type="button" key={id} onClick={() => onAbrirLote?.({ id })} disabled={!onAbrirLote} title={`Abrir el lote #${id}`}>#{id}</button>
                          ))}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
