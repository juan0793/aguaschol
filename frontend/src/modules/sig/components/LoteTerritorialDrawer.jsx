import { Icon } from "../../../components/Icon";
import { printDocument } from "../../../utils/printDocument";
import { activeServices, loteTitle, money, text, vinculoLabel } from "../utils/loteTerritorial";

const Row = ({ label, value }) => <div><dt>{label}</dt><dd>{value}</dd></div>;
const Count = ({ label, value }) => <span><strong>{value ?? 0}</strong>{label}</span>;
const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
const printRow = (label, value) => `<div><strong>${esc(label)}</strong><span>${esc(value)}</span></div>`;

export default function LoteTerritorialDrawer({ data, loading, error, session, onClose, onCreateInspection, onOpenFicha, onOpenFieldValidation }) {
  const padron = data?.abonado_actual;
  const services = activeServices(padron?.servicios);
  const fichas = data?.fichas_relacionadas || [];
  const puntos = data?.puntos_control || [];
  const inspecciones = data?.inspecciones || [];
  const canCreateInspection = session?.user?.role === "admin";
  const canOpenFicha = fichas.length === 1;
  const fichaAction = fichas.length > 1 ? "Fichas múltiples" : canOpenFicha ? "Ver ficha" : "Sin ficha relacionada";
  const print = () => printDocument(loteTitle(data), `
    <article class="print-ficha">
      <div class="print-header"><div class="print-title">Aguas de Choluteca</div><h1>Ficha territorial del lote</h1><div class="print-key">${esc(data?.clave_catastral || data?.catastro_clave || "Sin clave")}</div></div>
      <section class="print-section"><h3>Identificación territorial</h3><div class="print-data-grid">
        ${printRow("Barrio", text(data?.barrio))}
        ${printRow("Clave barrio", text(data?.barrio_clave, "Sin clave"))}
        ${printRow("Manzana", text(data?.manzana))}
        ${printRow("Lote", text(data?.numero_lote))}
        ${printRow("Vínculo", vinculoLabel(data?.vinculo?.estado))}
        ${printRow("Fuente", text(data?.source_dataset || data?.source_fid))}
      </div></section>
      <section class="print-section"><h3>Padrón / FoxPro</h3><div class="print-data-grid">
        ${printRow("Abonado", text(padron?.nombre || data?.inquilino || data?.abonado, "Sin cruce con padrón"))}
        ${printRow("Cuenta", text(padron?.abonado || data?.abonado, "Sin cuenta"))}
        ${printRow("Servicios", services.length ? services.join(", ") : padron ? "Sin activos" : "Sin dato")}
        ${printRow("Mora", money(padron?.mora?.total ?? padron?.total ?? 0))}
      </div></section>
      <section class="print-section"><h3>Actividad territorial</h3><div class="print-data-grid">
        ${printRow("Levantamientos", puntos.length)}
        ${printRow("Inspecciones", inspecciones.length)}
        ${printRow("Fichas clandestinas", fichas.length)}
      </div></section>
    </article>
  `, { pageSize: "Letter portrait", pageMargin: "10mm" });

  return (
    <aside className="sig-drawer sig-lote-drawer" aria-label="Expediente territorial del lote">
      <header>
        <div>
          <span>Expediente territorial</span>
          <h2>{loading ? "Cargando lote..." : loteTitle(data)}</h2>
          <p>{text(data?.clave_catastral || data?.catastro_clave, "Sin clave catastral")}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar expediente"><Icon name="logout" /></button>
      </header>

      {error ? <p className="sig-drawer-error">{error}</p> : null}
      {loading ? <p className="sig-empty-note">Consultando detalle territorial...</p> : (
        <>
          <div className={`sig-vinculo is-${data?.vinculo?.estado || "unlinked"}`}>
            <strong>{vinculoLabel(data?.vinculo?.estado)}</strong>
            <span>{data?.vinculo?.motivo || "Sin cruce confirmado."}</span>
          </div>

          <div className="sig-lote-counts">
            <Count label="Abonados" value={data?.catastro_relacionados?.length || (padron ? 1 : 0)} />
            <Count label="Levantamientos" value={puntos.length} />
            <Count label="Inspecciones" value={inspecciones.length} />
            <Count label="Fichas" value={fichas.length} />
          </div>

          <section>
            <h3>Identificación territorial</h3>
            <dl>
              <Row label="Barrio" value={text(data?.barrio)} />
              <Row label="Clave barrio" value={text(data?.barrio_clave, "Sin clave")} />
              <Row label="Manzana" value={text(data?.manzana)} />
              <Row label="Número de lote" value={text(data?.numero_lote)} />
              <Row label="Fuente" value={text(data?.source_dataset || data?.source_fid)} />
            </dl>
          </section>

          <section>
            <h3>Padrón / FoxPro</h3>
            <dl>
              <Row label="Abonado" value={text(padron?.nombre || data?.inquilino || data?.abonado, "Sin cruce con padrón")} />
              <Row label="Cuenta" value={text(padron?.abonado || data?.abonado, "Sin cuenta")} />
              <Row label="Servicios" value={services.length ? services.join(", ") : padron ? "Sin activos" : "Sin dato"} />
              <Row label="Mora" value={money(padron?.mora?.total ?? padron?.total ?? 0)} />
            </dl>
          </section>

          <section>
            <h3>Actividad territorial</h3>
            <dl>
              <Row label="Levantamientos" value={puntos.length ? `${puntos.length} relacionado(s)` : "Sin levantamientos"} />
              <Row label="Inspecciones" value={inspecciones.length ? `${inspecciones.length} relacionada(s)` : "Sin inspecciones"} />
              <Row label="Fichas clandestinas" value={fichas.length ? `${fichas.length} relacionada(s)` : "Sin ficha relacionada"} />
            </dl>
          </section>

          {data?.catastro_relacionados?.length > 1 ? <p className="sig-drawer-warning">La clave tiene varias coincidencias. Revisa antes de usarla como vínculo confirmado.</p> : null}

          <div className="sig-drawer-actions">
            <button type="button" disabled={!canOpenFicha} onClick={() => canOpenFicha && onOpenFicha?.(fichas[0])}><Icon name="records" />{fichaAction}</button>
            <button type="button" disabled={!canCreateInspection} onClick={() => onCreateInspection?.(data)}><Icon name="plus" />{canCreateInspection ? "Crear inspección" : "Sin permiso para crear"}</button>
            <button type="button" disabled={!puntos.length} onClick={() => onOpenFieldValidation?.(puntos.length === 1 ? { pointId: puntos[0].id } : { clave: data?.clave_catastral || data?.catastro_clave })}><Icon name="map" />Ver levantamientos</button>
            <button type="button" onClick={print}><Icon name="print" />Imprimir ficha</button>
          </div>
        </>
      )}
    </aside>
  );
}
