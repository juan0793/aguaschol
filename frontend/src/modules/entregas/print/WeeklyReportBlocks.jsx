// Bloques del informe semanal impreso. Viven aparte de los gráficos web porque
// una hoja de papel tiene otras reglas: sin hover ni color como único código,
// cada barra lleva su número al lado y todo debe seguir leyéndose en blanco y
// negro. Paleta institucional (azul entregado / ámbar no entregado) validada
// para daltonismo y contraste sobre blanco.

import { formatDate, formatDayLabel, formatNumber, formatPercent } from "../utils/entregasFormatters";

const UMBRAL_EFECTIVIDAD_BAJA = 85;

export const Seccion = ({ titulo, descripcion, aside, children, ancha = false }) => (
  <section className={`ent-hoja-bloque${ancha ? " is-ancha" : ""}`}>
    <div className="ent-hoja-bloque-head">
      <div>
        <h2>{titulo}</h2>
        {descripcion ? <p>{descripcion}</p> : null}
      </div>
      {aside ? <span className="ent-hoja-bloque-aside">{aside}</span> : null}
    </div>
    {children}
  </section>
);

// Flecha de tendencia: el color depende de si el movimiento es bueno, no de si
// el número sube. Más pendientes es peor aunque la flecha apunte hacia arriba.
export const Tendencia = ({ indicador }) => {
  if (!indicador || indicador.direccion === "igual") return <em className="ent-kpi-delta is-igual">sin cambio</em>;
  const tono = indicador.mejora === null ? "is-neutro" : indicador.mejora ? "is-bueno" : "is-malo";
  const signo = indicador.diferencia > 0 ? "+" : "−";
  const magnitud = Math.abs(indicador.diferencia);
  return (
    <em className={`ent-kpi-delta ${tono}`}>
      {indicador.direccion === "sube" ? "▲" : "▼"} {signo}
      {formatNumber(magnitud)}
      {indicador.unidad === "puntos" ? " pts" : ""}
      {indicador.variacion !== null && indicador.variacion !== undefined ? ` (${formatPercent(indicador.variacion)})` : ""}
    </em>
  );
};

export const TarjetasKpi = ({ totales, comparativo }) => {
  const indicador = (clave) => comparativo?.indicadores?.find((item) => item.clave === clave) || null;
  const tarjetas = [
    { clave: "asignadas", etiqueta: "Asignados", valor: formatNumber(totales.asignadas) },
    { clave: "entregadas", etiqueta: "Entregados", valor: formatNumber(totales.entregadas) },
    { clave: "no_entregadas", etiqueta: "No entregados", valor: formatNumber(totales.no_entregadas) },
    { clave: "pendientes", etiqueta: "Pendientes", valor: formatNumber(totales.pendientes) },
    { clave: "reentregadas", etiqueta: "Reentregados", valor: formatNumber(totales.reentregadas) },
    { clave: "efectividad", etiqueta: "Efectividad", valor: formatPercent(totales.efectividad), destacado: true }
  ];

  return (
    <dl className="ent-hoja-kpis">
      {tarjetas.map((tarjeta) => (
        <div key={tarjeta.clave} className={tarjeta.destacado ? "is-destacado" : ""}>
          <dt>{tarjeta.etiqueta}</dt>
          <dd>{tarjeta.valor}</dd>
          {comparativo?.con_datos ? <Tendencia indicador={indicador(tarjeta.clave)} /> : null}
        </div>
      ))}
    </dl>
  );
};

// Columna apilada por día: la altura es la carga del día (asignadas) y el corte
// muestra en qué terminó. Lo que no está confirmado ni descartado queda en
// tramado, igual que en la pantalla de lotes diarios.
export const GraficoDiarioImpreso = ({ rows = [] }) => {
  const maximo = Math.max(1, ...rows.map((fila) => Number(fila.asignadas) || 0));
  // La columna más alta ocupa el 88% del área: el 12% restante es el espacio que
  // necesita la etiqueta de efectividad, que va pegada encima de su barra.
  const altoColumna = (valor) => `${Math.round(((Number(valor) || 0) / maximo) * 880) / 10}%`;
  const tramo = (valor, total) => `${Math.round(((Number(valor) || 0) / (total || 1)) * 1000) / 10}%`;

  return (
    <figure className="ent-hoja-grafico">
      <div className="ent-hoja-grafico-bars">
        {rows.map((fila) => {
          const asignadas = Number(fila.asignadas) || 0;
          const entregadas = Number(fila.entregadas) || 0;
          const noEntregadas = Number(fila.no_entregadas) || 0;
          const sinConfirmar = Math.max(asignadas - entregadas - noEntregadas, 0);
          return (
            <div className="ent-hoja-grafico-col" key={fila.fecha}>
              <div className="ent-hoja-grafico-plot">
                <span className="ent-hoja-grafico-valor">{asignadas ? formatPercent(fila.efectividad) : "—"}</span>
                {asignadas ? (
                  <div className="ent-hoja-grafico-stack" style={{ height: altoColumna(asignadas) }}>
                    <i className="is-sin-confirmar" style={{ height: tramo(sinConfirmar, asignadas) }} />
                    <i className="is-no-entregadas" style={{ height: tramo(noEntregadas, asignadas) }} />
                    <i className="is-entregadas" style={{ height: tramo(entregadas, asignadas) }} />
                  </div>
                ) : (
                  <div className="ent-hoja-grafico-stack is-vacio" />
                )}
              </div>
              <span className="ent-hoja-grafico-dia">{formatDayLabel(fila.fecha)}</span>
              <span className="ent-hoja-grafico-carga">{asignadas ? formatNumber(asignadas) : "sin reparto"}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="ent-hoja-leyenda">
        <span><i className="is-entregadas" />Entregados</span>
        <span><i className="is-no-entregadas" />No entregados</span>
        <span><i className="is-sin-confirmar" />Sin confirmar (lote abierto)</span>
      </figcaption>
    </figure>
  );
};

// Barra dentro de una celda de tabla. Siempre va acompañada del número: el color
// nunca es el único portador del dato.
export const BarraCelda = ({ valor, total = 100, tono = "" }) => (
  <span className={`ent-hoja-barra ${tono}`} aria-hidden="true">
    <i style={{ width: `${Math.min(Math.max(((Number(valor) || 0) / (total || 1)) * 100, 0), 100)}%` }} />
  </span>
);

export const TablaDiaria = ({ rows = [] }) => (
  <table className="ent-hoja-tabla">
    <thead>
      <tr>
        <th>Día</th>
        <th className="is-num">Lotes</th>
        <th className="is-num">Asignados</th>
        <th className="is-num">Entregados</th>
        <th className="is-num">No entregados</th>
        <th className="is-num">Efectividad</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((fila) => (
        <tr key={fila.fecha} className={fila.asignadas ? "" : "is-tenue"}>
          <td>
            <strong>{formatDayLabel(fila.fecha)}</strong> <span className="ent-hoja-fecha">{formatDate(fila.fecha)}</span>
          </td>
          <td className="is-num">{formatNumber(fila.lotes)}</td>
          <td className="is-num">{formatNumber(fila.asignadas)}</td>
          <td className="is-num">{formatNumber(fila.entregadas)}</td>
          <td className="is-num">{formatNumber(fila.no_entregadas)}</td>
          <td className="is-num">{fila.asignadas ? formatPercent(fila.efectividad) : "—"}</td>
        </tr>
      ))}
      {!rows.length ? <tr><td colSpan={6}>Sin días registrados en el período.</td></tr> : null}
    </tbody>
    <tfoot>
      <tr>
        <th>Total</th>
        <th className="is-num">{formatNumber(rows.reduce((suma, fila) => suma + (Number(fila.lotes) || 0), 0))}</th>
        <th className="is-num">{formatNumber(rows.reduce((suma, fila) => suma + (Number(fila.asignadas) || 0), 0))}</th>
        <th className="is-num">{formatNumber(rows.reduce((suma, fila) => suma + (Number(fila.entregadas) || 0), 0))}</th>
        <th className="is-num">{formatNumber(rows.reduce((suma, fila) => suma + (Number(fila.no_entregadas) || 0), 0))}</th>
        <th className="is-num" />
      </tr>
    </tfoot>
  </table>
);

const TONO_INDICADOR = { danger: "is-critico", warning: "is-atencion", info: "is-info" };

export const IndicadoresAtencion = ({ indicadores = [] }) => (
  <ul className="ent-hoja-indicadores">
    {indicadores.map((indicador) => (
      <li key={indicador.codigo} className={`${TONO_INDICADOR[indicador.tono] || ""}${indicador.total ? "" : " is-sin-casos"}`}>
        <span>{indicador.etiqueta}</span>
        <strong>{formatNumber(indicador.total)}</strong>
      </li>
    ))}
  </ul>
);

export const TablaResponsables = ({ rows = [], tipoDocumentoLabel }) => (
  <table className="ent-hoja-tabla">
    <thead>
      <tr>
        <th>Responsable</th>
        <th>Documento</th>
        <th className="is-num">Lotes</th>
        <th className="is-num">Asignados</th>
        <th className="is-num">Entregados</th>
        <th className="is-num">Pendientes</th>
        <th className="is-barra">Efectividad</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((fila) => (
        <tr key={fila.responsable_id || fila.responsable_nombre}>
          <td>{fila.responsable_nombre || "Sin responsable"}</td>
          <td>{tipoDocumentoLabel(fila.tipo_predominante)}</td>
          <td className="is-num">{formatNumber(fila.lotes)}</td>
          <td className="is-num">{formatNumber(fila.asignadas)}</td>
          <td className="is-num">{formatNumber(fila.entregadas)}</td>
          <td className="is-num">{formatNumber(fila.pendientes)}</td>
          <td className="is-barra">
            <span className="ent-hoja-barra-celda">
              <BarraCelda valor={fila.efectividad} tono={fila.efectividad < UMBRAL_EFECTIVIDAD_BAJA ? "is-bajo" : ""} />
              <b>{formatPercent(fila.efectividad)}</b>
            </span>
          </td>
        </tr>
      ))}
      {!rows.length ? <tr><td colSpan={7}>Sin lotes registrados en el período.</td></tr> : null}
    </tbody>
  </table>
);

export const TablaBarrios = ({ rows = [] }) => (
  <table className="ent-hoja-tabla">
    <thead>
      <tr>
        <th>Barrio o colonia</th>
        <th className="is-num">Lotes</th>
        <th className="is-num">Asignados</th>
        <th className="is-num">Entregados</th>
        <th className="is-num">No entregados</th>
        <th className="is-num">Pendientes</th>
        <th className="is-barra">Efectividad</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((fila) => {
        const bajo = fila.asignadas > 0 && fila.efectividad < UMBRAL_EFECTIVIDAD_BAJA;
        return (
          <tr key={fila.barrio_codigo || fila.barrio_nombre} className={bajo ? "is-marcado" : ""}>
            <td>
              {fila.barrio_nombre}
              {bajo ? <span className="ent-hoja-etiqueta">bajo {UMBRAL_EFECTIVIDAD_BAJA}%</span> : null}
            </td>
            <td className="is-num">{formatNumber(fila.lotes)}</td>
            <td className="is-num">{formatNumber(fila.asignadas)}</td>
            <td className="is-num">{formatNumber(fila.entregadas)}</td>
            <td className="is-num">{formatNumber(fila.no_entregadas)}</td>
            <td className="is-num">{formatNumber(fila.pendientes)}</td>
            <td className="is-barra">
              <span className="ent-hoja-barra-celda">
                <BarraCelda valor={fila.efectividad} tono={bajo ? "is-bajo" : ""} />
                <b>{formatPercent(fila.efectividad)}</b>
              </span>
            </td>
          </tr>
        );
      })}
      {!rows.length ? <tr><td colSpan={7}>Sin lotes registrados en el período.</td></tr> : null}
    </tbody>
  </table>
);

export const TablaMotivos = ({ rows = [], total = 0 }) => {
  const mayor = Math.max(1, ...rows.map((fila) => Number(fila.total) || 0));
  return (
    <table className="ent-hoja-tabla">
      <thead>
        <tr>
          <th>Motivo declarado por el personal de campo</th>
          <th className="is-num">Casos</th>
          <th className="is-barra">Participación</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((fila) => (
          <tr key={fila.motivo}>
            <td>{fila.motivo_etiqueta}</td>
            <td className="is-num">{formatNumber(fila.total)}</td>
            <td className="is-barra">
              <span className="ent-hoja-barra-celda">
                <BarraCelda valor={fila.total} total={mayor} />
                <b>{formatPercent(fila.porcentaje)}</b>
              </span>
            </td>
          </tr>
        ))}
        {!rows.length ? <tr><td colSpan={3}>No se registraron documentos sin entregar.</td></tr> : null}
      </tbody>
      {rows.length ? (
        <tfoot>
          <tr>
            <th>Total de casos</th>
            <th className="is-num">{formatNumber(total)}</th>
            <th className="is-barra" />
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
};

export const TablaTipoDocumento = ({ rows = [], tipoDocumentoLabel }) => (
  <table className="ent-hoja-tabla">
    <thead>
      <tr>
        <th>Tipo de documento</th>
        <th className="is-num">Lotes</th>
        <th className="is-num">Asignados</th>
        <th className="is-num">Entregados</th>
        <th className="is-num">No entregados</th>
        <th className="is-num">Pendientes</th>
        <th className="is-num">Efectividad</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((fila) => (
        <tr key={fila.tipo_documento} className={fila.lotes ? "" : "is-tenue"}>
          <td>{tipoDocumentoLabel(fila.tipo_documento)}</td>
          <td className="is-num">{formatNumber(fila.lotes)}</td>
          <td className="is-num">{formatNumber(fila.asignadas)}</td>
          <td className="is-num">{formatNumber(fila.entregadas)}</td>
          <td className="is-num">{formatNumber(fila.no_entregadas)}</td>
          <td className="is-num">{formatNumber(fila.pendientes)}</td>
          <td className="is-num">{fila.asignadas ? formatPercent(fila.efectividad) : "—"}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const TablaPendientes = ({ rows = [] }) => (
  <table className="ent-hoja-tabla">
    <thead>
      <tr>
        <th>Abonado</th>
        <th>Clave catastral</th>
        <th>Barrio</th>
        <th>Responsable</th>
        <th>Motivo</th>
        <th className="is-num">Días</th>
        <th className="is-num">Intentos</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((fila) => (
        <tr key={fila.id} className={fila.dias_pendiente > 7 ? "is-marcado" : ""}>
          <td>{fila.numero_abonado || "—"}</td>
          <td>{fila.clave_catastral || "—"}</td>
          <td>{fila.barrio_nombre}</td>
          <td>{fila.responsable_nombre}</td>
          <td>{fila.motivo_etiqueta}</td>
          <td className="is-num">{formatNumber(fila.dias_pendiente)}</td>
          <td className="is-num">{formatNumber(fila.intentos)}</td>
        </tr>
      ))}
      {!rows.length ? <tr><td colSpan={7}>No hay pendientes que ameriten atención especial.</td></tr> : null}
    </tbody>
  </table>
);

export const Destacados = ({ destacados }) => {
  if (!destacados) return null;
  const fichas = [
    destacados.mejor_responsable && {
      clave: "mejor",
      etiqueta: "Mejor desempeño",
      titulo: destacados.mejor_responsable.responsable_nombre,
      dato: formatPercent(destacados.mejor_responsable.efectividad),
      detalle: `${formatNumber(destacados.mejor_responsable.entregadas)} de ${formatNumber(destacados.mejor_responsable.asignadas)} documentos entregados`,
      tono: "is-bueno"
    },
    destacados.responsable_a_reforzar && {
      clave: "reforzar",
      etiqueta: "Requiere apoyo",
      titulo: destacados.responsable_a_reforzar.responsable_nombre,
      dato: formatPercent(destacados.responsable_a_reforzar.efectividad),
      detalle: `${formatNumber(destacados.responsable_a_reforzar.pendientes)} documentos quedaron pendientes`,
      tono: "is-malo"
    },
    destacados.barrio_critico && {
      clave: "barrio",
      etiqueta: "Zona más difícil",
      titulo: destacados.barrio_critico.barrio_nombre,
      dato: formatPercent(destacados.barrio_critico.efectividad),
      detalle: `${formatNumber(destacados.barrio_critico.no_entregadas)} documentos no entregados`,
      tono: "is-malo"
    },
    destacados.mejor_dia && {
      clave: "dia",
      etiqueta: "Mejor jornada",
      titulo: formatDate(destacados.mejor_dia.fecha),
      dato: formatPercent(destacados.mejor_dia.efectividad),
      detalle: `${formatNumber(destacados.mejor_dia.asignadas)} documentos repartidos ese día`,
      tono: "is-bueno"
    }
  ].filter(Boolean);

  if (!fichas.length) return null;
  return (
    <div className="ent-hoja-destacados">
      {fichas.map((ficha) => (
        <article key={ficha.clave} className={ficha.tono}>
          <span>{ficha.etiqueta}</span>
          <strong>{ficha.titulo}</strong>
          <b>{ficha.dato}</b>
          <small>{ficha.detalle}</small>
        </article>
      ))}
    </div>
  );
};

export const Firmas = ({ roles = ["Elaborado por", "Revisado por", "Recibido por"] }) => (
  <section className="ent-hoja-firmas">
    {roles.map((etiqueta) => (
      <div key={etiqueta}>
        <i />
        <span>{etiqueta}</span>
        <small>Nombre y firma</small>
      </div>
    ))}
  </section>
);
