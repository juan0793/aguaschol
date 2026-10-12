import { ETAPA_TONOS } from "../clandestinos/etapas.js";
import { BarList, ColumnChart, StageStrip, StatStrip } from "./ManagerReportCharts.jsx";
import { dayLabel, formatCount, formatLempiras, formatShare, shortMonth } from "./managerReportFormat.js";

const CAPITAL = "#1465d9";
const INTERESES = "#d59124";
const DICTAMEN = { clandestino: "#c2414b", sin_determinar: "#8fa3b8", registrado: "#1f9463" };
const FICHA_ETAPAS = [["draft", "Borradores"], ["pending", "Por visitar"], ["visit", "En visita"], ["confirmed", "Aviso pendiente"], ["regularization", "En seguimiento"], ["regularized", "Cerradas"], ["discarded", "Descartadas"]];
const INSPECCION_ETAPAS = [["ASIGNADA", "Asignadas", "#8db6e6"], ["EN_PROCESO", "En proceso", "#4f8bd8"], ["SEGUIMIENTO", "En seguimiento", "#0b3f73"], ["FINALIZADA", "Finalizadas", "#18a689"]];

const versus = (current, previous) => (previous == null ? "En el período" : `${formatCount(previous)} el mes anterior`);
const days = (rows = [], key = "total", detail) => rows.map((row) => ({ key: row.fecha, short: String(Number(row.fecha.slice(8, 10))), label: dayLabel(row.fecha), value: Number(row[key] || 0), detail: detail?.(row) }));
const peakSummary = (rows, unit) => {
  const peak = rows.reduce((best, row) => (row.value > (best?.value ?? 0) ? row : best), null);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return peak ? `${formatCount(total)} ${unit} · día con más: ${peak.label} (${formatCount(peak.value)})` : `${formatCount(total)} ${unit}`;
};
const asBars = (rows = []) => rows.map((row) => ({ label: row.label, value: Number(row.total || 0) }));

function Executive({ data }) {
  const ins = data.inspecciones || {};
  const ent = data.entregas || {};
  return <>
    <StatStrip label="Padrón y cartera" items={[
      { label: "Mora total", value: formatLempiras(data.mora), detail: `Capital ${formatLempiras(data.capital)} · intereses ${formatLempiras(data.intereses)}`, split: [{ label: "Capital", value: data.capital, color: CAPITAL }, { label: "Intereses", value: data.intereses, color: INTERESES }] },
      { label: "Cuentas", value: formatCount(data.cuentas), detail: `${formatCount(data.barrios)} barrios` },
      { label: "Fichas activas", value: formatCount(data.fichas), detail: "Estado actual" },
      { label: "Puntos GPS", value: formatCount(data.puntos), detail: "Registrados en total" }
    ]} />
    <StatStrip label="Seguimiento del período" items={[
      { label: "Inspecciones creadas", value: formatCount(ins.creadas), detail: versus(ins.creadas, ins.creadas_anterior) },
      { label: "Inspecciones finalizadas", value: formatCount(ins.finalizadas), detail: versus(ins.finalizadas, ins.finalizadas_anterior) },
      { label: "Documentos entregados", value: formatCount(ent.entregadas), detail: ent.asignadas ? `${formatShare(ent.entregadas, ent.asignadas)} de ${formatCount(ent.asignadas)} asignados` : "En el período" },
      { label: "Documentos pendientes", value: formatCount(ent.pendientes), detail: ent.vencidas ? `${formatCount(ent.vencidas)} vencidos` : "Ninguno vencido", tone: ent.vencidas ? "is-critical" : "" }
    ]} />
    <div className="mr-grid"><BarList title="Carga técnica actual" note="Inspecciones activas por técnico" rows={asBars(data.carga)} empty="No hay inspecciones activas asignadas." /></div>
  </>;
}

function Portfolio({ data, onSelect, selected }) {
  return <>
    <StatStrip label="Cartera" items={[
      { label: "Mora total", value: formatLempiras(data.mora), split: [{ label: "Capital", value: data.capital, color: CAPITAL }, { label: "Intereses", value: data.intereses, color: INTERESES }], detail: `${formatShare(data.intereses, data.mora)} son intereses` },
      { label: "Capital", value: formatLempiras(data.capital) },
      { label: "Intereses", value: formatLempiras(data.intereses) },
      { label: "Cuentas", value: formatCount(data.cuentas), detail: `${formatCount(data.total_barrios)} barrios` }
    ]} />
    <BarList title="Barrios con mayor mora" note="Capital en azul, intereses en ocre. Toca un barrio para filtrar el detalle." format={formatLempiras} selected={selected} onSelect={onSelect}
      rows={(data.barrios || []).map((row) => ({ label: row.label, value: row.total, detail: `${formatCount(row.cuentas)} cuentas`, segments: [{ name: "capital", value: row.capital, color: CAPITAL }, { name: "intereses", value: row.intereses, color: INTERESES }] }))} />
  </>;
}

function Inspections({ data, onSelect, selected }) {
  const columns = days(data.por_dia);
  return <>
    <StatStrip label="Inspecciones por estado" items={[{ label: "Asignadas en el período", value: formatCount(data.total) }, ...INSPECCION_ETAPAS.slice(1).map(([key, label]) => ({ label, value: formatCount(data.estados?.[key]), detail: formatShare(data.estados?.[key] || 0, data.total) }))]} />
    <ColumnChart title="Asignadas por día" rows={columns} summary={peakSummary(columns, "inspecciones")} />
    <div className="mr-grid">
      <BarList title="Barrios" note="Toca uno para filtrar el detalle" rows={asBars(data.barrios)} selected={selected} onSelect={onSelect} />
      <BarList title="Responsables" rows={asBars(data.responsables)} selected={selected} onSelect={onSelect} />
    </div>
  </>;
}

function Deliveries({ data }) {
  const columns = days(data.por_dia, "entregadas", (row) => `${formatCount(row.asignadas)} asignadas · ${formatCount(row.no_entregadas)} no entregadas`);
  return <>
    <StatStrip label="Entregas del período" items={[
      { label: "Entregadas", value: formatCount(data.entregadas), detail: data.asignadas ? `${formatShare(data.entregadas, data.asignadas)} de ${formatCount(data.asignadas)} asignadas` : "En el período" },
      { label: "Pendientes", value: formatCount(data.pendientes), detail: data.vencidas ? `${formatCount(data.vencidas)} vencidas` : "Ninguna vencida", tone: data.vencidas ? "is-critical" : "" },
      { label: "Lotes", value: formatCount(data.lotes), detail: `${formatCount(data.lotes_abiertos)} abiertos` },
      { label: "Asignadas", value: formatCount(data.asignadas) }
    ]} />
    <ColumnChart title="Entregadas por día" rows={columns} summary={peakSummary(columns, "entregadas")} />
  </>;
}

function Clandestinos({ data, onSelect, selected }) {
  const months = (data.por_mes || []).map((row) => ({ key: row.periodo, short: shortMonth(row.periodo), label: shortMonth(row.periodo), value: row.total }));
  return <>
    <StatStrip label="Ritmo de levantamiento" items={[
      { label: "Fichas activas", value: formatCount(data.total) },
      { label: "Levantadas este mes", value: formatCount(data.ritmo?.mes) },
      { label: "Esta semana", value: formatCount(data.ritmo?.semana) },
      { label: "Este año", value: formatCount(data.ritmo?.anio) }
    ]} />
    <StageStrip title="Fichas por etapa" note="Del borrador al cierre" stages={FICHA_ETAPAS.map(([key, label]) => ({ key, label, value: Number(data.etapas?.[key] || 0), color: ETAPA_TONOS[key] }))} />
    <div className="mr-grid">
      <BarList title="Barrios con más fichas" note="Toca uno para filtrar el detalle" rows={asBars(data.barrios)} selected={selected} onSelect={onSelect} />
      <ColumnChart title="Fichas levantadas por mes" rows={months} summary={`Últimos ${months.length} meses`} />
    </div>
  </>;
}

function Banco({ data }) {
  const banco = data.banco;
  return <>
    <p className="mr-lead">Puntos de campo que todavía no son ficha: el dictamen compara la clave con el padrón de Aguas.</p>
    <StatStrip label="Banco por estado" items={[
      { label: "Pendientes", value: formatCount(banco.estados?.pendiente), detail: `${formatCount(banco.sin_asignar)} sin asignar`, tone: banco.sin_asignar ? "is-warning" : "" },
      { label: "Pasados a ficha", value: formatCount(banco.estados?.enviado) },
      { label: "Descartados", value: formatCount(banco.estados?.descartado) },
      { label: "Dictamen", value: formatCount((banco.dictamenes?.clandestino || 0) + (banco.dictamenes?.sin_determinar || 0) + (banco.dictamenes?.registrado || 0)), detail: `${formatCount(banco.dictamenes?.clandestino)} clandestinos · ${formatCount(banco.dictamenes?.sin_determinar)} sin determinar · ${formatCount(banco.dictamenes?.registrado)} registrados`, split: ["clandestino", "sin_determinar", "registrado"].map((key) => ({ label: key, value: Number(banco.dictamenes?.[key] || 0), color: DICTAMEN[key] })) }
    ]} />
    <div className="mr-grid">
      <BarList title="Barrios del banco" note="Rojo clandestino, gris sin determinar, verde registrado" rows={(banco.barrios || []).map((row) => ({ label: row.label, value: row.total, segments: ["clandestino", "sin_determinar", "registrado"].map((key) => ({ name: key, value: Number(row[key] || 0), color: DICTAMEN[key] })) }))} />
      <BarList title="Avance por técnico" note="Trabajado en azul; la pista es lo pendiente" empty="Nadie tiene puntos asignados." rows={(banco.tecnicos || []).map((row) => ({ label: row.label, value: row.total, detail: `${row.avance}% trabajado · ${formatCount(row.pendientes)} pendientes`, segments: [{ name: "trabajados", value: row.trabajados, color: CAPITAL }, { name: "pendientes", value: row.pendientes, color: "#d3dde9" }] }))} />
    </div>
  </>;
}

function Gps({ data, onSelect, selected }) {
  const columns = days(data.por_dia);
  return <>
    <ColumnChart title="Puntos por día" rows={columns} summary={peakSummary(columns, "puntos")} />
    <div className="mr-grid">
      <BarList title="Por tipo" rows={asBars(data.tipos)} selected={selected} onSelect={onSelect} />
      <BarList title="Por técnico" rows={asBars(data.tecnicos)} selected={selected} onSelect={onSelect} />
    </div>
  </>;
}

function Team({ data, onSelect, selected }) {
  const columns = days(data.por_dia);
  return <>
    <ColumnChart title="Acciones por día" rows={columns} summary={peakSummary(columns, "acciones")} />
    <div className="mr-grid"><BarList title="Por persona" note="Toca una para filtrar el detalle" rows={asBars(data.personas)} selected={selected} onSelect={onSelect} /></div>
  </>;
}

const VIEWS = { executive: Executive, portfolio: Portfolio, inspections: Inspections, deliveries: Deliveries, clandestinos: Clandestinos, gps: Gps, team: Team };

// Pestañas de gráficos del informe; el detalle tabular lo agrega la página.
export function reportPanels(report, { onSelect, selected }) {
  const View = VIEWS[report.type];
  const data = report.insights;
  if (!View || !data || !Object.keys(data).length) return [];
  const panels = [{ key: "resumen", label: report.type === "clandestinos" ? "Fichas" : "Resumen", content: <View data={data} onSelect={onSelect} selected={selected} /> }];
  if (report.type === "clandestinos" && data.banco) panels.push({ key: "banco", label: "Banco de clandestinos", content: <Banco data={data} /> });
  return panels;
}
