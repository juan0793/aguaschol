import React from "react";
import ReactDOM from "react-dom/client";
import InspeccionesTable from "../modules/inspecciones/components/InspeccionesTable";
import { ModuleSkeleton } from "../components/ds/Skeleton";
import AppSidebar from "../components/sidebar/AppSidebar";
import logoAguasCholuteca from "../assets/logo-aguas-choluteca.png";
import "../styles.css";
import "../modules/clandestinos/styles/clandestinos.css";
import "../modules/inspecciones/styles/inspecciones.css";
import "../components/sidebar/sidebar.css";

// Banco de pruebas de las pantallas de transición: la silueta de módulo que ve
// el usuario mientras llega el código, y la tabla real en carga y con datos.

const ITEMS = [
  { id: 22, numero_inspeccion: "INS-2026-00022", motivo: "Verificación de conexión", clave_catastral: "43-02-04-01", abonado_nombre_snapshot: "ANDRES CASCO GARCIA", barrio_snapshot: "COL. VENECIA", tecnico_responsable_nombre: "Melisa maradiaga", estado: "ASIGNADA", fecha_asignacion: "2026-09-18", print_status: {} },
  { id: 21, numero_inspeccion: "INS-2026-00021", motivo: "Verificación de conexión", clave_catastral: "43-19-06", abonado_nombre_snapshot: "CIPRIANO SANCHEZ FLORES", barrio_snapshot: "COL. VENECIA", tecnico_responsable_nombre: "Melisa maradiaga", estado: "ASIGNADA", fecha_asignacion: "2026-09-18", print_status: { ORDEN: { impreso: true } } },
  { id: 20, numero_inspeccion: "INS-2026-00020", motivo: "Verificación de conexión", clave_catastral: "43-20-10", abonado_nombre_snapshot: "VICTOR MANUEL NARVAEZ", barrio_snapshot: "COL. VENECIA", tecnico_responsable_nombre: "Melisa maradiaga", estado: "EN_PROCESO", fecha_asignacion: "2026-09-18", print_status: {} },
  { id: 18, numero_inspeccion: "INS-2026-00018", motivo: "Posible irregularidad", clave_catastral: "14-02-06-03", abonado_nombre_snapshot: "GUADALUPE GALO VIUDA DE ESPINAL", barrio_snapshot: "BO. EL CENTRO", tecnico_responsable_nombre: "diego", estado: "FINALIZADA", fecha_asignacion: "2026-09-16", print_status: { ORDEN: { impreso: true }, REPORTE: { impreso: true } } }
];

const modelo = (loading, items) => ({
  items,
  total: items.length,
  page: 1,
  total_pages: 1,
  limit: 20,
  loading,
  error: "",
  filters: { q: "", estado: "", tecnico_id: "", barrio: "", fecha_desde: "", fecha_hasta: "" },
  setFilters: () => {},
  clearFilters: () => {},
  setPage: () => {}
});

const SECCIONES = [
  {
    key: "operacion",
    title: "Operación",
    items: [
      { key: "inspecciones", label: "Inspecciones", helper: "Asignación y campo", icon: "clipboard" },
      { key: "entregas", label: "Control de entregas", helper: "Lotes diarios", icon: "inbox" },
      { key: "records", label: "Clandestinos", helper: "Fichas", icon: "records" }
    ]
  }
];

function Preview() {
  // Registra qué módulo se pidió adelantar, para comprobar que el menú avisa.
  const [adelantados, setAdelantados] = React.useState([]);
  const [navegado, setNavegado] = React.useState("");

  return (
    <main className="cl-module" style={{ display: "grid", gap: 28, padding: 24 }}>
      <section>
        <h2>Marca de la barra superior (botón de inicio)</h2>
        <div className="app-topbar" style={{ marginLeft: 330, background: "#fff", border: "1px solid #dce6ef", borderRadius: 14, padding: 12 }}>
          <button type="button" className="app-topbar-brand" onClick={() => setNavegado("dashboard")} aria-label="Ir al inicio">
            <span className="app-brand-mark" aria-hidden="true">
              <img src={logoAguasCholuteca} alt="" className="app-topbar-logo" />
            </span>
            <div>
              <strong>Aguas de Choluteca</strong>
              <span>Tablero de control</span>
            </div>
          </button>
        </div>
      </section>

      <section>
        <h2>Adelanto del módulo al pasar el puntero por el menú</h2>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <AppSidebar
            sections={SECCIONES}
            activeKey="inspecciones"
            userName="QA"
            userRole="Administrador"
            onToggleCollapsed={() => {}}
            onNavigate={(key) => setNavegado(key)}
            homeKey="dashboard"
            onPrefetch={(key) => setAdelantados((actuales) => (actuales.includes(key) ? actuales : [...actuales, key]))}
            onCloseMobile={() => {}}
            onLogout={() => {}}
          />
          <p id="qa-prefetch" className="cl-empty" style={{ background: "#fff", borderRadius: 12, flex: 1 }}>
            Adelantados: {adelantados.join(", ") || "ninguno todavía"}
            <br />
            <span id="qa-navegado">Última navegación: {navegado || "ninguna"}</span>
          </p>
        </div>
      </section>

      <section>
        <h2>Silueta de módulo (lo que se ve mientras llega el código)</h2>
        <div style={{ border: "1px solid #dce6ef", borderRadius: 14, background: "#f7fafd" }}>
          <ModuleSkeleton title="Inspecciones" />
        </div>
      </section>

      <section>
        <h2>Tabla en carga: filas fantasma con las columnas reales</h2>
        <InspeccionesTable model={modelo(true, [])} tecnicos={[]} isAdmin onOpen={() => {}} />
      </section>

      <section>
        <h2>Tabla con datos: ícono de apertura y estado de impresión compacto</h2>
        <InspeccionesTable model={modelo(false, ITEMS)} tecnicos={[]} isAdmin onOpen={() => {}} />
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>
);
