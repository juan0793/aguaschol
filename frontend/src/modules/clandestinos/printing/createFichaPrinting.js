import { buildPhotoUrl } from "../../../utils/formatting";
import { clampPrintCopies } from "../../../utils/recordLabels";
import { emptyForm } from "../../../constants/formsAndUi";
import { escapeHtml } from "../../../utils/html";
import { fileToDataUrl, urlToDataUrl, urlToResizedDataUrl } from "../../../utils/imageUtils";
import { formatSpanishDate, normalizeRecord } from "../../../utils/datesAndBusiness";
import logoAguasCholuteca from "../../../assets/logo-aguas-choluteca.png";
import { announceReportGenerated, createReportId, printDocument } from "../../../utils/printDocument";
import { describeAvisoPlazo, etiquetaPlazo } from "../avisoPlazo";
import { ESTILOS_LOTE, armarPaginasLote, mapEnOrden, resumenLoteHtml, tituloLote } from "./loteImpresion";

export function createFichaPrinting({
  apiFetch,
  batchPrintSelection,
  filteredPrintBatchRecords,
  form,
  getRecordBarrioName,
  loadRecords,
  manualPrintedSelection,
  printedSaveSelection,
  recordView,
  search,
  selectedFile,
  selectedPhotoUrl,
  setBatchPrintCopies,
  setBatchPrinting,
  setForm,
  setPrintBatchQuickFilter,
  setPrintBatchSearch,
  setPrintBatchStatusView,
  setRecords,
  setShowDashboardAlertsModal,
  setShowPrintBatchModal,
  showAlert
}) {
  const openPrintBatchModalForRecords = (targetRecords = [], documentType = "ficha") => {
    const selectedCopies = {};
    targetRecords.forEach((record) => {
      if (!record?.id) return;
      selectedCopies[record.id] = {
        ficha: documentType === "ficha" ? 1 : 0,
        aviso: documentType === "aviso" ? 1 : 0
      };
    });
    setPrintBatchSearch("");
    setPrintBatchQuickFilter(documentType === "aviso" ? "aviso_selected" : "ficha_selected");
    setPrintBatchStatusView("pending");
    setBatchPrintCopies(selectedCopies);
    setShowPrintBatchModal(true);
  };

  const updateBatchPrintCopies = (recordId, documentType, value) => {
    const nextValue = clampPrintCopies(value);
    setBatchPrintCopies((current) => ({
      ...current,
      [recordId]: {
        ficha: clampPrintCopies(current[recordId]?.ficha ?? 0),
        aviso: clampPrintCopies(current[recordId]?.aviso ?? 0),
        save: Boolean(current[recordId]?.save),
        printed: Boolean(current[recordId]?.printed),
        [documentType]: nextValue
      }
    }));
  };

  const adjustBatchPrintCopies = (recordId, documentType, delta) => {
    setBatchPrintCopies((current) => {
      const currentValue = clampPrintCopies(current[recordId]?.[documentType] ?? 0);
      return {
        ...current,
        [recordId]: {
          ficha: clampPrintCopies(current[recordId]?.ficha ?? 0),
          aviso: clampPrintCopies(current[recordId]?.aviso ?? 0),
          save: Boolean(current[recordId]?.save),
          printed: Boolean(current[recordId]?.printed),
          [documentType]: clampPrintCopies(currentValue + delta)
        }
      };
    });
  };

  const clearBatchPrintCopies = () => {
    setBatchPrintCopies({});
  };

  const selectVisibleBatchPrintCopies = (documentType) => {
    setBatchPrintCopies((current) => {
      const nextCopies = { ...current };
      filteredPrintBatchRecords.forEach((record) => {
        nextCopies[record.id] = {
          ficha: documentType === "ficha" ? 1 : clampPrintCopies(nextCopies[record.id]?.ficha ?? 0),
          aviso: documentType === "aviso" ? 1 : clampPrintCopies(nextCopies[record.id]?.aviso ?? 0),
          save: Boolean(nextCopies[record.id]?.save),
          printed: Boolean(nextCopies[record.id]?.printed)
        };
      });
      return nextCopies;
    });
  };

  const togglePrintedSaveSelection = (recordId) => {
    setBatchPrintCopies((current) => ({
      ...current,
      [recordId]: {
        ficha: clampPrintCopies(current[recordId]?.ficha ?? 0),
        aviso: clampPrintCopies(current[recordId]?.aviso ?? 0),
        save: !current[recordId]?.save,
        printed: Boolean(current[recordId]?.printed)
      }
    }));
  };

  const togglePendingPrintedSelection = (recordId) => {
    setBatchPrintCopies((current) => ({
      ...current,
      [recordId]: {
        ficha: clampPrintCopies(current[recordId]?.ficha ?? 0),
        aviso: clampPrintCopies(current[recordId]?.aviso ?? 0),
        save: Boolean(current[recordId]?.save),
        printed: !current[recordId]?.printed
      }
    }));
  };

  const selectVisiblePrintedForSave = () => {
    setBatchPrintCopies((current) => {
      const nextCopies = { ...current };
      filteredPrintBatchRecords
        .filter((record) => record.estado_padron === "reportada")
        .forEach((record) => {
          nextCopies[record.id] = {
            ficha: clampPrintCopies(nextCopies[record.id]?.ficha ?? 0),
            aviso: clampPrintCopies(nextCopies[record.id]?.aviso ?? 0),
            save: true,
            printed: Boolean(nextCopies[record.id]?.printed)
          };
        });
      return nextCopies;
    });
  };

  const selectVisiblePendingAsPrinted = () => {
    setBatchPrintCopies((current) => {
      const nextCopies = { ...current };
      filteredPrintBatchRecords
        .filter((record) => record.estado_padron !== "reportada")
        .forEach((record) => {
          nextCopies[record.id] = {
            ficha: clampPrintCopies(nextCopies[record.id]?.ficha ?? 0),
            aviso: clampPrintCopies(nextCopies[record.id]?.aviso ?? 0),
            save: Boolean(nextCopies[record.id]?.save),
            printed: true
          };
        });
      return nextCopies;
    });
  };

  const markBatchFichaRecordsAsPrinted = async (entries) => {
    const recordsToMove = entries
      .filter((item) => item.ficha > 0 && item.record?.id)
      .map((item) => item.record);

    if (!recordsToMove.length) return 0;

    const movedIds = new Set(recordsToMove.map((record) => record.id));
    const optimisticRecords = recordsToMove.map((record) =>
      normalizeRecord({
        ...record,
        estado_padron: "reportada",
        printed_at: record.printed_at || new Date().toISOString(),
        comentarios: record.comentarios || "Ficha impresa desde impresion rapida"
      })
    );
    const optimisticById = new Map(optimisticRecords.map((record) => [record.id, record]));

    setRecords((current) =>
      current.map((record) => (optimisticById.has(record.id) ? optimisticById.get(record.id) : record))
    );
    setBatchPrintCopies((current) => {
      const nextCopies = { ...current };
      movedIds.forEach((id) => {
        delete nextCopies[id];
      });
      return nextCopies;
    });

    if (movedIds.has(form.id)) {
      const updatedForm = optimisticById.get(form.id);
      if (updatedForm) {
        setForm({ ...emptyForm, ...updatedForm });
      }
    }

    const updatedRecords = await Promise.all(
      optimisticRecords.map(async (record) => {
        const response = await apiFetch(`/inmuebles/${record.id}/mark-printed`, {
          method: "POST"
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || `No se pudo mover la ficha ${record.clave_catastral}.`);
        }

        return normalizeRecord(data);
      })
    );
    const updatedById = new Map(updatedRecords.map((record) => [record.id, record]));

    setRecords((current) =>
      current.map((record) => (updatedById.has(record.id) ? updatedById.get(record.id) : record))
    );
    if (updatedById.has(form.id)) {
      setForm({ ...emptyForm, ...updatedById.get(form.id) });
    }

    return updatedRecords.length;
  };

  const handleMoveSelectedFichasToPrinted = async () => {
    const manualEntries = manualPrintedSelection.entries.map((record) => ({ record, ficha: 1, aviso: 0 }));
    const entriesToMove = [
      ...batchPrintSelection.entries.filter((item) => item.ficha > 0),
      ...manualEntries.filter(
        (manualItem) => !batchPrintSelection.entries.some((item) => item.record.id === manualItem.record.id && item.ficha > 0)
      )
    ];

    if (!entriesToMove.length) {
      showAlert("Selecciona fichas o marca las que ya fueron impresas.");
      return;
    }

    setBatchPrinting(true);
    try {
      const movedCount = await markBatchFichaRecordsAsPrinted(entriesToMove);
      setPrintBatchStatusView("printed");
      showAlert(`${movedCount} fichas pasaron a impresas.`);
    } catch (error) {
      loadRecords(search, recordView, { silent: true });
      showAlert(error.message || "No fue posible mover las fichas seleccionadas.");
    } finally {
      setBatchPrinting(false);
    }
  };

  const handleMarkSelectedAlertsAsPrinted = async () => {
    const entriesToMove = manualPrintedSelection.entries.map((record) => ({ record, ficha: 1, aviso: 0 }));
    if (!entriesToMove.length) {
      showAlert("Marca al menos una ficha como ya impresa.");
      return;
    }

    setBatchPrinting(true);
    try {
      const movedCount = await markBatchFichaRecordsAsPrinted(entriesToMove);
      setShowDashboardAlertsModal(false);
      setPrintBatchStatusView("printed");
      showAlert(`${movedCount} fichas pasaron a impresas sin reimprimir.`);
    } catch (error) {
      loadRecords(search, recordView, { silent: true });
      showAlert(error.message || "No fue posible marcar las fichas como impresas.");
    } finally {
      setBatchPrinting(false);
    }
  };

  const handleSaveSelectedPrintedRecords = async () => {
    if (!printedSaveSelection.total) {
      showAlert("Marca al menos una ficha impresa para enviarla a guardadas.");
      return;
    }

    setBatchPrinting(true);
    try {
      const selectedRecords = printedSaveSelection.entries;
      await Promise.all(
        selectedRecords.map(async (record) => {
          const response = await apiFetch(`/inmuebles/${record.id}/archive`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ archived_reason: "Ficha impresa enviada a guardadas" })
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || `No se pudo guardar la ficha ${record.clave_catastral}.`);
          }

          return normalizeRecord(data);
        })
      );

      const savedIds = new Set(selectedRecords.map((record) => record.id));
      setRecords((current) => current.filter((record) => !savedIds.has(record.id)));
      setBatchPrintCopies((current) => {
        const nextCopies = { ...current };
        savedIds.forEach((id) => {
          delete nextCopies[id];
        });
        return nextCopies;
      });
      if (savedIds.has(form.id)) {
        setForm(emptyForm);
      }
      showAlert(`${selectedRecords.length} fichas impresas pasaron a guardadas.`);
    } catch (error) {
      loadRecords(search, recordView, { silent: true });
      showAlert(error.message || "No fue posible enviar las fichas impresas a guardadas.");
    } finally {
      setBatchPrinting(false);
    }
  };

  const handlePrintBatch = async () => {
    if (!batchPrintSelection.fichas && !batchPrintSelection.avisos) {
      showAlert("Selecciona al menos una ficha o aviso para imprimir.");
      return;
    }

    setBatchPrinting(true);
    setShowPrintBatchModal(false);

    try {
      let movedCount = 0;
      const fichaPages = [];
      for (const item of batchPrintSelection.entries) {
        for (let copy = 0; copy < item.ficha; copy += 1) {
          const fichaDocument = await buildFichaPrintDocument(item.record);
          fichaPages.push(`<section class="print-batch-page">${fichaDocument.body}</section>`);
        }
      }

      if (fichaPages.length) {
        const printResult = await printDocument(`Lote de fichas (${fichaPages.length})`, fichaPages.join(""), {
          bodyClassName: "print-ficha",
          pageSize: "Letter landscape",
          pageMargin: "8mm 8mm 8mm 12mm",
          windowFeatures: "width=1400,height=900"
        });

        if (!printResult?.printed) {
          showAlert("Vista previa cerrada. Las fichas no se movieron a reportadas.");
          return;
        }

        movedCount = await markBatchFichaRecordsAsPrinted(batchPrintSelection.entries);
        if (movedCount) {
          setPrintBatchStatusView("printed");
        }
      }

      const avisoPages = [];
      for (const item of batchPrintSelection.entries) {
        for (let copy = 0; copy < item.aviso; copy += 1) {
          avisoPages.push(`<section class="print-batch-page">${buildAvisoPrintMarkup(item.record)}</section>`);
        }
      }

      if (avisoPages.length) {
        await printDocument(`Lote de avisos (${avisoPages.length})`, avisoPages.join(""), {
          pageSize: "Letter portrait",
          pageMargin: "10mm",
          windowFeatures: "width=980,height=1200"
        });
      }

      showAlert(
        movedCount
          ? `Lote impreso: ${batchPrintSelection.fichas} fichas y ${batchPrintSelection.avisos} avisos. ${movedCount} fichas pasaron a reportadas.`
          : `Lote preparado: ${batchPrintSelection.fichas} fichas y ${batchPrintSelection.avisos} avisos.`
      );
    } catch (error) {
      loadRecords(search, recordView, { silent: true });
      showAlert(error.message || "No fue posible preparar el lote de impresion.");
    } finally {
      setBatchPrinting(false);
    }
  };

  // silent: en un lote no se avisa ficha por ficha si falta la foto; se devuelve
  // photoMissing y el lote da un solo mensaje al final.
  const buildFichaPrintDocument = async (recordOverride = null, { silent = false } = {}) => {
    const targetRecord = recordOverride ? { ...emptyForm, ...normalizeRecord(recordOverride) } : form;
    let photoMarkup = "";
    let photoMissing = false;
    let alcaldiaFichaMatch = null;
    let alcaldiaSearchMode = "";
    // La clave escrita en el formulario solo sirve para la ficha abierta; en un lote
    // todas las fichas sin clave tomaban esa misma.
    const visibleClaveInput = recordOverride ? "" : document.querySelector('input[name="clave_catastral"]')?.value?.trim() || "";
    const recordClaveCatastral = String(targetRecord.clave_catastral || visibleClaveInput || "").trim();

    try {
      if (!recordOverride && selectedFile) {
        const dataUrl = await fileToDataUrl(selectedFile);
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      } else if (!recordOverride && selectedPhotoUrl) {
        const dataUrl = await urlToDataUrl(selectedPhotoUrl);
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      } else if (recordOverride?.foto_path) {
        const photoUrl = buildPhotoUrl(recordOverride.foto_path, recordOverride.updated_at || Date.now());
        const dataUrl = silent ? await urlToResizedDataUrl(photoUrl) : await urlToDataUrl(photoUrl);
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      }
    } catch (_error) {
      photoMissing = true;
      if (!silent) showAlert("La ficha se imprimira sin foto porque no fue posible cargarla a tiempo.");
    }

    const fetchAlcaldiaMatches = async (query, field = "clave") => {
      if (!String(query ?? "").trim()) return [];
      const response = await apiFetch(
        `/claves/alcaldia/search?field=${encodeURIComponent(field)}&clave=${encodeURIComponent(query)}`
      );
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data.matches) ? data.matches : [];
    };

    if (recordClaveCatastral) {
      try {
        const matches = await fetchAlcaldiaMatches(recordClaveCatastral, "clave");
        alcaldiaFichaMatch = matches[0] ?? null;
        alcaldiaSearchMode = alcaldiaFichaMatch ? "clave" : "";
      } catch {
        alcaldiaFichaMatch = null;
      }
    }

    if (!alcaldiaFichaMatch) {
      const textCandidates = [
        targetRecord.nombre_catastral,
        targetRecord.inquilino,
        targetRecord.identidad,
        getRecordBarrioName(targetRecord, "")
      ]
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length >= 3 && value !== "--");

      for (const candidate of textCandidates) {
        try {
          const matches = await fetchAlcaldiaMatches(candidate, "texto");
          alcaldiaFichaMatch =
            matches.find((item) => !item.exists_in_aguas) ??
            matches.find((item) =>
              normalizeRecord({ nombre_catastral: item.nombre }).nombre_catastral
                ?.toLowerCase()
                .includes(candidate.toLowerCase())
            ) ??
            matches[0] ??
            null;
          if (alcaldiaFichaMatch) {
            alcaldiaSearchMode = "nombre/barrio";
            break;
          }
        } catch {
          alcaldiaFichaMatch = null;
        }
      }
    }

    const aguasMatchKey = alcaldiaFichaMatch?.aguas_matches?.[0]?.clave_catastral || "";
    const hasAguasPadronMatch = Boolean(alcaldiaFichaMatch?.exists_in_aguas || targetRecord.estado_padron === "varios_padrones");
    const fichaClaveAguas = hasAguasPadronMatch
      ? aguasMatchKey || recordClaveCatastral || alcaldiaFichaMatch?.clave_aguas_formato || "--"
      : "No registrada en Aguas";
    const fichaClaveAlcaldia = targetRecord.clave_alcaldia || alcaldiaFichaMatch?.clave_catastral || (!hasAguasPadronMatch ? recordClaveCatastral : "--");
    const fichaNombre = targetRecord.nombre_alcaldia || alcaldiaFichaMatch?.nombre || targetRecord.nombre_catastral || targetRecord.inquilino || "--";
    const fichaBarrio = getRecordBarrioName(targetRecord, "") || targetRecord.barrio_alcaldia || alcaldiaFichaMatch?.caserio || alcaldiaFichaMatch?.direccion || "--";
    const alcaldiaBarrio = targetRecord.barrio_alcaldia || alcaldiaFichaMatch?.caserio || alcaldiaFichaMatch?.direccion || "--";
    const fichaDireccion = alcaldiaFichaMatch?.direccion || targetRecord.barrio_alcaldia || getRecordBarrioName(targetRecord, "") || "--";
    const estadoPadronLabel = targetRecord.estado_padron === "reportada"
      ? "Reportada"
      : targetRecord.estado_padron === "varios_padrones" || alcaldiaFichaMatch?.exists_in_aguas
        ? "En varios padrones"
        : "Clandestina";
    const estadoPadronClass = estadoPadronLabel === "Clandestina" ? "is-clandestine" : "is-matched";
    const alcaldiaStatus = alcaldiaFichaMatch
      ? alcaldiaFichaMatch.exists_in_aguas
        ? "Aparece en ambos padrones"
        : "Clandestino: aparece en Alcaldia y no en Aguas"
      : targetRecord.estado_padron === "reportada"
        ? "Clandestino procesada y enviada a reportadas"
      : targetRecord.estado_padron === "varios_padrones"
        ? "Aparece en varios padrones"
        : "Sin coincidencia en Alcaldia";

    return {
      photoMissing,
      title: `Ficha ${fichaClaveAlcaldia !== "--" ? fichaClaveAlcaldia : fichaClaveAguas}`,
      body: `
        <div class="print-ficha-compact-header">
          <div class="print-ficha-brand">
            <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
            <div>
              <p>Aguas de Choluteca, S.A. de C.V.</p>
              <h2 class="print-title">Ficha Tecnica Catastral</h2>
              <span>Barrio El Centro Antiguo Local de Cooperativa Guadalupe · Tel: 2782-5075</span>
            </div>
          </div>
          <div class="print-key-grid">
            <div class="print-key"><strong>Clave Aguas de Choluteca</strong><span>${escapeHtml(fichaClaveAguas)}</span></div>
            <div class="print-key"><strong>Clave Alcaldia</strong><span>${escapeHtml(fichaClaveAlcaldia)}</span></div>
          </div>
        </div>
        <section class="print-clandestine-band ${estadoPadronClass}">
          <div>
            <strong>${escapeHtml(estadoPadronLabel)}</strong>
            <span>${escapeHtml(alcaldiaStatus)} - Busqueda por ${escapeHtml(alcaldiaSearchMode || "clave/nombre")}</span>
          </div>
          <div>
            <strong>${escapeHtml(fichaNombre)}</strong>
            <span>${escapeHtml(fichaBarrio)}</span>
          </div>
        </section>
        <div class="print-layout">
          <div class="print-top-layout">
            <div class="print-main-column">
              <section class="print-section print-section-feature">
                <h3>Resumen de padrones</h3>
                <div class="print-summary-grid">
                  <div><strong>Nombre Alcaldia</strong><span>${escapeHtml(fichaNombre)}</span></div>
                  <div><strong>Barrio ficha</strong><span>${escapeHtml(fichaBarrio)}</span></div>
                  <div><strong>Barrio Alcaldia</strong><span>${escapeHtml(alcaldiaBarrio)}</span></div>
                  <div><strong>Direccion</strong><span>${escapeHtml(fichaDireccion)}</span></div>
                  <div><strong>Identificador</strong><span>${escapeHtml(alcaldiaFichaMatch?.identificador || targetRecord.identidad || "--")}</span></div>
                  <div><strong>Estado</strong><span>${escapeHtml(estadoPadronLabel)}</span></div>
                </div>
              </section>
              <section class="print-section">
                <h3>Datos principales</h3>
                <div class="print-data-grid">
                  <div><strong>Abonado</strong><span>${escapeHtml(targetRecord.abonado || "--")}</span></div>
                  <div><strong>Catastral/Ficha</strong><span>${escapeHtml(targetRecord.nombre_catastral || fichaNombre)}</span></div>
                  <div><strong>Inquilino</strong><span>${escapeHtml(targetRecord.inquilino || "--")}</span></div>
                  <div><strong>Identidad</strong><span>${escapeHtml(targetRecord.identidad || alcaldiaFichaMatch?.identificador || "--")}</span></div>
                  <div><strong>Telefono</strong><span>${escapeHtml(targetRecord.telefono || "--")}</span></div>
                  <div><strong>Sector</strong><span>${escapeHtml(targetRecord.codigo_sector || alcaldiaFichaMatch?.codigo_caserio || "--")}</span></div>
                </div>
              </section>
              <section class="print-section">
                <h3>Identificacion del inmueble</h3>
                <p class="print-note">${escapeHtml(targetRecord.accion_inspeccion || "--")}</p>
              </section>
              <section class="print-section">
                <h3>Datos del inmueble</h3>
                <div class="print-data-grid is-four">
                  <div><strong>Situacion</strong><span>${escapeHtml(targetRecord.situacion_inmueble || "--")}</span></div>
                  <div><strong>Tendencia</strong><span>${escapeHtml(targetRecord.tendencia_inmueble || "--")}</span></div>
                  <div><strong>Uso del suelo</strong><span>${escapeHtml(targetRecord.uso_suelo || alcaldiaFichaMatch?.naturaleza || "--")}</span></div>
                  <div><strong>Actividad</strong><span>${escapeHtml(targetRecord.actividad || "--")}</span></div>
                  <div><strong>Codigo sector</strong><span>${escapeHtml(targetRecord.codigo_sector || alcaldiaFichaMatch?.codigo_caserio || "--")}</span></div>
                  <div class="is-wide"><strong>Comentarios</strong><span>${escapeHtml(targetRecord.comentarios || (alcaldiaFichaMatch && !alcaldiaFichaMatch.exists_in_aguas ? "Clandestino" : "--"))}</span></div>
                </div>
              </section>
              <section class="print-section">
                <h3>Datos de los servicios</h3>
                <div class="print-service-row">
                  <div><strong>Agua potable</strong><span>${escapeHtml(targetRecord.conexion_agua || "--")}</span></div>
                  <div><strong>Alcantarillado</strong><span>${escapeHtml(targetRecord.conexion_alcantarillado || "--")}</span></div>
                  <div><strong>Desechos</strong><span>${escapeHtml(targetRecord.recoleccion_desechos || "--")}</span></div>
                </div>
              </section>
            </div>
            <div class="print-side-column">
              <section class="print-section">
                <h3>Fotografia del inmueble</h3>
                <div class="print-photo-panel">
                  ${photoMarkup || '<div class="print-field"><strong>Fotografia</strong>Sin fotografia registrada.</div>'}
                </div>
              </section>
            </div>
          </div>
          <section class="print-section">
            <h3>Responsables</h3>
            <div class="print-roles">
              <div class="print-signature-line">
                <strong>${targetRecord.levantamiento_datos || "--"}</strong><br />
                LEVANTAMIENTO DE DATOS
              </div>
              <div class="print-signature-line">
                <strong>${targetRecord.analista_datos || "--"}</strong><br />
                ANALISTA DE DATOS
              </div>
            </div>
          </section>
        </div>
      `,
      options: {
        bodyClassName: "print-ficha",
        pageSize: "Letter landscape",
        pageMargin: "8mm 8mm 8mm 12mm",
        windowFeatures: "width=1400,height=900"
      }
    };
  };

  const handlePrintFicha = async (recordOverride = null) => {
    const document = await buildFichaPrintDocument(recordOverride);
    const printResult = await printDocument(document.title, document.body, document.options);
    const targetRecord = recordOverride || form;
    if (printResult?.printed && targetRecord?.id) {
      await markBatchFichaRecordsAsPrinted([{ record: targetRecord, ficha: 1, aviso: 0 }]);
      setPrintBatchStatusView("printed");
      showAlert(`Ficha ${targetRecord.clave_catastral || ""} impresa y retirada de alertas.`);
    }
  };

  const buildAvisoPrintMarkup = (record = form) => {
    const targetRecord = { ...emptyForm, ...normalizeRecord(record) };
    const fecha = targetRecord.fecha_aviso ? formatSpanishDate(targetRecord.fecha_aviso) : "__________";
    const barrio = getRecordBarrioName(targetRecord, "__________");
    const clave = targetRecord.clave_catastral || "__________";
    const firmante = targetRecord.firmante_aviso || "Jefatura de Comercializacion";
    const cargo = targetRecord.cargo_firmante || "Aguas de Choluteca";
    const destinatario = targetRecord.aviso_destinatario || targetRecord.abonado || targetRecord.inquilino || targetRecord.nombre_catastral || "Señor(a)";
    const plazoTexto = escapeHtml(describeAvisoPlazo(targetRecord, formatSpanishDate));
    const instrucciones = String(targetRecord.aviso_instrucciones || "").trim();

    return `
      <div class="print-header"><img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" /></div>
      <section class="aviso">
        <div class="aviso-header">
          <p><strong>AGUAS DE CHOLUTECA</strong></p>
          <p>Departamento de Comercialización</p>
        </div>
        <h2 class="aviso-title">AVISO IMPORTANTE AL ABONADO</h2>
        <p class="aviso-date">Fecha: Choluteca, ${escapeHtml(fecha)}</p>
        <p class="aviso-saludo">Estimado(a) ${escapeHtml(destinatario)}:</p>
        <p class="aviso-body">
          Por medio de la presente, se le informa que, como resultado del reciente levantamiento de información realizado por la Unidad Técnica de Catastro, se ha identificado que el inmueble ubicado en ${escapeHtml(barrio)}, con Clave Catastral ${escapeHtml(clave)}, no se encuentra registrado en la base de datos de la empresa, pese a contar con servicios activos.
        </p>
        <p class="aviso-body">
          Con el propósito de regularizar su situación, evitar circunstancias legales y establecer un acuerdo acorde al caso, se le solicita presentarse al Departamento de Comercialización de Aguas de Choluteca ${plazoTexto}, debiendo presentar la siguiente documentación:
        </p>
        <ul class="aviso-list">
          <li>Copia de Escritura pública del inmueble.</li>
          <li>Copia de Constancia Catastral vigente.</li>
          <li>Copia de Documento Nacional de Identificación (DNI).</li>
          <li>Constancia de solvencia municipal.</li>
        </ul>
        ${instrucciones ? `<p class="aviso-body"><strong>Indicación adicional:</strong><br />${escapeHtml(instrucciones).replace(/\n/g, "<br />")}</p>` : ""}
        <p class="aviso-body">
          En caso de no presentarse dentro del plazo indicado, la empresa procederá conforme a los lineamientos administrativos establecidos por la ley que implican recargos y multas.
        </p>
        <p class="aviso-body">Sin otro particular, agradecemos su pronta colaboración.</p>
        <p class="aviso-body">Atentamente,</p>
        <div class="aviso-signature">
          <p><strong>${escapeHtml(firmante)}</strong></p>
          <p>${escapeHtml(cargo)}</p>
          <p>Aguas de Choluteca</p>
        </div>
        <p class="aviso-copy">C.c. Archivo</p>
      </section>
    `;
  };

  const handlePrintAviso = async (recordOverride = null) => {
    const targetRecord = recordOverride ? { ...emptyForm, ...normalizeRecord(recordOverride) } : form;
    await printDocument(
      `Aviso ${targetRecord.clave_catastral || "inmueble"}`,
      buildAvisoPrintMarkup(targetRecord),
      {
        pageSize: "Letter portrait",
        pageMargin: "10mm",
        windowFeatures: "width=980,height=1200"
      }
    );
  };

  // Avisos y/o fichas técnicas de varias fichas en una sola vista previa,
  // intercalados por inmueble (ficha horizontal + su aviso vertical). Solo cuando
  // se confirma la impresión se marcan las fichas como impresas y los avisos como
  // entregados a imprenta. Los registros deben venir frescos de la API.
  const printLote = async (records = [], { avisos = true, fichas = true, onProgress } = {}) => {
    const lista = records.filter((record) => record?.id);
    if (!lista.length || (!avisos && !fichas)) return { printed: false };
    const fichaDocs = fichas
      ? await mapEnOrden(lista, 4, (record) => buildFichaPrintDocument(record, { silent: true }), onProgress)
      : [];
    const missingPhotos = fichaDocs.filter((doc) => doc?.photoMissing).length;
    const html = armarPaginasLote(lista.map((record, index) => ({
      ficha: fichas ? fichaDocs[index].body : "",
      aviso: avisos ? buildAvisoPrintMarkup(record) : ""
    })));
    const title = tituloLote({ total: lista.length, avisos, fichas });
    const result = await printDocument(title, html, {
      pageSize: "Letter portrait",
      pageMargin: "10mm",
      extraStyles: fichas ? ESTILOS_LOTE : "",
      skipAudit: true
    });
    if (!result?.printed) return { printed: false, missingPhotos };

    announceReportGenerated({
      reportId: createReportId(),
      title,
      reportType: "lote-avisos-fichas",
      bodyMarkup: resumenLoteHtml(lista, { avisos, fichas, plazo: avisos ? etiquetaPlazo(lista[0], formatSpanishDate) : "" }, escapeHtml)
    });

    const ids = lista.map((record) => record.id);
    let fichasMarked = 0;
    let markError = "";
    if (fichas) {
      const marked = await mapEnOrden(lista, 4, async (record) => {
        const response = await apiFetch(`/inmuebles/${record.id}/mark-printed`, { method: "POST" });
        return response.ok;
      });
      fichasMarked = marked.filter(Boolean).length;
      if (fichasMarked < lista.length) markError = `${lista.length - fichasMarked} fichas no se pudieron marcar como impresas.`;
    }
    if (avisos) {
      const response = await apiFetch("/clandestinos/fichas/avisos-impresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!response.ok) markError = [markError, "No se pudo registrar la impresión de los avisos."].filter(Boolean).join(" ");
    }
    return { printed: true, fichasMarked, missingPhotos, markError };
  };

  return {
    printLote,
    openPrintBatchModalForRecords,
    updateBatchPrintCopies,
    adjustBatchPrintCopies,
    clearBatchPrintCopies,
    selectVisibleBatchPrintCopies,
    togglePrintedSaveSelection,
    togglePendingPrintedSelection,
    selectVisiblePrintedForSave,
    selectVisiblePendingAsPrinted,
    markBatchFichaRecordsAsPrinted,
    handleMoveSelectedFichasToPrinted,
    handleMarkSelectedAlertsAsPrinted,
    handleSaveSelectedPrintedRecords,
    handlePrintBatch,
    handlePrintFicha,
    handlePrintAviso
  };
}
