import { useEffect, useMemo, useState } from "react";

const LOG_STORAGE_KEY = "aguaschol:record-document-logs:v1";

const printFilters = [
  { key: "all", label: "Todas" },
  { key: "ficha_pending", label: "Pendiente generar ficha" },
  { key: "ficha_generated", label: "Ficha generada" },
  { key: "ficha_printed", label: "Ficha impresa" },
  { key: "aviso_pending", label: "Aviso pendiente" },
  { key: "aviso_generated", label: "Aviso generado" },
  { key: "aviso_printed", label: "Aviso impreso" },
  { key: "aviso_delivered", label: "Aviso entregado" },
  { key: "reprints", label: "Reimpresiones" }
];

const reprintReasons = ["Error en impresion", "Se dano el papel", "Correccion de datos", "Extraviado", "Solicitud administrativa", "Otro"];
const requiredFields = ["clave_catastral", "barrio_colonia", "fecha_aviso", "firmante_aviso", "cargo_firmante"];

const readLogs = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOG_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getRecordLogs = (logs, recordId, type) =>
  logs.filter((log) => String(log.record_id) === String(recordId) && log.document_type === type);

const getDocumentState = (logs, record, type) => {
  const docLogs = getRecordLogs(logs, record?.id, type);
  const printedLogs = docLogs.filter((log) => ["imprimir", "reimprimir"].includes(log.action));
  const deliveredLog = docLogs.find((log) => log.action === "marcar_entregado");
  const generatedLog = docLogs.find((log) => log.action === "generar");
  const lastPrint = printedLogs[printedLogs.length - 1] || null;
  const hasPrinted = printedLogs.length > 0;
  const hasReprint = printedLogs.some((log) => log.action === "reimprimir");
  const status = type === "aviso" && deliveredLog
    ? "entregado"
    : hasReprint
      ? "reimpresa"
      : hasPrinted
        ? "impresa"
        : generatedLog
          ? "generada"
          : "pendiente_generar";

  return {
    status,
    printCount: printedLogs.length,
    lastPrintedAt: lastPrint?.created_at || "",
    printedBy: lastPrint?.user || "",
    hasPrinted,
    logs: docLogs
  };
};

const formatDate = (value) => {
  if (!value) return "Nunca";
  try {
    return new Intl.DateTimeFormat("es-HN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
};

const getStatusLabel = (status) => ({
  pendiente_generar: "Pendiente",
  generada: "Generada",
  impresa: "Impresa",
  reimpresa: "Reimpresa",
  entregado: "Entregado"
}[status] || status.replace("_", " "));

const DocumentCard = ({ title, type, state, onGenerate, onPreview, onPrint, onDeliver }) => (
  <article className={`record-document-card is-${state.status} ${state.hasPrinted ? "is-printed" : ""}`}>
    <div className="record-document-card-head">
      <div>
        <span className="sheet-kicker">{title}</span>
        <strong>Estado: {getStatusLabel(state.status)}</strong>
      </div>
      <span className={`record-status-chip is-${state.status}`}>{state.printCount ? `${state.printCount} impresiones` : "Sin imprimir"}</span>
    </div>
    <div className="record-document-meta">
      <span>Ultima impresion: <strong>{formatDate(state.lastPrintedAt)}</strong></span>
      <span>Usuario: <strong>{state.printedBy || "--"}</strong></span>
    </div>
    <div className="record-document-actions">
      <button type="button" className="button-secondary" onClick={onGenerate}>Generar</button>
      <button type="button" className="button-secondary" onClick={onPreview}>Vista previa</button>
      <button type="button" onClick={onPrint}>{state.hasPrinted ? `Reimprimir ${type === "aviso" ? "aviso" : "ficha"}` : `Imprimir ${type === "aviso" ? "aviso" : "ficha"}`}</button>
      {type === "aviso" ? <button type="button" className="button-secondary" onClick={onDeliver}>Marcar aviso entregado</button> : null}
    </div>
  </article>
);

const RecordPrintCenter = ({ records, form, currentUser, onGenerateAviso, onPrintFicha, onPrintAviso, showAlert }) => {
  const [logs, setLogs] = useState(() => readLogs());
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);

  const addLog = (record, documentType, action, reason = "") => {
    if (!record?.id) return;
    setLogs((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),
        record_id: record.id,
        document_type: documentType,
        action,
        reason,
        user: currentUser?.full_name || currentUser?.username || "Usuario actual",
        created_at: new Date().toISOString()
      }
    ]);
  };

  const askReprintReason = (state) => {
    if (!state.hasPrinted) return "";
    const confirmReprint = window.confirm(`Este documento ya fue impreso el dia ${formatDate(state.lastPrintedAt)} por ${state.printedBy || "--"}. Desea reimprimirlo?`);
    if (!confirmReprint) return null;
    const reason = window.prompt(`Motivo obligatorio de reimpresion:\n\n${reprintReasons.map((item, index) => `${index + 1}. ${item}`).join("\n")}`, "");
    return reason?.trim() || null;
  };

  const warnMissingFields = (record, documentType) => {
    const missing = requiredFields.filter((field) => !String(record?.[field] || "").trim());
    if (!String(record?.abonado || record?.nombre_catastral || "").trim()) missing.push("abonado o nombre_catastral");
    if (documentType === "ficha_informacion" && !String(record?.foto_path || "").trim()) missing.push("foto_path");
    if (!missing.length) return true;
    return window.confirm(`Faltan datos minimos para imprimir: ${missing.join(", ")}. Desea continuar?`);
  };

  const runPrint = async (record, documentType, handler, state) => {
    if (!record?.id) {
      showAlert("Selecciona o guarda una ficha antes de imprimir.");
      return;
    }
    if (!warnMissingFields(record, documentType)) return;
    const reason = askReprintReason(state);
    if (reason === null) return;
    await handler(record);
    addLog(record, documentType, state.hasPrinted ? "reimprimir" : "imprimir", reason || "");
  };

  const selectedRecords = useMemo(() => {
    const pool = form?.id ? [form, ...records.filter((record) => record.id !== form.id)] : records;
    return pool.filter((record) => {
      const ficha = getDocumentState(logs, record, "ficha_informacion");
      const aviso = getDocumentState(logs, record, "aviso");
      if (filter === "ficha_pending") return ficha.status === "pendiente_generar";
      if (filter === "ficha_generated") return ficha.status === "generada";
      if (filter === "ficha_printed") return ficha.hasPrinted;
      if (filter === "aviso_pending") return aviso.status === "pendiente_generar";
      if (filter === "aviso_generated") return aviso.status === "generada";
      if (filter === "aviso_printed") return aviso.hasPrinted;
      if (filter === "aviso_delivered") return aviso.status === "entregado";
      if (filter === "reprints") return ficha.status === "reimpresa" || aviso.status === "reimpresa";
      return true;
    });
  }, [filter, form, logs, records]);

  const selectedRecord = form?.id ? selectedRecords.find((record) => record.id === form.id) : null;
  const queuedRecords = selectedRecord
    ? selectedRecords.filter((record) => record.id !== selectedRecord.id)
    : selectedRecords;

  const renderBundle = (record, variant = "queue") => {
    const ficha = getDocumentState(logs, record, "ficha_informacion");
    const aviso = getDocumentState(logs, record, "aviso");

    return (
      <article key={`documents-${record.id}`} className={`record-document-bundle ${variant === "current" ? "is-current" : ""} ${record.estado_padron === "reportada" ? "is-printed" : ""}`}>
        <div className="record-document-summary">
          <div>
            <span className="sheet-kicker">{variant === "current" ? "Ficha actual" : "En cola"}</span>
            <strong>{record.clave_catastral || "Sin clave"}</strong>
            <span>{record.abonado || record.nombre_catastral || "Sin abonado"} - {record.barrio_colonia || "Sin barrio"}</span>
          </div>
          {record.estado_padron === "reportada" ? <span className="record-status-chip is-printed">Ficha impresa/reportada</span> : null}
        </div>
        <div className="record-document-grid">
          <DocumentCard
            title="Documento 1: Ficha de informacion"
            type="ficha"
            state={ficha}
            onGenerate={() => {
              onPrintFicha(record);
              addLog(record, "ficha_informacion", "generar");
            }}
            onPreview={() => onPrintFicha(record)}
            onPrint={() => runPrint(record, "ficha_informacion", onPrintFicha, ficha)}
          />
          <DocumentCard
            title="Documento 2: Aviso"
            type="aviso"
            state={aviso}
            onGenerate={async () => {
              if (form.id === record.id) await onGenerateAviso();
              addLog(record, "aviso", "generar");
            }}
            onPreview={() => onPrintAviso(record)}
            onPrint={() => runPrint(record, "aviso", onPrintAviso, aviso)}
            onDeliver={() => addLog(record, "aviso", "marcar_entregado")}
          />
        </div>
      </article>
    );
  };

  return (
    <section className="record-print-center">
      <div className="record-panel-head">
        <div>
          <span className="sheet-kicker">Documentos de la ficha</span>
          <h3>Centro de impresion</h3>
        </div>
        <span className="record-status-chip is-muted">{selectedRecords.length} en vista</span>
      </div>
      <div className="records-workspace-filters">
        {printFilters.map((item) => (
          <button key={item.key} type="button" className={filter === item.key ? "is-active" : ""} onClick={() => setFilter(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="record-print-list">
        {selectedRecord ? renderBundle(selectedRecord, "current") : null}
        {queuedRecords.slice(0, selectedRecord ? 8 : 12).map((record) => renderBundle(record))}
        {!selectedRecords.length ? (
          <div className="records-empty-state">
            <strong>No hay documentos con este filtro</strong>
            <p>Cambia el filtro o selecciona una ficha en la lista.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default RecordPrintCenter;
