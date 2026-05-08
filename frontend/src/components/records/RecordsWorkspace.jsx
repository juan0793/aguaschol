import { useMemo, useState } from "react";
import RecordActionBar from "./RecordActionBar";
import RecordAdminDecisionPanel from "./RecordAdminDecisionPanel";
import RecordComparisonPanel from "./RecordComparisonPanel";
import RecordEditor from "./RecordEditor";
import RecordPrintCenter from "./RecordPrintCenter";
import RecordsSidebar from "./RecordsSidebar";

const RecordsWorkspace = ({
  records,
  form,
  draftForm,
  loading,
  saving,
  loadingAviso,
  selectedFile,
  selectedPhotoUrl,
  localSelectedPhotoUrl,
  activeSection,
  validationIssues,
  isDirty,
  isAdmin,
  currentUser,
  padronMeta,
  alcaldiaMeta,
  alcaldiaComparison,
  loadingAlcaldiaComparison,
  processingRecordId,
  onChange,
  onFileChange,
  onSectionChange,
  onMoveSection,
  onSubmit,
  onSave,
  onNewRecord,
  onRestoreDraft,
  onSelectRecord,
  onGenerateAviso,
  onPrintFicha,
  onPrintAviso,
  onValidatePadron,
  onComparePadrones,
  onAdminDecision,
  showAlert
}) => {
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState("all");

  const visibleRecords = useMemo(() => {
    const query = sidebarSearch.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [record.clave_catastral, record.abonado, record.nombre_catastral, record.barrio_colonia]
        .some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [records, sidebarSearch]);

  return (
    <section className="records-workspace records-focus-mode">
      <RecordsSidebar
        records={visibleRecords}
        form={form}
        draftForm={draftForm}
        loading={loading}
        search={sidebarSearch}
        filter={sidebarFilter}
        onSearchChange={setSidebarSearch}
        onFilterChange={setSidebarFilter}
        onSelectRecord={onSelectRecord}
        onRestoreDraft={onRestoreDraft}
        onNewRecord={onNewRecord}
      />

      <main className="records-workspace-main">
        <RecordActionBar
          form={form}
          saving={saving}
          loadingAviso={loadingAviso}
          isDirty={isDirty}
          onSave={onSave}
          onNew={onNewRecord}
          onGenerateAviso={onGenerateAviso}
          onPrintFicha={() => onPrintFicha(form)}
          onPrintAviso={() => onPrintAviso(form)}
          onSendReview={() => showAlert("Ficha enviada visualmente para revision. En esta fase queda trazada en comentarios al guardar.")}
        />

        <div className="records-workspace-grid">
          <div className="records-workspace-editor">
            <RecordEditor
              form={form}
              activeSection={activeSection}
              selectedFile={selectedFile}
              selectedPhotoUrl={selectedPhotoUrl}
              localSelectedPhotoUrl={localSelectedPhotoUrl}
              validationIssues={validationIssues}
              saving={saving}
              onChange={onChange}
              onFileChange={onFileChange}
              onSectionChange={onSectionChange}
              onMoveSection={onMoveSection}
              onSubmit={onSubmit}
            />
          </div>

          <aside className="records-workspace-panels">
            <RecordComparisonPanel
              form={form}
              padronMeta={padronMeta}
              alcaldiaMeta={alcaldiaMeta}
              alcaldiaComparison={alcaldiaComparison}
              loadingAlcaldiaComparison={loadingAlcaldiaComparison}
              onValidate={onValidatePadron}
              onCompare={onComparePadrones}
            />
            {isAdmin ? (
              <RecordAdminDecisionPanel
                form={form}
                processing={Boolean(processingRecordId)}
                onDecision={onAdminDecision}
              />
            ) : null}
          </aside>
        </div>

        <RecordPrintCenter
          records={records}
          form={form}
          currentUser={currentUser}
          onGenerateAviso={onGenerateAviso}
          onPrintFicha={onPrintFicha}
          onPrintAviso={onPrintAviso}
          showAlert={showAlert}
        />
      </main>
    </section>
  );
};

export default RecordsWorkspace;
