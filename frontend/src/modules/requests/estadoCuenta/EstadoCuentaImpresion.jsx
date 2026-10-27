import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { formatCurrency } from "../../../utils/formatting";
import "./estadoCuenta.css";

const money = (valor) => formatCurrency(Number(valor) || 0);

// Estado de cuenta de un abonado: una hoja carta para entregar en ventanilla o
// adjuntar a un reclamo. Lo primero es cuánto debe; después de qué se compone,
// qué servicios tiene y las firmas. Sin <header> ni <footer>: la regla global de
// impresión los oculta. El PDF (estadoCuentaPdf.js) repite este mismo diseño.
export default function EstadoCuentaImpresion({ datos }) {
  const { estado } = datos;
  return (
    <article className={`pq-ec is-${estado}`}>
      <div className="pq-ec-cabeza">
        <img src={logoAguasCholuteca} alt="Aguas de Choluteca" />
        <div className="pq-ec-empresa">
          <span>Aguas de Choluteca, S.A. de C.V.</span>
          <h1>Estado de cuenta</h1>
        </div>
        <dl className="pq-ec-meta">
          <div><dt>Emitido</dt><dd>{datos.emitido || "--"}</dd></div>
          {datos.padron ? <div><dt>Padrón</dt><dd>{datos.padron}</dd></div> : null}
        </dl>
      </div>

      <section className="pq-ec-abonado">
        <p className="pq-ec-rotulo">Abonado</p>
        <h2>{datos.nombre}</h2>
        <dl className="pq-ec-datos">
          <div><dt>Número de abonado</dt><dd className="is-mono">{datos.abonado}</dd></div>
          <div><dt>Clave catastral</dt><dd className="is-mono">{datos.clave}</dd></div>
          <div><dt>Barrio o colonia</dt><dd>{datos.barrio}</dd></div>
        </dl>
      </section>

      <section className="pq-ec-saldo">
        <div className="pq-ec-total">
          <p className="pq-ec-rotulo">{datos.rotuloSaldo}</p>
          <strong>{money(estado === "a-favor" ? Math.abs(datos.total) : datos.total)}</strong>
          <p className="pq-ec-nota">{datos.notaSaldo}</p>
        </div>
        <div className="pq-ec-partes">
          {estado === "deuda" ? <div className="pq-ec-barra" aria-hidden="true">
            <i style={{ width: `${datos.parteCapital}%` }} />
            <b style={{ width: `${datos.parteIntereses}%` }} />
          </div> : null}
          <table>
            <tbody>
              <tr>
                <th><i className="is-capital" aria-hidden="true" />Capital</th>
                <td>{money(datos.capital)}</td>
                <td className="pq-ec-pct">{estado === "deuda" ? `${datos.parteCapital} %` : ""}</td>
              </tr>
              <tr>
                <th><i className="is-intereses" aria-hidden="true" />Intereses</th>
                <td>{money(datos.intereses)}</td>
                <td className="pq-ec-pct">{estado === "deuda" ? `${datos.parteIntereses} %` : ""}</td>
              </tr>
              <tr className="is-total">
                <th>{estado === "a-favor" ? "Saldo a favor" : "Saldo total"}</th>
                <td>{money(estado === "a-favor" ? Math.abs(datos.total) : datos.total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="pq-ec-servicios">
        <h3>Servicios del inmueble</h3>
        <ul>
          {datos.servicios.map((servicio) => (
            <li key={servicio.campo} className={servicio.activo ? "is-activo" : ""}>
              <span>{servicio.etiqueta}</span>
              <b>{servicio.activo ? "Activo" : "No tiene"}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="pq-ec-firmas">
        <div><span />Atendido por (nombre y firma)</div>
        <div><span />Recibido por el abonado</div>
      </section>

      <div className="pq-ec-pie">
        <p><b>Información confidencial.</b> Uso interno de Aguas de Choluteca; montos según el padrón maestro.</p>
        <p>{datos.reportId ? `ID ${datos.reportId}` : ""}</p>
      </div>
    </article>
  );
}
