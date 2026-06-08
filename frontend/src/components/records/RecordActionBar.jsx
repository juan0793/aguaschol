import { CheckCircle2, FilePlus2, Printer, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const getReviewLabel = (record) => {
  if (record?.estado_padron === "reportada") return "Reportada";
  if (record?.estado_padron === "varios_padrones") return "Varios padrones";
  return "Pendiente";
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
}) => (
  <div className="record-action-bar">
    <div className="record-action-bar-copy">
      <span className="sheet-kicker">Modo Fichas</span>
      <strong>{form.clave_catastral || "Ficha nueva"}</strong>
      <div>
        <Badge className={`record-status-chip ${isDirty ? "is-warning" : "is-success"}`}>
          {saving ? "Guardando" : isDirty ? "Cambios sin guardar" : "Sincronizada"}
        </Badge>
        <Badge className={`record-status-chip is-${form.estado_padron || "clandestino"}`}>{getReviewLabel(form)}</Badge>
      </div>
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
        Enviar para revision
      </Button>
    </div>
  </div>
);

export default RecordActionBar;
