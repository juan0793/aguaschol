import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { createEntregasApi } from "../services/entregasApi";
import { useLotes } from "../hooks/useLotes";
import { useNoEntregadas } from "../hooks/useNoEntregadas";
import EntregasStats from "../components/EntregasStats";
import LoteForm from "../components/LoteForm";
import LotesTable from "../components/LotesTable";
import CierreLoteDialog from "../components/CierreLoteDialog";
import NoEntregadasTable from "../components/NoEntregadasTable";
import NoEntregadaDetalle from "../components/NoEntregadaDetalle";
import PersonalCampoTable from "../components/PersonalCampoTable";
import ReportesSemanales from "../components/ReportesSemanales";
import { GraficoPorDia } from "../components/ReporteCharts";
import { formatDate, formatNumber } from "../utils/entregasFormatters";
import { addDaysIso, toLocalIsoDate } from "../utils/entregasDate";
import "../styles/entregas.css";

// "Nuevo lote" no vive aqui: es una accion, no una vista a la que se vuelve, asi
// que su unica entrada es el boton primario del header (ver mas abajo).
const SUBVISTAS = [
  { key: "resumen", label: "Resumen", hint: "Efectividad", icon: "dashboard" },
  { key: "lotes", label: "Lotes diarios", hint: "Reparto y cierre", icon: "records" },
  { key: "pendientes", label: "No entregadas", hint: "Seguimiento", icon: "warning" },
  { key: "personal", label: "Personal de campo", hint: "Técnicos", icon: "users" },
  { key: "reportes", label: "Reportes semanales", hint: "Informes", icon: "archive" }
];

const vistaDesdeHash = () => window.location.hash.match(/^#entregas\/([\w-]+)/)?.[1] || "resumen";

export default function EntregasPage({ apiFetch, showAlert }) {
  const api = useMemo(() => createEntregasApi(apiFetch), [apiFetch]);
  const notify = useCallback((mensaje) => showAlert?.(mensaje), [showAlert]);

  const [vista, setVista] = useState(vistaDesdeHash);
  const [config, setConfig] = useState(null);
  const [personal, setPersonal] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [lotesAbiertosPrevios, setLotesAbiertosPrevios] = useState({ items: [], total: 0 });
  const [loteEnCierre, setLoteEnCierre] = useState(null);
  const [loteEnEdicion, setLoteEnEdicion] = useState(null);
  const [documentoAbierto, setDocumentoAbierto] = useState(null);

  const lotes = useLotes(api, Boolean(config) && ["lotes", "resumen"].includes(vista));
  const pendientes = useNoEntregadas(api, Boolean(config) && vista === "pendientes");

  const cargarPersonal = useCallback(async () => {
    try {
      setPersonal(await api.personal());
    } catch (error) {
      notify(error.message);
    }
  }, [api, notify]);

  const cargarResumen = useCallback(async () => {
    try {
      setResumen(await api.resumen());
    } catch (error) {
      notify(error.message);
    }
  }, [api, notify]);

  const cargarLotesAbiertosPrevios = useCallback(async () => {
    try {
      const ayer = addDaysIso(toLocalIsoDate(), -1);
      setLotesAbiertosPrevios(await api.lotes({ estado: "ABIERTO", fecha_hasta: ayer, limit: 6 }));
    } catch (error) {
      notify(error.message);
    }
  }, [api, notify]);

  useEffect(() => {
    api.config().then(setConfig).catch((error) => notify(error.message));
  }, [api, notify]);

  useEffect(() => {
    if (!config) return;
    cargarPersonal();
    cargarResumen();
    cargarLotesAbiertosPrevios();
  }, [cargarLotesAbiertosPrevios, cargarPersonal, cargarResumen, config]);

  // Los usuarios solo se piden cuando el administrador entra a Personal de campo.
  useEffect(() => {
    if (vista !== "personal" || !config?.permissions.can_manage_personal || usuarios.length) return;
    apiFetch("/users")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setUsuarios(Array.isArray(data) ? data : data?.items || []))
      .catch(() => setUsuarios([]));
  }, [apiFetch, config, usuarios.length, vista]);

  useEffect(() => {
    const cambio = () => setVista(vistaDesdeHash());
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);

  const ir = (key) => {
    window.history.replaceState(null, "", `#entregas/${key}`);
    setVista(key);
  };

  const refrescar = () => {
    cargarResumen();
    cargarPersonal();
    cargarLotesAbiertosPrevios();
    lotes.reload();
  };

  const crearLote = async (payload) => {
    const creado = await api.crearLote(payload);
    notify(`Lote #${creado.id} creado.`);
    refrescar();
    ir("lotes");
    return creado;
  };

  const editarLote = async (payload) => {
    const actualizado = await api.actualizarLote(loteEnEdicion.id, payload);
    notify(`Lote #${actualizado.id} actualizado.`);
    setLoteEnEdicion(null);
    refrescar();
    ir("lotes");
    return actualizado;
  };

  const abrirEdicion = async (lote) => {
    try {
      setLoteEnEdicion(await api.lote(lote.id));
      ir("editar");
    } catch (error) {
      notify(error.message);
    }
  };

  const verHoy = () => {
    const hoy = toLocalIsoDate();
    lotes.setFilters({ estado: "", fecha_desde: hoy, fecha_hasta: hoy });
    ir("lotes");
  };

  const verAbiertosPrevios = () => {
    lotes.setFilters({ estado: "ABIERTO", fecha_desde: "", fecha_hasta: addDaysIso(toLocalIsoDate(), -1) });
    ir("lotes");
  };

  const abrirCierre = async (lote) => {
    try {
      setLoteEnCierre(await api.lote(lote.id));
    } catch (error) {
      notify(error.message);
    }
  };

  const guardarPersonal = async (id, payload) => {
    if (id) await api.actualizarPersonal(id, payload);
    else await api.crearPersonal(payload);
    await cargarPersonal();
    notify(id ? "Persona actualizada." : "Persona registrada.");
  };

  if (!config) {
    return (
      <main className="cl-module ent-module">
        <div className="cl-module-loading">
          <Icon name="refresh" />
          Cargando Control de entregas…
        </div>
      </main>
    );
  }

  const subvistas = SUBVISTAS.filter((item) => {
    if (item.key === "reportes") return config.permissions.can_generate_report;
    return true;
  });

  return (
    <main className="cl-module ent-module">
      <header className="cl-module-header">
        <div>
          <span className="cl-kicker">Control Aguas</span>
          <h1>Control de entregas</h1>
          <p>Seguimiento diario de facturas y notas de cobro.</p>
        </div>
        <nav className="ent-menu" aria-label="Secciones de Control de entregas">
          {subvistas.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`ent-menu-card ${vista === item.key ? "is-active" : ""}`}
              onClick={() => ir(item.key)}
            >
              <Icon name={item.icon} />
              <span>
                {item.label}
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="cl-drawer-main-actions ent-header-action">
          {config.permissions.can_create_lote ? (
            <button type="button" className="cl-primary" onClick={() => ir("nuevo")}>
              <Icon name="plus" />
              Nuevo lote
            </button>
          ) : null}
        </div>
      </header>

      <nav className="ent-mobile-tabs" aria-label="Navegación móvil de Control de entregas">
        {subvistas.map((item) => (
          <button key={item.key} type="button" className={vista === item.key ? "is-active" : ""} onClick={() => ir(item.key)}>
            <Icon name={item.icon} />
            <span>{item.label.replace(" semanales", "").replace(" de campo", "")}</span>
          </button>
        ))}
      </nav>

      {vista === "resumen" ? (
        <section className="cl-inbox">
          <div className="cl-inbox-head">
            <div>
              <span className="cl-kicker">
                {resumen ? `${formatDate(resumen.periodo.fecha_inicio)} — ${formatDate(resumen.periodo.fecha_fin)}` : "Semana en curso"}
              </span>
              <h3>Resultado de la semana</h3>
              <p>Los indicadores muestran la operación viva; el informe semanal congela la foto del viernes.</p>
            </div>
            <button type="button" className="cl-quiet" onClick={cargarResumen}>
              <Icon name="refresh" />
              Actualizar
            </button>
          </div>

          <EntregasStats
            resumen={resumen}
            onSelect={(clave) => {
              if (clave === "pendientes" || clave === "reentregadas") {
                pendientes.setFilters({ estado: clave === "pendientes" ? "PENDIENTE" : "REENTREGADA" });
                ir("pendientes");
                return;
              }
              ir("lotes");
            }}
          />

          <div className="ent-resumen-grid">
            <GraficoPorDia rows={resumen?.por_dia || []} />
            <div className="ent-card">
              <h3>Requiere atención</h3>
              <ul className="ent-lista-plana">
                <li>
                  <span>Lotes abiertos</span>
                  <strong>{formatNumber(resumen?.lotes_abiertos)}</strong>
                </li>
                {lotesAbiertosPrevios.total ? (
                  <li className="is-atencion">
                    <span>Abiertos anteriores</span>
                    <strong>{formatNumber(lotesAbiertosPrevios.total)}</strong>
                  </li>
                ) : null}
                <li className="is-atencion">
                  <span>Pendientes con más de 3 días</span>
                  <strong>{formatNumber(resumen?.pendientes_mas_3_dias)}</strong>
                </li>
                <li className="is-critico">
                  <span>Pendientes con más de 7 días</span>
                  <strong>{formatNumber(resumen?.pendientes_mas_7_dias)}</strong>
                </li>
                <li>
                  <span>No localizadas</span>
                  <strong>{formatNumber(resumen?.no_localizadas)}</strong>
                </li>
              </ul>
              <button type="button" className="cl-secondary" onClick={() => ir("pendientes")}>
                Ver documentos pendientes
              </button>
              {lotesAbiertosPrevios.total ? (
                <button type="button" className="cl-secondary" onClick={verAbiertosPrevios}>
                  <Icon name="history" />
                  Volver a jornadas anteriores
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {vista === "nuevo" && config.permissions.can_create_lote ? (
        <LoteForm
          config={config}
          personal={personal}
          notify={notify}
          onSaved={crearLote}
          onCancel={() => ir("lotes")}
        />
      ) : null}

      {vista === "editar" && loteEnEdicion && config.permissions.can_edit_lote ? (
        <LoteForm
          config={config}
          personal={personal}
          notify={notify}
          lote={loteEnEdicion}
          onSaved={editarLote}
          onCancel={() => {
            setLoteEnEdicion(null);
            ir("lotes");
          }}
        />
      ) : null}

      {vista === "lotes" ? (
        <LotesTable
          model={lotes}
          config={config}
          personal={personal}
          permissions={config.permissions}
          abiertosPrevios={lotesAbiertosPrevios}
          onToday={verHoy}
          onPreviousOpen={verAbiertosPrevios}
          onOpen={abrirCierre}
          onEdit={abrirEdicion}
          onCerrar={abrirCierre}
        />
      ) : null}

      {vista === "pendientes" ? (
        <NoEntregadasTable
          model={pendientes}
          config={config}
          personal={personal}
          onOpen={(documento) => setDocumentoAbierto(documento.id)}
        />
      ) : null}

      {vista === "personal" ? (
        <PersonalCampoTable
          config={config}
          personal={personal}
          permissions={config.permissions}
          usuarios={usuarios}
          notify={notify}
          onSubmit={guardarPersonal}
          onToggle={(persona) => guardarPersonal(persona.id, { activo: !persona.activo })}
        />
      ) : null}

      {vista === "reportes" && config.permissions.can_generate_report ? (
        <ReportesSemanales api={api} config={config} permissions={config.permissions} notify={notify} />
      ) : null}

      {loteEnCierre ? (
        <CierreLoteDialog
          api={api}
          config={config}
          lote={loteEnCierre}
          notify={notify}
          onClose={() => setLoteEnCierre(null)}
          onSaved={() => {
            setLoteEnCierre(null);
            refrescar();
            notify("Lote cerrado correctamente.");
          }}
        />
      ) : null}

      {documentoAbierto ? (
        <NoEntregadaDetalle
          api={api}
          config={config}
          id={documentoAbierto}
          personal={personal}
          permissions={config.permissions}
          notify={notify}
          onClose={() => setDocumentoAbierto(null)}
          onChanged={() => {
            pendientes.reload();
            cargarResumen();
          }}
        />
      ) : null}
    </main>
  );
}

export { SUBVISTAS as ENTREGAS_SUBVISTAS };
