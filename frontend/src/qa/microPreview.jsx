import React from "react";
import ReactDOM from "react-dom/client";
import HoldButton from "../components/micro/HoldButton";
import SpringCheck from "../components/micro/SpringCheck";
import StatusMark from "../components/micro/StatusMark";
import { Icon } from "../components/Icon";
import "../styles.css";
import "../modules/clandestinos/styles/clandestinos.css";
import "../modules/entregas/styles/entregas.css";

// Banco de pruebas visual de las micro-interacciones. Monta cada componente
// dentro de los contenedores reales (.cl-module, .cl-table, .ent-timeline)
// para verificar que las hojas globales no los deforman.

const FICHAS = [
  { id: 1, clave: "0301-0012-0045", abonado: "María Fúnez", barrio: "Suyapa" },
  { id: 2, clave: "0301-0012-0046", abonado: "Sin abonado", barrio: "El Centro" },
  { id: 3, clave: "0301-0013-0011", abonado: "José Andino", barrio: "La Cañada" }
];

const INTENTOS = [
  { estado: "failed", color: "var(--danger, #b42332)", titulo: "No entregada", detalle: "Dirección incompleta" },
  { estado: "failed", color: "var(--alert, #925a08)", titulo: "Intento 1", detalle: "Casa cerrada" },
  { estado: "pending", titulo: "Intento 2", detalle: "Programado" },
  { estado: "running", titulo: "Intento 3", detalle: "En ruta" },
  { estado: "done", titulo: "Intento 4", detalle: "Entregado" }
];

function Preview() {
  const [seleccion, setSeleccion] = React.useState(() => new Set([1]));
  const todas = FICHAS.every((ficha) => seleccion.has(ficha.id));

  const alternar = (id) =>
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  return (
    <main className="cl-module" style={{ display: "grid", gap: 24, padding: 24 }}>
      <section>
        <h2>SpringCheck en tabla densa</h2>
        <div className="cl-table-wrap">
          <table className="cl-table">
            <thead>
              <tr>
                <th>
                  <SpringCheck
                    checked={todas}
                    onChange={() => setSeleccion(todas ? new Set() : new Set(FICHAS.map((f) => f.id)))}
                    ariaLabel="Seleccionar las fichas visibles"
                  />
                </th>
                <th>Clave / abonado</th>
                <th>Barrio</th>
              </tr>
            </thead>
            <tbody>
              {FICHAS.map((ficha) => (
                <tr key={ficha.id} className={seleccion.has(ficha.id) ? "is-selected" : ""}>
                  <td>
                    <SpringCheck
                      checked={seleccion.has(ficha.id)}
                      onChange={() => alternar(ficha.id)}
                      ariaLabel={`Seleccionar ${ficha.clave}`}
                    />
                  </td>
                  <td>
                    <button type="button" className="cl-link">
                      <strong>{ficha.clave}</strong>
                      <span>{ficha.abonado}</span>
                    </button>
                  </td>
                  <td>{ficha.barrio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>HoldButton junto a botones del sistema</h2>
        <div className="cl-drawer-main-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <HoldButton icon={<Icon name="trash" />} doneLabel="Eliminando…" onHold={() => {}}>
            Mantener para eliminar
          </HoldButton>
          <button type="button" className="cl-secondary">
            Cerrar
          </button>
          <HoldButton size="md" disabled>
            Deshabilitado
          </HoldButton>
        </div>
      </section>

      <section>
        <h2>StatusMark en la línea de tiempo</h2>
        <ul className="cl-history ent-timeline" style={{ background: "#fff", borderRadius: 12 }}>
          {INTENTOS.map((intento) => (
            <li key={intento.titulo}>
              <StatusMark status={intento.estado} errorColor={intento.color} spokenStatus={intento.detalle} />
              <div>
                <strong>12/09/2026 · {intento.titulo}</strong>
                <span>{intento.detalle} · Carlos Medina</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>
);
