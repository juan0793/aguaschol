import React from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import "../modules/clandestinos/styles/clandestinos.css";
import "../modules/inspecciones/styles/inspecciones.css";
import "../modules/entregas/styles/entregas.css";
import "../modules/reports/reports.css";

// Banco de pruebas de las casillas nativas. La hoja global da a todo `input`
// el ancho, el relleno y el borde de un campo de texto, así que un checkbox
// sin regla propia sale como una caja estirada. Cada caso reproduce el
// contenedor real donde la app dibuja una casilla, para medir su tamaño.

const CASOS = [
  { nombre: "Clandestinos · dentro de .cl-module", envoltura: "cl-module", clase: "" },
  { nombre: "Clandestinos · lista de servicios", envoltura: "cl-module", clase: "cl-report-services" },
  { nombre: "Entregas · anexo del informe semanal", envoltura: "cl-module ent-module", clase: "" },
  { nombre: "Reportes · barrios incluidos", envoltura: "", clase: "report-zone-checklist" },
  { nombre: "Reportes · agregar al final", envoltura: "", clase: "report-generator-options" },
  { nombre: "Reportes · jornadas del regulador", envoltura: "", clase: "regulator-days" },
  { nombre: "Padrón · marcar como impresa", envoltura: "", clase: "print-batch-status" },
  { nombre: "SIG · capas del mapa", envoltura: "", clase: "sig-layers" },
  { nombre: "Mapa · opciones de impresión", envoltura: "", clase: "map-print-options" }
];

function Caso({ nombre, envoltura, clase }) {
  const contenido = (
    <div className={clase}>
      <label className={clase === "print-batch-status" ? "print-save-check" : ""}>
        <input type="checkbox" defaultChecked />
        <span>Opción de ejemplo</span>
      </label>
    </div>
  );
  return (
    <section style={{ display: "grid", gap: 6 }}>
      <strong style={{ fontSize: 13 }}>{nombre}</strong>
      <div className="qa-caso" data-caso={nombre} style={{ padding: 12, border: "1px solid #dce6ef", borderRadius: 10, background: "#fff" }}>
        {envoltura ? <div className={envoltura}>{contenido}</div> : contenido}
      </div>
    </section>
  );
}

// Una tabla aparte: la casilla de selección de fila vive en un <td>.
function CasoTabla() {
  return (
    <section style={{ display: "grid", gap: 6 }}>
      <strong style={{ fontSize: 13 }}>Importación · selección de fila</strong>
      <div className="qa-caso" data-caso="Importación · selección de fila" style={{ padding: 12, border: "1px solid #dce6ef", borderRadius: 10, background: "#fff" }}>
        <table className="import-data-table">
          <tbody>
            <tr>
              <td><input type="checkbox" defaultChecked /></td>
              <td>0301-0012-0045</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <main style={{ display: "grid", gap: 18, padding: 24, background: "#f2f6fa" }}>
      {CASOS.map((caso) => <Caso key={caso.nombre} {...caso} />)}
      <CasoTabla />
    </main>
  </React.StrictMode>
);
