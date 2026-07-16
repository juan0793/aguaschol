import { Icon } from "../../../components/Icon";
import { useState } from "react";

const templates = [
  ["technical_sheet", "Ficha técnica", "Expediente completo sin observaciones internas"],
  ["notice", "Aviso", "Comunicación formal para el abonado"],
  ["inspection_order", "Orden de inspección", "Asignación y datos de ubicación"],
  ["evidences", "Evidencias", "Fotografías y referencias verificables"],
  ["batch_list", "Listado por lote", "Resumen tabular de la selección"]
];

export default function PrintPreview({ records = [] }) {
  const [template, setTemplate] = useState(() => sessionStorage.getItem("aguas.clandestinos.printTemplate") || "technical_sheet");
  const [, label] = templates.find(([key]) => key === template) || templates[0];
  const select = (key) => { sessionStorage.setItem("aguas.clandestinos.printTemplate", key); setTemplate(key); };
  return <div className="cl-print-layout"><aside className="cl-print-menu"><span className="cl-kicker">Documentos</span><h2>Centro de impresión</h2><p>Selecciona el formato y revisa antes de imprimir.</p>{templates.map(([key,title,helper]) => <button type="button" key={key} className={template === key ? "is-active" : ""} onClick={() => select(key)}><Icon name={key === "evidences" ? "activity" : "print"} /><span><strong>{title}</strong><small>{helper}</small></span><Icon name="arrowRight" /></button>)}</aside>
    <section className="cl-print-preview"><header><div><span className="cl-kicker">Vista previa</span><h2>{label}</h2><p>{records.length ? `${records.length} fichas seleccionadas` : "Selecciona fichas desde la bandeja; por ahora se muestra una vista vacía."}</p></div><button type="button" className="cl-primary" disabled={!records.length} onClick={() => window.print()}><Icon name="print" />Imprimir</button></header>
      <div className="cl-print-pages">{records.length ? records.map((record) => <article className="cl-print-page" key={record.id}><div className="cl-print-brand"><strong>AGUAS DE CHOLUTECA</strong><span>{label}</span></div><h3>{record.clave_catastral}</h3><div className="cl-print-grid"><p><span>Abonado</span><strong>{record.abonado || "—"}</strong></p><p><span>Nombre</span><strong>{record.inquilino || record.nombre_catastral || "—"}</strong></p><p><span>Barrio / colonia</span><strong>{record.barrio_colonia || "—"}</strong></p><p><span>Estado</span><strong>{record.estado_operativo || "pending"}</strong></p><p><span>Agua potable</span><strong>{record.conexion_agua || "No"}</strong></p><p><span>Alcantarillado</span><strong>{record.conexion_alcantarillado || "No"}</strong></p><p><span>Tren de aseo</span><strong>{record.recoleccion_desechos || "No"}</strong></p><p><span>Técnico</span><strong>{record.levantamiento_datos || "—"}</strong></p></div>{template !== "batch_list" ? <div className="cl-print-notes"><strong>Hallazgo / acción</strong><p>{record.accion_inspeccion || record.comentarios || "Sin observación para impresión."}</p></div> : null}<footer>Documento generado desde Control Aguas · {new Date().toLocaleDateString("es-HN")}</footer></article>) : <div className="cl-print-empty"><Icon name="print" /><h3>Sin fichas seleccionadas</h3><p>Vuelve a Fichas y marca los expedientes que deseas imprimir.</p></div>}</div>
    </section></div>;
}
