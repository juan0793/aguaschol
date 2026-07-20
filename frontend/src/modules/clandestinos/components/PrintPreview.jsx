import { useRef, useState } from "react";
import { Icon } from "../../../components/Icon";
import { printDocument } from "../../../utils/printDocument";

const PRINT_STYLES = `<style>
  .cl-print-page { color: #111; font: 11px/1.35 Arial, sans-serif; break-after: page; }
  .cl-print-page:last-child { break-after: auto; }
  .cl-print-brand { display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 2px solid #102a43; }
  .cl-print-page h3 { margin: 18px 0; font-size: 20px; }
  .cl-print-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .cl-print-grid p { display: grid; padding: 8px; border-bottom: 1px solid #ccd6df; }
  .cl-print-grid span { color: #52606d; font-size: 9px; text-transform: uppercase; }
  .cl-print-notes { margin-top: 18px; padding: 12px; border: 1px solid #ccd6df; }
  .cl-print-page footer { margin-top: 28px; color: #52606d; text-align: center; }
  .cl-print-batch table { width: 100%; border-collapse: collapse; }
  .cl-print-batch th, .cl-print-batch td { padding: 7px; border: 1px solid #cbd5df; text-align: left; }
  .cl-print-batch th { background: #edf3f8; }
  .cl-print-batch tr { break-inside: avoid; }
</style>`;

const templates = [
  ["technical_sheet", "Ficha técnica", "Expediente completo sin observaciones internas"],
  ["notice", "Aviso", "Comunicación formal para el abonado"],
  ["inspection_order", "Orden de inspección", "Asignación y datos de ubicación"],
  ["evidences", "Evidencias", "Fotografías y referencias verificables"],
  ["batch_list", "Listado por lote", "Resumen tabular de la selección"]
];

const PrintPage = ({ record, label, template }) => {
  const validated = record.comentarios?.includes("Alcaldia");
  const appearsInAguas = /Aparece en (Alcaldia y )?Aguas/.test(record.comentarios || "");
  return <article className="cl-print-page"><div className="cl-print-brand"><strong>AGUAS DE CHOLUTECA</strong><span>{label}</span></div><h3>{record.clave_catastral}</h3><div className="cl-print-grid">
    <p><span>Abonado</span><strong>{record.abonado || "—"}</strong></p><p><span>Nombre</span><strong>{record.inquilino || record.nombre_catastral || "—"}</strong></p><p><span>Barrio / colonia</span><strong>{record.barrio_colonia || "—"}</strong></p><p><span>Estado</span><strong>{record.estado_operativo || "pending"}</strong></p><p><span>Agua potable</span><strong>{record.conexion_agua || "No"}</strong></p><p><span>Alcantarillado</span><strong>{record.conexion_alcantarillado || "No"}</strong></p><p><span>Tren de aseo</span><strong>{record.recoleccion_desechos || "No"}</strong></p><p><span>Técnico</span><strong>{record.levantamiento_datos || "—"}</strong></p>
    {template === "technical_sheet" ? <><p><span>Padrón Alcaldía</span><strong>{record.clave_alcaldia ? `Sí · ${record.clave_alcaldia}` : validated ? "No aparece" : "No validado"}</strong></p><p><span>Padrón Aguas</span><strong>{validated ? (appearsInAguas ? "Sí aparece" : "No aparece · Posible clandestino") : "No validado"}</strong></p></> : null}
  </div>{template !== "batch_list" ? <div className="cl-print-notes"><strong>Hallazgo / acción</strong><p>{record.accion_inspeccion || record.comentarios || "Sin observación para impresión."}</p></div> : null}<footer>Documento generado desde Control Aguas · {new Date().toLocaleDateString("es-HN")}</footer></article>;
};

const BatchList = ({ records }) => <article className="cl-print-page cl-print-batch"><div className="cl-print-brand"><strong>AGUAS DE CHOLUTECA</strong><span>Listado resumido de fichas</span></div><h3>{records.length} fichas seleccionadas</h3><table><thead><tr><th>#</th><th>Código catastral</th><th>Nombre</th><th>Barrio / colonia</th><th>Impresión</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td>{record.clave_catastral || "--"}</td><td>{record.nombre_catastral || record.inquilino || "--"}</td><td>{record.barrio_colonia || "--"}</td><td>{record.printed_at ? new Date(record.printed_at).toLocaleDateString("es-HN") : "No impresa"}</td></tr>)}</tbody></table><footer>Documento generado desde Control Aguas · {new Date().toLocaleDateString("es-HN")}</footer></article>;

export default function PrintPreview({ records = [] }) {
  const pagesRef = useRef(null);
  const [template, setTemplate] = useState(() => sessionStorage.getItem("aguas.clandestinos.printTemplate") || "technical_sheet");
  const [, label] = templates.find(([key]) => key === template) || templates[0];
  const select = (key) => { sessionStorage.setItem("aguas.clandestinos.printTemplate", key); setTemplate(key); };
  const print = () => pagesRef.current && printDocument(label, `${PRINT_STYLES}${pagesRef.current.innerHTML}`, { pageSize: "Letter portrait", pageMargin: "12mm" });
  return <div className="cl-print-layout"><aside className="cl-print-menu"><span className="cl-kicker">Documentos</span><h2>Centro de impresión</h2><p>Selecciona el formato y revisa antes de imprimir.</p>{templates.map(([key,title,helper]) => <button type="button" key={key} className={template === key ? "is-active" : ""} onClick={() => select(key)}><Icon name={key === "evidences" ? "activity" : "print"} /><span><strong>{title}</strong><small>{helper}</small></span><Icon name="arrowRight" /></button>)}</aside>
    <section className="cl-print-preview"><header><div><span className="cl-kicker">Vista previa</span><h2>{label}</h2><p>{records.length ? `${records.length} fichas seleccionadas` : "Selecciona fichas desde la bandeja; por ahora se muestra una vista vacía."}</p></div><button type="button" className="cl-primary" disabled={!records.length} onClick={print}><Icon name="print" />Imprimir</button></header>
      <div className="cl-print-pages" ref={pagesRef}>{records.length ? template === "batch_list" ? <BatchList records={records} /> : records.map((record) => <PrintPage key={record.id} record={record} label={label} template={template} />) : <div className="cl-print-empty"><Icon name="print" /><h3>Sin fichas seleccionadas</h3><p>Vuelve a Fichas y marca los expedientes que deseas imprimir.</p></div>}</div>
    </section></div>;
}
