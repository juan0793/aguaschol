import { Camera, CheckCircle2, ClipboardCheck, FilePlus2, Printer, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const getReviewLabel = (record) => {
  if (record?.estado_padron === "reportada") return "Reportada";
  if (record?.estado_padron === "varios_padrones") return "Varios padrones";
  return "Pendiente";
};

const getWorkflowSteps = (form) => [
  {
    key: "datos",
    label: "Datos minimos",
    done: Boolean(form?.clave_catastral && (form?.abonado || form?.nombre_catastral) && form?.barrio_colonia)
  },
  {
    key: "validacion",
    label: "Validacion",
    done: Boolean(form?.clave_alcaldia || form?.estado_padron === "varios_padrones" || form?.estado_padron === "reportada")
  },
  {
    key: "foto",
    label: "Foto",
    done: Boolean(form?.foto_path)
  },
  {
    key: "aviso",
    label: "Aviso",
    done: Boolean(form?.fecha_aviso && form?.firmante_aviso && form?.cargo_firmante)
  }
];

const getNextStepLabel = (steps, isDirty) => {
  if (isDirty) return "Guardar cambios";
  const pending = steps.find((step) => !step.done);
  return pending ? pending.label : "Lista para imprimir";
};

const RecordActionBar = ({
  form,
  saving,
  loadingAviso,
  isDirty,
  onSave,
  onNew,
  onGenerateAviso,
  onPrintFicha,
  onPrintAviso,
  onSendReview
}) => {
  const workflowSteps = getWorkflowSteps(form);
  const completedSteps = workflowSteps.filter((step) => step.done).length;

  return (
    <div className="record-action-bar">
      <div className="record-action-bar-copy">
        <span className="sheet-kicker">Expediente clandestino</span>
        <strong>{form.clave_catastral || "Ficha nueva"}</strong>
        <div>
          <Badge className={`record-status-chip ${isDirty ? "is-warning" : "is-success"}`}>
            {saving ? "Guardando" : isDirty ? "Cambios sin guardar" : "Sincronizada"}
          </Badge>
          <Badge className={`record-status-chip is-${form.estado_padron || "clandestino"}`}>{getReviewLabel(form)}</Badge>
          <Badge className="record-status-chip is-muted">{completedSteps}/{workflowSteps.length} pasos</Badge>
        </div>
      </div>
      <div className="record-workflow-strip" aria-label="Avance de la ficha">
        {workflowSteps.map((step) => (
          <span key={step.key} className={step.done ? "is-done" : ""}>
            {step.done ? <CheckCircle2 aria-hidden="true" /> : step.key === "foto" ? <Camera aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}
            {step.label}
          </span>
        ))}
      </div>
      <div className="record-action-bar-buttons">
        <Button type="button" onClick={onSave} disabled={saving}>
          <CheckCircle2 />
          {saving ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onNew}>
          <FilePlus2 />
          Nueva ficha
        </Button>
        <Button type="button" variant="secondary" onClick={onGenerateAviso} disabled={loadingAviso}>
          <ShieldCheck />
          Preparar aviso
        </Button>
        <Button type="button" variant="secondary" onClick={onPrintFicha}>
          <Printer />
          Imprimir ficha
        </Button>
        <Button type="button" variant="secondary" onClick={onPrintAviso}>
          <Printer />
          Imprimir aviso
        </Button>
        <Button type="button" variant="secondary" onClick={onSendReview}>
          <Send />
          Revision
        </Button>
      </div>
      <span className="record-next-step">Siguiente: <strong>{getNextStepLabel(workflowSteps, isDirty)}</strong></span>
    </div>
  );
};

export default RecordActionBar;
