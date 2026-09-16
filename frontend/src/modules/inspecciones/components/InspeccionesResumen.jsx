import { Fragment } from "react";
import { Icon } from "../../../components/Icon";
import {
  BANDEJA_FILTROS,
  BANDEJA_VACIA,
  ESTADO_ICONS,
  actividadTexto,
  antiguedadLabel,
  antiguedadLargaLabel,
  antiguedadTone,
  estadoClass,
  estadoLabel,
  formatShortDate,
  initial,
  monthLabel,
  monthName,
  rangoLabel,
  titleCase
} from "../utils/inspeccionesFormatters";

const BANDEJA_MAX = 8;

const EstadoBadge = ({ estado }) => (
  <span className={`ins-badge ${estadoClass(estado)}`}>
    <Icon name={ESTADO_ICONS[estado]} />
    {estadoLabel(estado)}
  </span>
);

const signed = (value) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0");

/* --- C. Barra de estados ------------------------------------------------------ */

function EstadosBar({ data, filtro, onFiltro }) {
  const loaded = Boolean(data);
  const delta = loaded ? data.finalizadas_mes - data.finalizadas_mes_anterior : 0;
  const esMesActual = loaded && data.mes === data.mes_actual;
  const segmentos = [
    {
      key: "asignadas",
      estado: "ASIGNADA",
      label: "Asignadas",
      value: data?.asignadas,
      context: !loaded ? "" : data.asignadas ? `Más antigua: ${antiguedadLargaLabel(data.mas_antigua_asignada_dias)}` : "Sin asignaciones pendientes"
    },
    {
      key: "proceso",
      estado: "EN_PROCESO",
      label: "En proceso",
      value: data?.en_proceso,
      context: !loaded ? "" : data.en_proceso ? "Trabajándose en campo" : "Sin actividad en campo"
    },
    {
      key: "seguimiento",
      estado: "SEGUIMIENTO",
      label: "Seguimiento",
      value: data?.seguimiento,
      context: !loaded ? "" : data.seguimiento ? "Esperan segunda visita" : "Sin pendientes"
    },
    {
      key: "finalizadas",
      estado: "FINALIZADA",
      label: "Finalizadas",
      value: data?.finalizadas_mes,
      context: !loaded ? "" : `${esMesActual ? "Este mes" : monthLabel(data.mes)} · ${signed(delta)} vs. ${monthName(data.mes_anterior)}`
    }
  ];

  return (
    <section className="ins-estados" aria-label="Inspecciones por estado">
      {segmentos.map((segmento, index) => {
        const filtra = segmento.key !== "finalizadas";
        const active = filtra && filtro === segmento.key;
        const content = (
          <>
            <span className="ins-estado-label">
              <span className="ins-estado-icon"><Icon name={ESTADO_ICONS[segmento.estado]} /></span>
              {segmento.label}
            </span>
            <strong className={`ins-estado-num ${segmento.value === 0 ? "is-zero" : ""}`}>{segmento.value ?? "—"}</strong>
            <span className="ins-estado-context">{segmento.context}</span>
          </>
        );
        return (
          <Fragment key={segmento.key}>
            {index > 0 ? <span className="ins-estado-flow" aria-hidden="true"><span><Icon name="chevronRight" /></span></span> : null}
            {filtra ? (
              <button
                type="button"
                className={`ins-estado ${estadoClass(segmento.estado)} ${active ? "is-active" : ""}`}
                aria-pressed={active}
                onClick={() => onFiltro(active ? "" : segmento.key)}
              >
                {content}
              </button>
            ) : (
              <div className={`ins-estado ${estadoClass(segmento.estado)}`}>{content}</div>
            )}
          </Fragment>
        );
      })}
    </section>
  );
}

/* --- D. Bandeja "Requieren acción" ----------------------------------------------- */

function BandejaRow({ item, onOpen }) {
  const abonado = titleCase(item.abonado_nombre_snapshot) || "General";
  const tecnico = titleCase(item.tecnico_responsable_nombre) || "Sin técnico";
  const antiguedad = antiguedadLabel(item.antiguedad_dias);
  return (
    <li>
      <button
        type="button"
        className="ins-row"
        onClick={() => onOpen(item)}
        aria-label={`${item.numero_inspeccion}, ${abonado}, ${estadoLabel(item.estado)}, ${antiguedadLargaLabel(item.antiguedad_dias)}`}
      >
        <span className="ins-row-id">{item.numero_inspeccion}</span>
        <span className="ins-row-name">{abonado}</span>
        <span className="ins-row-motivo">{item.motivo || "Sin motivo"}</span>
        <span className="ins-row-tecnico">
          <span className="ins-avatar" aria-hidden="true">{initial(tecnico)}</span>
          <span className="ins-row-tecnico-name">{tecnico}</span>
          <span className="ins-row-date">
            <span className="is-long">{formatShortDate(item.fecha_asignacion)}</span>
            <span className="is-short">{formatShortDate(item.fecha_asignacion, { withYear: false })}</span>
          </span>
        </span>
        <span className={`ins-age ${antiguedadTone(item.antiguedad_dias)}`}>
          <Icon name="history" />
          {antiguedad}
        </span>
        <span className="ins-row-estado"><EstadoBadge estado={item.estado} /></span>
        <span className="ins-row-chev"><Icon name="chevronRight" /></span>
      </button>
    </li>
  );
}

function Bandeja({ data, loading, filtro, onFiltro, onOpen, onVerTodas }) {
  const bandeja = data?.bandeja || [];
  const conteo = Object.fromEntries(BANDEJA_FILTROS.map((f) => [f.key, f.estado ? bandeja.filter((item) => item.estado === f.estado).length : bandeja.length]));
  const estado = BANDEJA_FILTROS.find((f) => f.key === filtro)?.estado || "";
  const visibles = (estado ? bandeja.filter((item) => item.estado === estado) : bandeja).slice(0, BANDEJA_MAX);
  const vacia = BANDEJA_VACIA[filtro] || BANDEJA_VACIA[""];

  return (
    <section className="ins-card ins-bandeja" aria-labelledby="ins-bandeja-title">
      <header className="ins-card-head">
        <h2 id="ins-bandeja-title">
          <span className="ins-card-icon"><Icon name="inbox" /></span>
          Requieren acción
          {data ? <span className="ins-count">{bandeja.length}</span> : null}
        </h2>
        <div className="ins-segmented" role="group" aria-label="Filtrar por estado">
          {BANDEJA_FILTROS.map((f) => (
            <button key={f.key || "todas"} type="button" aria-pressed={filtro === f.key} className={filtro === f.key ? "is-active" : ""} onClick={() => onFiltro(f.key)}>
              {f.label}
              <span>{data ? conteo[f.key] : "—"}</span>
            </button>
          ))}
        </div>
        <button type="button" className="ins-link ins-bandeja-all-top" onClick={onVerTodas}>Ver todas</button>
      </header>

      <div className="ins-cols" aria-hidden="true">
        <span>Inspección</span>
        <span>Abonado y motivo</span>
        <span>Técnico</span>
        <span>Antigüedad</span>
        <span>Estado</span>
        <span />
      </div>

      {loading && !data ? (
        <ul className="ins-rows" aria-busy="true" aria-label="Cargando inspecciones">
          {[0, 1, 2].map((key) => <li key={key} className="ins-row-skeleton"><span /><span /><span /></li>)}
        </ul>
      ) : visibles.length ? (
        <ul className="ins-rows">
          {visibles.map((item) => <BandejaRow key={item.id} item={item} onOpen={onOpen} />)}
        </ul>
      ) : (
        <div className="ins-empty">
          <span className={`ins-empty-icon ${estadoClass(estado || "FINALIZADA")}`}><Icon name={vacia.icon} /></span>
          <strong>{vacia.title}</strong>
          <p>{vacia.text}</p>
        </div>
      )}

      <footer className="ins-card-foot">
        <span>Ordenadas de la más antigua a la más reciente{(conteo[filtro] ?? 0) > BANDEJA_MAX ? ` · primeras ${BANDEJA_MAX} de ${conteo[filtro]}` : ""}</span>
        <button type="button" className="ins-link" onClick={onVerTodas}>
          Ver todas las inspecciones
          <Icon name="arrowRight" />
        </button>
      </footer>
    </section>
  );
}

/* --- E. Resumen del mes ------------------------------------------------------ */

const DISTRIBUCION = ["FINALIZADA", "ASIGNADA", "EN_PROCESO", "SEGUIMIENTO"];
const LEYENDA = { FINALIZADA: "Finalizadas", ASIGNADA: "Asignadas", EN_PROCESO: "En proceso", SEGUIMIENTO: "Seguimiento" };

function ResumenMes({ data, isAdmin }) {
  if (!data) {
    return <section className="ins-card ins-mes is-loading" aria-busy="true"><div className="ins-mes-skeleton" /></section>;
  }
  const { creadas_mes: creadas, creadas_finalizadas: cerradas, distribucion_creadas: distribucion } = data;
  const tasa = creadas ? Math.round((cerradas / creadas) * 100) : null;
  const delta = data.finalizadas_mes - data.finalizadas_mes_anterior;
  const maxCarga = Math.max(1, ...data.carga_tecnicos.map((item) => item.activas));
  const partes = DISTRIBUCION.map((estado) => `${LEYENDA[estado]} ${distribucion[estado]}`).join(", ");

  return (
    <section className="ins-card ins-mes" aria-labelledby="ins-mes-title">
      <header className="ins-mes-head">
        <span className="ins-card-icon"><Icon name="barChart" /></span>
        <div>
          <h2 id="ins-mes-title">{monthLabel(data.mes)}</h2>
          <p>{rangoLabel(data.rango)}</p>
        </div>
      </header>

      <div className="ins-tasa">
        <strong className={tasa == null ? "is-zero" : ""}>{tasa == null ? "--" : `${tasa}%`}</strong>
        <span>
          tasa de cierre
          <small>{creadas ? `${cerradas} de ${creadas} ${creadas === 1 ? "creada ya finalizada" : "creadas ya finalizadas"}` : "Sin inspecciones creadas"}</small>
        </span>
      </div>

      <div className="ins-stack" role="img" aria-label={creadas ? `Creadas en ${monthName(data.mes)} por estado: ${partes}` : "Sin inspecciones creadas este mes"}>
        {DISTRIBUCION.filter((estado) => distribucion[estado] > 0).map((estado) => (
          <span key={estado} className={estadoClass(estado)} style={{ flexGrow: distribucion[estado] }} />
        ))}
      </div>

      <ul className="ins-legend">
        {DISTRIBUCION.map((estado) => (
          <li key={estado} className={distribucion[estado] ? "" : "is-empty"}>
            <i className={estadoClass(estado)} />
            {LEYENDA[estado]}
            <strong>{distribucion[estado]}</strong>
          </li>
        ))}
      </ul>

      <div className="ins-minis">
        <div>
          <span><Icon name="plus" />Creadas</span>
          <strong>{creadas}</strong>
        </div>
        <div>
          <span><Icon name="checkCircle" />Finalizadas vs. {monthName(data.mes_anterior)}</span>
          <strong>
            {data.finalizadas_mes}
            <em className={delta > 0 ? "is-up" : delta < 0 ? "is-down" : ""}>
              {delta ? <Icon name={delta > 0 ? "trendUp" : "trendDown"} /> : null}
              {signed(delta)}
            </em>
          </strong>
        </div>
      </div>

      {isAdmin ? (
        <div className="ins-carga">
          <h3><Icon name="users" />Carga por técnico</h3>
          {data.carga_tecnicos.length ? (
            <ul>
              {data.carga_tecnicos.map((item) => (
                <li key={item.tecnico_id}>
                  <span className="ins-avatar" aria-hidden="true">{initial(item.nombre)}</span>
                  <span className="ins-carga-name">{titleCase(item.nombre)}</span>
                  <i><em style={{ width: `${(item.activas / maxCarga) * 100}%` }} /></i>
                  <small>{item.activas} {item.activas === 1 ? "activa" : "activas"}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ins-muted">Ningún técnico tiene inspecciones activas.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/* --- F. Actividad reciente ----------------------------------------------------- */

function Actividad({ data, onOpen }) {
  const eventos = data?.actividad || [];
  return (
    <section className="ins-card ins-actividad" aria-labelledby="ins-actividad-title">
      <header className="ins-card-head">
        <h2 id="ins-actividad-title">
          <span className="ins-card-icon"><Icon name="activity" /></span>
          Actividad reciente
        </h2>
      </header>
      {!data ? (
        <p className="ins-muted ins-actividad-empty">Cargando actividad…</p>
      ) : eventos.length ? (
        <ul>
          {eventos.map((evento) => (
            <li key={evento.id}>
              <button type="button" onClick={() => onOpen({ id: evento.inspeccion_id })} aria-label={`${evento.numero_inspeccion} ${actividadTexto({ ...evento, tecnico_responsable_nombre: titleCase(evento.tecnico_responsable_nombre) })}, ${formatShortDate(evento.created_at)}`}>
                <time dateTime={evento.created_at}>{formatShortDate(evento.created_at, { withYear: false })}</time>
                <span className={`ins-actividad-icon ${estadoClass(evento.estado_nuevo)}`}><Icon name={ESTADO_ICONS[evento.estado_nuevo]} /></span>
                <span className="ins-actividad-text">
                  <code>{evento.numero_inspeccion}</code> {actividadTexto({ ...evento, tecnico_responsable_nombre: titleCase(evento.tecnico_responsable_nombre) })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ins-muted ins-actividad-empty"><Icon name="history" />Sin actividad este mes</p>
      )}
    </section>
  );
}

export default function InspeccionesResumen({ data, loading, error, filtro, onFiltro, onOpen, onVerTodas, isAdmin }) {
  return (
    <div className="ins-resumen">
      {error ? <p className="cl-alert">{error}</p> : null}
      <EstadosBar data={data} filtro={filtro} onFiltro={onFiltro} />
      <div className="ins-resumen-grid">
        <Bandeja data={data} loading={loading} filtro={filtro} onFiltro={onFiltro} onOpen={onOpen} onVerTodas={onVerTodas} />
        <ResumenMes data={data} isAdmin={isAdmin} />
        <Actividad data={data} onOpen={onOpen} />
      </div>
    </div>
  );
}
