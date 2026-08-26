import { useState } from "react";
import { Icon } from "../../../components/Icon";
import {
  estadoClass,
  estadoLoteLabel,
  formatDate,
  formatNumber,
  formatPercent,
  tipoPersonalLabel,
  tipoDocumentoLabel
} from "../utils/entregasFormatters";
import { toLocalIsoDate } from "../utils/entregasDate";

export default function LotesTable({ model, config, personal, permissions, abiertosPrevios, onToday, onPreviousOpen, onOpen, onEdit, onCerrar }) {
  const { items, loading, error, filters, setFilters, clearFilters, page, setPage, total, total_pages: totalPages } = model;
  const [masFiltros, setMasFiltros] = useState(false);
  const hoy = toLocalIsoDate();
  const viendoHoy = filters.fecha_desde === hoy && filters.fecha_hasta === hoy && !filters.estado;
  const rangoFechaPersonalizado = filters.fecha_desde !== hoy || filters.fecha_hasta !== hoy;
  const filtrosAvanzadosActivos =
    [filters.tipo_documento, filters.barrio_codigo, filters.responsable_id].filter(Boolean).length +
    (rangoFechaPersonalizado ? 1 : 0);
  const resumenDia = items.reduce(
    (acc, lote) => {
      acc.asignadas += Number(lote.total_asignadas) || 0;
      acc.entregadas += lote.estado === "ABIERTO" ? 0 : Number(lote.total_entregadas) || 0;
      acc.sobrantes += lote.estado === "ABIERTO" ? 0 : Number(lote.total_sobrantes) || 0;
      acc.abiertos += lote.estado === "ABIERTO" ? 1 : 0;
      acc.cerrados += lote.estado === "CERRADO" ? 1 : 0;
      if (lote.responsable_nombre) acc.tecnicos.add(lote.responsable_nombre);
      return acc;
    },
    { asignadas: 0, entregadas: 0, sobrantes: 0, abiertos: 0, cerrados: 0, tecnicos: new Set() }
  );
  const efectividadDia = resumenDia.asignadas ? (resumenDia.entregadas / resumenDia.asignadas) * 100 : 0;

  // Agrupado solo para lectura rapida (mismos lotes ya cargados, ningun dato nuevo).
  const responsablesMapa = items.reduce((mapa, lote) => {
    const nombre = lote.responsable_nombre || "Sin responsable";
    const fila = mapa.get(nombre) || { nombre, lotes: 0, asignadas: 0, entregadas: 0 };
    fila.lotes += 1;
    fila.asignadas += Number(lote.total_asignadas) || 0;
    fila.entregadas += lote.estado === "ABIERTO" ? 0 : Number(lote.total_entregadas) || 0;
    mapa.set(nombre, fila);
    return mapa;
  }, new Map());
  const responsables = Array.from(responsablesMapa.values()).sort((a, b) => b.asignadas - a.asignadas);

  return (
    <section className="cl-inbox">
      <div className="cl-inbox-head">
        <div>
          <span className="cl-kicker">Operación diaria</span>
          <h3>{viendoHoy ? "Lotes de hoy" : "Lotes registrados"}</h3>
          <p>
            {viendoHoy ? formatDate(hoy) : `${formatNumber(total)} lote(s) según los filtros aplicados.`}
          </p>
        </div>
        <div className="ent-lotes-head-actions">
          <button type="button" className={viendoHoy ? "cl-primary" : "cl-secondary"} onClick={onToday}>
            <Icon name="activity" />
            Hoy
          </button>
          <button type="button" className="cl-quiet" onClick={clearFilters}>
            <Icon name="refresh" />
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="ent-jornada-strip">
        <article>
          <Icon name="records" />
          <span>Lotes</span>
          <strong>{formatNumber(total)}</strong>
        </article>
        <article>
          <Icon name="users" />
          <span>Técnicos</span>
          <strong>{formatNumber(resumenDia.tecnicos.size)}</strong>
        </article>
        <article>
          <Icon name="archive" />
          <span>Asignadas</span>
          <strong>{formatNumber(resumenDia.asignadas)}</strong>
        </article>
        <article className={resumenDia.abiertos ? "is-atencion" : "is-ok"}>
          <Icon name={resumenDia.abiertos ? "warning" : "success"} />
          <span>Abiertos</span>
          <strong>{formatNumber(resumenDia.abiertos)}</strong>
        </article>
      </div>

      {abiertosPrevios?.total ? (
        <div className="ent-lotes-alert">
          <Icon name="history" />
          <div>
            <strong>{formatNumber(abiertosPrevios.total)} lote(s) abierto(s) de jornadas anteriores</strong>
            <span>
              {abiertosPrevios.items?.slice(0, 3).map((lote) => `${lote.responsable_nombre || "Sin responsable"} · ${formatDate(lote.fecha)}`).join(" · ")}
            </span>
          </div>
          <button type="button" className="cl-secondary" onClick={onPreviousOpen}>
            Ver anteriores
          </button>
        </div>
      ) : null}

      {items.length ? (
        <div className="ent-efectividad-dia">
          <div className="ent-efectividad-dia-head">
            <span>Efectividad del día</span>
            <strong>{formatPercent(efectividadDia)}</strong>
          </div>
          <i>
            <em style={{ width: `${Math.min(efectividadDia, 100)}%` }} />
          </i>
          <small>
            {formatNumber(resumenDia.entregadas)} entregadas · {formatNumber(resumenDia.sobrantes)} no entregadas
          </small>
        </div>
      ) : null}

      {responsables.length ? (
        <details className="ent-responsables">
          <summary>
            Responsables de hoy
            <small>{formatNumber(responsables.length)}</small>
          </summary>
          <ul className="ent-lista-plana">
            {responsables.map((fila) => (
              <li key={fila.nombre}>
                <div>
                  <span>{fila.nombre}</span>
                  <small>
                    {formatNumber(fila.lotes)} lote(s) · {formatNumber(fila.entregadas)} entregadas
                  </small>
                </div>
                <strong>{formatPercent(fila.asignadas ? (fila.entregadas / fila.asignadas) * 100 : 0)}</strong>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="cl-toolbar ent-toolbar">
        <label className="cl-search">
          Buscar
          <div>
            <Icon name="search" />
            <input
              value={filters.q}
              onChange={(event) => setFilters({ q: event.target.value })}
              placeholder="Responsable o barrio"
            />
          </div>
        </label>
        <label>
          Estado
          <select value={filters.estado} onChange={(event) => setFilters({ estado: event.target.value })}>
            <option value="">Todos</option>
            {config.estados_lote.map((estado) => (
              <option key={estado} value={estado}>
                {estadoLoteLabel(estado)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`ent-filtros-toggle ${masFiltros ? "is-open" : ""}`}
          onClick={() => setMasFiltros((v) => !v)}
          aria-expanded={masFiltros}
        >
          <Icon name="filter" />
          Más filtros
          {filtrosAvanzadosActivos ? <span className="ent-filtros-badge">{filtrosAvanzadosActivos}</span> : null}
          <Icon name="chevronDown" className="ent-filtros-chevron" />
        </button>
        <div className={`ent-filtros-extra ${masFiltros ? "is-open" : ""}`}>
          <label>
            Tipo
            <select value={filters.tipo_documento} onChange={(event) => setFilters({ tipo_documento: event.target.value })}>
              <option value="">Ambos</option>
              {config.tipos_documento.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipoDocumentoLabel(tipo)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Barrio
            <select value={filters.barrio_codigo} onChange={(event) => setFilters({ barrio_codigo: event.target.value })}>
              <option value="">Todos</option>
              {config.barrios.map((item) => (
                <option key={item.codigo} value={item.codigo}>
                  {item.barrio}
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsable
            <select value={filters.responsable_id} onChange={(event) => setFilters({ responsable_id: event.target.value })}>
              <option value="">Todos</option>
              {personal.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input type="date" value={filters.fecha_desde} onChange={(event) => setFilters({ fecha_desde: event.target.value })} />
          </label>
          <label>
            Hasta
            <input type="date" value={filters.fecha_hasta} onChange={(event) => setFilters({ fecha_hasta: event.target.value })} />
          </label>
        </div>
      </div>

      {error ? <p className="cl-alert">{error}</p> : null}

      <div className="cl-table-wrap">
        <table className="cl-table ent-table ent-lotes-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Responsable</th>
              <th>Barrio</th>
              <th>Tipo</th>
              <th className="is-num">Asignadas</th>
              <th className="is-num">Entregadas</th>
              <th className="is-num">Sobrantes</th>
              <th>Estado</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {loading && !items.length ? (
              <tr>
                <td colSpan={9} className="cl-empty">
                  Cargando lotes…
                </td>
              </tr>
            ) : null}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={9} className="cl-empty">
                  No hay lotes para los filtros seleccionados.
                </td>
              </tr>
            ) : null}
            {items.map((lote) => (
              <tr key={lote.id} className={`ent-lote-fila ${estadoClass(lote.estado)}`}>
                <td>{formatDate(lote.fecha)}</td>
                <td>
                  <button type="button" className="cl-link" onClick={() => onOpen(lote)}>
                    <strong>{lote.responsable_nombre || "—"}</strong>
                    <span>
                      <Icon name="users" />
                      {tipoPersonalLabel(lote.tipo_personal)} · Lote #{lote.id}
                    </span>
                  </button>
                </td>
                <td>{lote.barrio_nombre || "—"}</td>
                <td>{tipoDocumentoLabel(lote.tipo_documento)}</td>
                <td className="is-num">{formatNumber(lote.total_asignadas)}</td>
                <td className="is-num">
                  {lote.estado === "ABIERTO" ? (
                    "—"
                  ) : (
                    <>
                      {formatNumber(lote.total_entregadas)}
                      <small>{formatPercent(lote.efectividad)}</small>
                    </>
                  )}
                </td>
                <td className="is-num">{formatNumber(lote.total_sobrantes)}</td>
                <td>
                  <span className={`cl-status ${estadoClass(lote.estado)}`}>
                    <i />
                    {estadoLoteLabel(lote.estado)}
                  </span>
                </td>
                <td className="ent-acciones-celda">
                  <button type="button" className="cl-icon-button" title="Ver lote" onClick={() => onOpen(lote)}>
                    <Icon name="search" />
                  </button>
                  {permissions.can_edit_lote ? (
                    <button type="button" className="cl-icon-button" title="Editar lote" onClick={() => onEdit(lote)}>
                      <Icon name="edit" />
                    </button>
                  ) : null}
                  {lote.estado === "ABIERTO" && permissions.can_close_own_lote ? (
                    <button type="button" className="cl-primary ent-boton-mini ent-boton-cerrar" onClick={() => onCerrar(lote)}>
                      <Icon name="success" />
                      Cerrar lote
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cl-pagination">
        <span>
          Página {page} de {totalPages}
        </span>
        <div>
          <button type="button" onClick={() => setPage(Math.max(page - 1, 1))} disabled={page <= 1}>
            <Icon name="arrowLeft" />
            Anterior
          </button>
          <button type="button" onClick={() => setPage(Math.min(page + 1, totalPages))} disabled={page >= totalPages}>
            Siguiente
            <Icon name="arrowRight" />
          </button>
        </div>
      </div>
    </section>
  );
}
