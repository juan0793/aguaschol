import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { SERVICE_COLUMNS, buildServiceRows } from "../utils/serviceTable";
import { imprimirAbonadosBarrios, imprimirListadoBarrios } from "../padronInformes";
import SalidaBotones from "./SalidaBotones";

const count = (value) => Number(value || 0).toLocaleString("es-HN");
// Tope del backend por consulta: más barrios se imprimen en otra tanda.
const MAX_BARRIOS = 40;

// Listado de barrios: el general (todos o los filtrados) o, si el administrador lo pide,
// el listado de abonados de los barrios que marque. Ninguno lleva totales de la empresa.
export default function BarriosTab({ model }) {
  const { serviceData } = model;
  const [query, setQuery] = useState("");
  const [orden, setOrden] = useState("nombre");
  const [marcados, setMarcados] = useState(() => new Set());
  const [conSaldo, setConSaldo] = useState(true);
  const [cargando, setCargando] = useState("");
  const rows = useMemo(() => buildServiceRows(serviceData.barrios), [serviceData.barrios]);
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    const base = text ? rows.filter((row) => row.name.toLowerCase().includes(text)) : rows;
    return [...base].sort((a, b) => (orden === "usuarios" ? b.usuarios - a.usuarios : 0) || a.name.localeCompare(b.name, "es"));
  }, [rows, query, orden]);
  const todosVisibles = visible.length > 0 && visible.every((row) => marcados.has(row.name));
  const padronActualizado = model.serviceReport?.source?.updated_at;

  const marcar = (name) => setMarcados((actual) => { const next = new Set(actual); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const marcarVisibles = () => setMarcados((actual) => {
    const next = new Set(actual);
    visible.forEach((row) => (todosVisibles ? next.delete(row.name) : next.add(row.name)));
    return next;
  });

  const salidaGeneral = (modo) => imprimirListadoBarrios({
    rows: visible,
    filtro: query.trim() ? `Barrios que contienen “${query.trim()}”` : "",
    padronActualizado
  }, modo);

  // Trae del padrón las cuentas de los barrios pedidos (en el orden de la tabla) y las imprime.
  const imprimirAbonados = async (nombres, clave, modo = "imprimir") => {
    if (!nombres.length || !model.apiFetch) return;
    if (nombres.length > MAX_BARRIOS) {
      model.notify?.(`Marca hasta ${MAX_BARRIOS} barrios por listado.`);
      return;
    }
    setCargando(clave);
    try {
      const response = await model.apiFetch(`/claves/services/barrio-accounts?${new URLSearchParams({ barrios: nombres.join("|") })}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo leer el padrón.");
      await imprimirAbonadosBarrios({ barrios: body.barrios || [], formatClave: model.formatClave, conSaldo, padronActualizado }, modo);
    } catch (error) {
      model.notify?.(error.message || "No se pudo generar el listado de abonados.");
    } finally {
      setCargando("");
    }
  };
  const marcadosEnOrden = visible.filter((row) => marcados.has(row.name)).map((row) => row.name);
  const marcadosOcultos = marcados.size - marcadosEnOrden.length;
  const nombresMarcados = [...marcadosEnOrden, ...[...marcados].filter((name) => !marcadosEnOrden.includes(name))];

  if (!serviceData.hasData) {
    return <div className="pq-panel"><div className="pq-empty"><Icon name="map" /><strong>{model.loadingServices ? "Leyendo el padrón maestro…" : "Sin datos del padrón"}</strong><span>Actualiza los datos para listar los barrios.</span></div></div>;
  }

  return <div className="pq-panel is-table">
    <div className="pq-toolbar">
      <label className="pq-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar barrio" aria-label="Buscar barrio" /></label>
      <div className="pq-segmented" role="group" aria-label="Orden del listado">
        <button type="button" aria-pressed={orden === "nombre"} className={orden === "nombre" ? "is-active" : ""} onClick={() => setOrden("nombre")}>Por nombre</button>
        <button type="button" aria-pressed={orden === "usuarios"} className={orden === "usuarios" ? "is-active" : ""} onClick={() => setOrden("usuarios")}>Por usuarios</button>
      </div>
      <div className="pq-toolbar-actions">
        <SalidaBotones onSalida={salidaGeneral} disabled={!visible.length} notify={model.notify} imprimir="Imprimir listado" />
      </div>
    </div>

    {marcados.size ? <div className="pq-selection" role="status">
      <span><strong>{marcados.size}</strong> {marcados.size === 1 ? "barrio marcado" : "barrios marcados"} para el listado de abonados{marcadosOcultos ? ` (${marcadosOcultos} fuera de la búsqueda)` : ""}</span>
      <label className="pq-check-toggle"><input type="checkbox" checked={conSaldo} onChange={(event) => setConSaldo(event.target.checked)} />Con el saldo de cada cuenta</label>
      <button type="button" className="pq-link" onClick={() => setMarcados(new Set())}>Quitar marcas</button>
      <button type="button" className="pq-btn is-primary" disabled={Boolean(cargando)} onClick={() => imprimirAbonados(nombresMarcados, "marcados")}>
        <Icon name="print" className={cargando === "marcados" ? "ds-icon-spin" : ""} />{cargando === "marcados" ? "Preparando…" : "Imprimir abonados"}
      </button>
      <button type="button" className="pq-btn is-primary" disabled={Boolean(cargando)} onClick={() => imprimirAbonados(nombresMarcados, "marcados-pdf", "pdf")}>
        <Icon name="download" className={cargando === "marcados-pdf" ? "ds-icon-spin" : ""} />{cargando === "marcados-pdf" ? "Guardando PDF…" : "Guardar PDF"}
      </button>
    </div> : null}

    <div className="pq-table-wrap">
      <table className="pq-table is-barrios">
        <thead>
          <tr>
            <th className="pq-check"><input type="checkbox" checked={todosVisibles} onChange={marcarVisibles} aria-label="Marcar los barrios visibles" /></th>
            <th className="pq-col-name">Barrio</th>
            <th>Usuarios</th>
            {SERVICE_COLUMNS.map(([field, label]) => <th key={field}>{label}</th>)}
            <th className="pq-row-action" aria-label="Listado de abonados" />
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => <tr key={row.name} className={marcados.has(row.name) ? "is-selected" : ""}>
            <td className="pq-check"><input type="checkbox" checked={marcados.has(row.name)} onChange={() => marcar(row.name)} aria-label={`Marcar ${row.name}`} /></td>
            <th scope="row" className="pq-col-name">{row.name}</th>
            <td><b>{count(row.usuarios)}</b></td>
            {SERVICE_COLUMNS.map(([field]) => <td key={field} className={row.services[field].active ? "" : "is-zero"}>{count(row.services[field].active)}</td>)}
            <td className="pq-row-action">
              <span className="pq-row-links">
                <button type="button" className="pq-link" disabled={Boolean(cargando)} onClick={() => imprimirAbonados([row.name], row.name)} title={`Imprimir los abonados de ${row.name}`}>
                  {cargando === row.name ? "Preparando…" : "Abonados"}
                </button>
                <button type="button" className="pq-link" disabled={Boolean(cargando)} onClick={() => imprimirAbonados([row.name], `${row.name}-pdf`, "pdf")} title={`Guardar en PDF los abonados de ${row.name}`}>
                  {cargando === `${row.name}-pdf` ? "Guardando…" : "PDF"}
                </button>
              </span>
            </td>
          </tr>)}
          {!visible.length ? <tr><td colSpan={9} className="pq-table-empty">Ningún barrio coincide con “{query}”.</td></tr> : null}
        </tbody>
      </table>
    </div>
    <p className="pq-note"><Icon name="notes" />Los listados de barrios y de abonados se imprimen sin los totales de la empresa y con la leyenda de información confidencial.</p>
  </div>;
}
