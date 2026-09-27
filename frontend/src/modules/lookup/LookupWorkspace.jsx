import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "../../components/Icon";
import { LOOKUP_SEARCH_MODES } from "../../constants/formsAndUi";
import LookupChatPanel from "../../components/LookupChatPanel";
import { formatLookupAmount, getLookupTotalMeta } from "../../utils/formatting";
import { getLookupServiceMeta } from "../../utils/claveAndLookup";

export default function LookupWorkspace({ model }) {
  const {
    apiFetch,
    buildRecordPatchFromAguasMatch,
    downloadingPadron,
    handleDownloadPadron,
    handleLookupInputChange,
    handleLookupPrefixModeChange,
    handleLookupSearch,
    handleLookupSearchModeChange,
    handlePrintLookupMatchReport,
    handleRemoveLookupHistoryItem,
    lookupFeedback,
    lookupHistory,
    lookupInputLabel,
    lookupInputPlaceholder,
    lookupLoading,
    lookupModeConfig,
    lookupPrefixMode,
    lookupQuery,
    lookupResult,
    lookupSearchMode,
    openLookupMatchInRecord,
    padronMeta,
    setLookupFeedback,
    setLookupPrefixMode,
    setLookupQuery,
    setLookupResult,
    setLookupSearchMode,
    setShowLookupClassicModal,
    showLookupClassicModal,
    startNewRecordFromLookup
  } = model;

  return (
    <main className="lookup-layout">
      <section className="lookup-shell no-print">
        <div className="lookup-card">
          <div className="lookup-card-head">
            <div>
              <p className="sheet-kicker">Entrada principal</p>
              <h2><Icon name="search" className="title-icon" />Buscar clave</h2>
              <p className="lookup-card-description">
                Consulta una clave y decide el siguiente paso sin abrir toda la ficha desde el inicio.
              </p>
            </div>
            <span className="panel-pill">Alcaldía vs. Aguas</span>
          </div>

          <LookupChatPanel apiFetch={apiFetch} padronMeta={padronMeta} />

          <div className="lookup-classic-launch">
            <button type="button" className="button-secondary" onClick={() => setShowLookupClassicModal(true)}>
              <Icon name="records" />
              Abrir búsqueda clásica
            </button>
          </div>

          <Dialog open={showLookupClassicModal} onOpenChange={setShowLookupClassicModal}>
            <DialogContent className="lookup-classic-modal shadcn-print-dialog max-h-[calc(100vh-1.5rem)] overflow-hidden sm:max-w-4xl">
              <DialogHeader className="password-modal-head">
                <p className="eyebrow">Modulo anterior</p>
                <DialogTitle>Busqueda clasica del padron</DialogTitle>
                <DialogDescription>
                  Consulta manual por clave, nombre, abonado o Alcaldia cuando necesites el flujo anterior.
                </DialogDescription>
              </DialogHeader>
              <div className="lookup-classic-modal-body">
                <form className="lookup-form is-modal" onSubmit={handleLookupSearch}>
                  <div className="lookup-mode-switch" role="tablist" aria-label="Tipo de busqueda">
                    {LOOKUP_SEARCH_MODES.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        role="tab"
                        aria-selected={lookupSearchMode === mode.value}
                        className={lookupSearchMode === mode.value ? "is-active" : ""}
                        onClick={() => handleLookupSearchModeChange(mode.value)}
                      >
                        <span>{mode.label}</span>
                        <small>{mode.helper}</small>
                      </button>
                    ))}
                  </div>

            <label className="lookup-field">
              <span>{lookupInputLabel}</span>
              <input
                className={lookupSearchMode === "clave" ? "" : "is-textual"}
                value={lookupQuery}
                onChange={handleLookupInputChange}
                inputMode={lookupModeConfig.inputMode}
                autoComplete="off"
                placeholder={lookupInputPlaceholder}
                maxLength={lookupSearchMode === "clave" ? 11 : lookupSearchMode === "abonado" ? 18 : 96}
              />
            </label>
            {lookupSearchMode === "clave" ? (
              <>
                <div className="lookup-prefix-toggle" role="group" aria-label="Tipo de prefijo">
                  <button
                    type="button"
                    className={lookupPrefixMode === "auto" ? "is-active" : ""}
                    onClick={() => handleLookupPrefixModeChange("auto")}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={lookupPrefixMode === "two" ? "is-active" : ""}
                    onClick={() => handleLookupPrefixModeChange("two")}
                  >
                    Prefijo 2
                  </button>
                  <button
                    type="button"
                    className={lookupPrefixMode === "three" ? "is-active" : ""}
                    onClick={() => handleLookupPrefixModeChange("three")}
                  >
                    Prefijo 3
                  </button>
                </div>
                <div className="lookup-guide-sheet">
                  <span>{lookupPrefixMode === "three" ? "###" : "##"}</span>
                  <span>##</span>
                  <span>##</span>
                  <span className="is-optional">##</span>
                </div>
              </>
            ) : null}
            <div className="lookup-helper-row">
              <span className="helper-text">
                {lookupSearchMode === "clave"
                  ? "Base de 3 bloques: trae todas las coincidencias. Se acepta primer bloque de 2 o 3 digitos."
                  : lookupSearchMode === "nombre"
                    ? "Busca por inquilino, propietario o nombre asociado dentro del padron maestro."
                    : lookupSearchMode === "alcaldia"
                      ? "Busca en el padron de Alcaldia por clave catastral, nombre, identidad o barrio/caserio."
                      : "Puedes escribir una parte del numero de abonado para encontrar coincidencias rapido."}
              </span>
              <div className="lookup-example-chips">
                {lookupSearchMode === "clave" ? (
                  <>
                    <button
                      type="button"
                      className="record-quick-chip"
                      onClick={() => {
                        setLookupPrefixMode("auto");
                        setLookupQuery("10-10-10");
                      }}
                    >
                      10-10-10
                    </button>
                    <button
                      type="button"
                      className="record-quick-chip"
                      onClick={() => {
                        setLookupPrefixMode("three");
                        setLookupQuery("100-10-10");
                      }}
                    >
                      100-10-10
                    </button>
                    <button
                      type="button"
                      className="record-quick-chip"
                      onClick={() => {
                        setLookupPrefixMode("auto");
                        setLookupQuery("10-10-10-01");
                      }}
                    >
                      10-10-10-01
                    </button>
                    <button
                      type="button"
                      className="record-quick-chip"
                      onClick={() => {
                        setLookupPrefixMode("three");
                        setLookupQuery("100-10-10-01");
                      }}
                    >
                      100-10-10-01
                    </button>
                  </>
                ) : lookupSearchMode === "nombre" ? (
                  <>
                    <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("Juan")}>
                      Juan
                    </button>
                    <button
                      type="button"
                      className="record-quick-chip"
                      onClick={() => setLookupQuery("Aguilera")}
                    >
                      Aguilera
                    </button>
                  </>
                ) : lookupSearchMode === "alcaldia" ? (
                  <>
                    <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("01-01-01")}>
                      01-01-01
                    </button>
                    <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("Barrio Suyapa")}>
                      Barrio Suyapa
                    </button>
                    <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("Sandra")}>
                      Sandra
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("16523")}>
                      16523
                    </button>
                    <button type="button" className="record-quick-chip" onClick={() => setLookupQuery("100")}>
                      100
                    </button>
                  </>
                )}
              </div>
            </div>
            {lookupHistory.length ? (
              <div className="lookup-recent-strip">
                <div className="lookup-recent-head">
                  <strong>Recientes en este equipo</strong>
                  <small>Repite una consulta sin volver a escribir</small>
                </div>
                <div className="lookup-recent-list">
                  {lookupHistory.slice(0, 6).map((item) => (
                    <div
                      key={`${item.mode}-${item.normalized_query}-${item.searched_at}`}
                      className="lookup-recent-item"
                    >
                      <button
                        type="button"
                        className="lookup-recent-chip"
                        onClick={() => {
                          setLookupSearchMode(item.mode);
                          setLookupQuery(String(item.normalized_query || item.query || ""));
                          setLookupResult(null);
                          setLookupFeedback("");
                          if (item.mode === "clave") {
                            const firstPart = String(item.normalized_query || item.query || "").split("-")[0] || "";
                            setLookupPrefixMode(firstPart.length === 3 ? "three" : "auto");
                          } else {
                            setLookupPrefixMode("auto");
                          }
                        }}
                      >
                        <span>{item.normalized_query || item.query}</span>
                        <small>
                          {item.mode === "clave"
                            ? "Clave"
                            : item.mode === "nombre"
                              ? "Nombre"
                              : item.mode === "alcaldia"
                                ? "Alcaldia"
                                : "Abonado"}
                        </small>
                      </button>
                      <button
                        type="button"
                        className="lookup-recent-remove"
                        onClick={() => handleRemoveLookupHistoryItem(item)}
                        aria-label={`Eliminar busqueda temporal ${item.normalized_query || item.query}`}
                        title="Eliminar busqueda temporal"
                      >
                        <Icon name="waste" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {lookupFeedback ? <p className="lookup-feedback">{lookupFeedback}</p> : null}
            <div className="search-actions lookup-actions">
              <button type="submit" disabled={lookupLoading}>
                <Icon name="search" />
                  {lookupLoading
                    ? "Consultando..."
                    : lookupSearchMode === "clave"
                      ? "Consultar clave"
                      : lookupSearchMode === "nombre"
                        ? "Buscar nombre"
                        : lookupSearchMode === "alcaldia"
                          ? "Buscar en Alcaldia"
                          : "Buscar abonado"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setLookupQuery("");
                  setLookupResult(null);
                  setLookupFeedback("");
                }}
              >
                <Icon name="refresh" />
                Limpiar
              </button>
              <button type="button" className="button-secondary" onClick={handleDownloadPadron} disabled={downloadingPadron}>
                <Icon name="records" />
                Descargar padrón
              </button>
            </div>
                </form>
              </div>
              <DialogFooter className="password-form-actions print-batch-footer">
                <button type="button" className="button-secondary" onClick={() => setShowLookupClassicModal(false)}>
                  Cerrar
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="lookup-results">
          {lookupResult ? (
            <article className={`lookup-result-card ${lookupResult.exists ? "is-found" : "is-missing"}`}>
              <div className="lookup-result-head">
                <div>
                  <p className="eyebrow">
                    {lookupResult.field === "texto"
                      ? "Busqueda Alcaldia"
                      : lookupResult.field === "clave"
                      ? lookupResult.mode === "base"
                        ? "Busqueda por base"
                        : "Busqueda exacta"
                      : lookupResult.field === "nombre"
                        ? "Busqueda por nombre"
                        : "Busqueda por abonado"}
                  </p>
                  <h3>{lookupResult.normalized_query}</h3>
                </div>
                <span className={`lookup-status-pill ${lookupResult.exists ? "is-found" : "is-missing"}`}>
                  {lookupResult.field === "texto"
                    ? lookupResult.exists
                      ? "Existe en Alcaldia"
                      : "Sin registro Alcaldia"
                    : lookupResult.exists
                      ? "Si registrada"
                      : "Sin registro"}
                </span>
              </div>

              <p className="lookup-result-message">
                {lookupResult.exists
                  ? lookupResult.field === "texto"
                    ? `Se encontraron ${lookupResult.total_matches} coincidencias en el padron de Alcaldia.`
                    : lookupResult.field === "clave"
                    ? lookupResult.mode === "base"
                      ? `Se encontraron ${lookupResult.total_matches} coincidencias asociadas a esa clave base.`
                      : "La clave consultada si existe en el sistema maestro."
                    : `Se encontraron ${lookupResult.total_matches} coincidencias asociadas a esa consulta.`
                  : "No existe registro en el sistema. Posible clandestino."}
              </p>
              <div className="lookup-decision-grid">
                <div className={lookupResult.field === "texto" && lookupResult.exists ? "is-found" : "is-muted"}>
                  <span>Alcaldia</span>
                  <strong>{lookupResult.field === "texto" && lookupResult.exists ? "Aparece" : "Sin validar"}</strong>
                </div>
                <div className={lookupResult.field !== "texto" && lookupResult.exists ? "is-found" : lookupResult.field === "texto" ? "is-muted" : "is-missing"}>
                  <span>Aguas</span>
                  <strong>{lookupResult.field !== "texto" && lookupResult.exists ? "Aparece" : lookupResult.field === "texto" ? "Comparar abajo" : "No aparece"}</strong>
                </div>
                <div className={!lookupResult.exists || (lookupResult.field === "texto" && lookupResult.matches?.some((match) => !match.exists_in_aguas)) ? "is-danger" : "is-found"}>
                  <span>Resultado</span>
                  <strong>
                    {!lookupResult.exists || (lookupResult.field === "texto" && lookupResult.matches?.some((match) => !match.exists_in_aguas))
                      ? "Posible clandestino"
                      : "Registrado"}
                  </strong>
                </div>
              </div>

              {!lookupResult.exists && lookupResult.field === "clave" ? (
                <div className="lookup-match-actions">
                  <button
                    type="button"
                    onClick={() =>
                      startNewRecordFromLookup(
                        {
                          clave_catastral: lookupResult.normalized_query || lookupQuery.trim(),
                          estado_padron: "clandestino",
                          comentarios: "Clandestino"
                        },
                        `Ficha nueva preparada para la clave ${lookupResult.normalized_query || lookupQuery.trim()}.`
                      )
                    }
                  >
                    <Icon name="records" />
                    Crear ficha nueva
                  </button>
                </div>
              ) : null}

              {lookupResult.exists ? (
                <>
                  <div className="lookup-summary-strip">
                    <div className="lookup-summary-card">
                      <span>Coincidencias</span>
                      <strong>{lookupResult.total_matches}</strong>
                    </div>
                    <div className="lookup-summary-card">
                      <span>Modo</span>
                      <strong>
                        {lookupResult.field === "clave"
                          ? lookupResult.mode === "base"
                            ? "Base"
                            : "Exacta"
                          : lookupResult.field === "nombre"
                            ? "Nombre"
                            : lookupResult.field === "texto"
                              ? "Alcaldia"
                              : "Abonado"}
                      </strong>
                    </div>
                    <div className="lookup-summary-card">
                      <span>Consulta</span>
                      <strong>{lookupResult.normalized_query}</strong>
                    </div>
                  </div>
                  <div className="lookup-match-list">
                  {lookupResult.matches.map((match) => (
                    (() => {
                      if (lookupResult.field === "texto") {
                        return (
                          <article key={`${match.clave_catastral}-${match.identificador}-${match.nombre}`} className="lookup-match-card">
                            <div className="lookup-match-top">
                              <div className="lookup-match-headline">
                                <strong>{match.clave_catastral}</strong>
                                <span className="lookup-abonado-pill">Alcaldia</span>
                              </div>
                              <span className={`lookup-match-status ${match.exists_in_aguas ? "is-ok" : "is-danger"}`}>
                                <Icon name={match.exists_in_aguas ? "success" : "activity"} />
                                {match.exists_in_aguas ? "Tambien aparece en Aguas" : "Clandestino: no aparece en Aguas"}
                              </span>
                            </div>
                            <div className="lookup-match-grid">
                              <div className="lookup-match-field">
                                <span className="lookup-match-label">Nombre Alcaldia</span>
                                <span>{match.nombre || "Sin nombre registrado"}</span>
                              </div>
                              <div className="lookup-match-field">
                                <span className="lookup-match-label">Barrio/Caserio</span>
                                <span>{match.caserio || match.direccion || "--"}</span>
                              </div>
                              <div className="lookup-match-field">
                                <span className="lookup-match-label">Direccion</span>
                                <span>{match.direccion || "--"}</span>
                              </div>
                              <div className="lookup-match-field">
                                <span className="lookup-match-label">Identificador</span>
                                <span>{match.identificador || "--"}</span>
                              </div>
                              <div className="lookup-match-field">
                                <span className="lookup-match-label">Clave equivalente Aguas</span>
                                <span>{match.exists_in_aguas ? match.clave_aguas_formato || "--" : "No registrada en Aguas"}</span>
                              </div>
                              <div className="lookup-match-field">
                                <span className="lookup-match-label">Coincidencia</span>
                                <strong className={match.exists_in_aguas ? "lookup-match-total is-good" : "lookup-match-total is-danger"}>
                                  {match.match_type === "exacta"
                                    ? "Exacta"
                                    : match.match_type === "base"
                                      ? "Por base"
                                      : "No aparece en Aguas"}
                                </strong>
                              </div>
                            </div>
                            <div className="lookup-match-actions">
                              <button
                                type="button"
                                className="button-secondary"
                                onClick={() =>
                                  startNewRecordFromLookup(
                                    {
                                      clave_catastral:
                                        (match.exists_in_aguas ? match.clave_aguas_formato : match.clave_catastral) ||
                                        "",
                                      nombre_catastral: match.nombre || "",
                                      barrio_colonia: match.caserio || match.direccion || "",
                                      identidad: match.identificador || "",
                                      comentarios: match.exists_in_aguas ? "Aparece en varios padrones" : "Clandestino",
                                      estado_padron: match.exists_in_aguas ? "varios_padrones" : "clandestino",
                                      clave_alcaldia: match.clave_catastral || "",
                                      nombre_alcaldia: match.nombre || "",
                                      barrio_alcaldia: match.caserio || match.direccion || ""
                                    },
                                    `Ficha nueva preparada desde Alcaldia para la clave ${match.clave_catastral || "--"}.`
                                  )
                                }
                              >
                                <Icon name="records" />
                                Pasar a ficha
                              </button>
                            </div>
                          </article>
                        );
                      }

                      const totalMeta = getLookupTotalMeta(match.total);
                      return (
                        <article key={`${match.clave_catastral}-${match.inquilino}-${match.nombre}`} className="lookup-match-card">
                          <div className="lookup-match-top">
                            <div className="lookup-match-headline">
                              <strong>{match.clave_catastral}</strong>
                              <span className="lookup-abonado-pill">Abonado {match.abonado || "--"}</span>
                            </div>
                            <span className={`lookup-match-status ${totalMeta.tone}`}>
                              <Icon name={totalMeta.icon} />
                              {totalMeta.helper}
                            </span>
                          </div>
                          <div className="lookup-match-grid">
                            <div className="lookup-match-field">
                              <span className="lookup-match-label">Nombre</span>
                              <span>{match.inquilino || "Sin nombre asociado"}</span>
                            </div>
                            <div className="lookup-match-field">
                              <span className="lookup-match-label">Abonado</span>
                              <span>{match.abonado || "--"}</span>
                            </div>
                            <div className="lookup-match-field">
                              <span className="lookup-match-label">Zona</span>
                              <span>{match.barrio_colonia || "--"}</span>
                            </div>
                            <div className="lookup-match-field">
                              <span className="lookup-match-label">Sin interes</span>
                              <strong className="lookup-match-amount">
                                {formatLookupAmount(match.valor)}
                              </strong>
                            </div>
                            <div className="lookup-match-field">
                              <span className="lookup-match-label">Interes</span>
                              <strong className="lookup-match-amount">
                                {formatLookupAmount(match.intereses)}
                              </strong>
                            </div>
                            <div className="lookup-match-field">
                              <span className="lookup-match-label">Con interes</span>
                              <strong className={`lookup-match-total ${totalMeta.tone}`}>
                                {totalMeta.text}
                              </strong>
                            </div>
                          </div>
                          <details className="lookup-detail-disclosure">
                            <summary>Ver servicios y saldo</summary>
                            <div className="lookup-service-grid">
                              {[
                                { label: "Agua", value: match.agua, icon: "water" },
                                { label: "Alcantarillado", value: match.alcantarillado, icon: "sewer" },
                                { label: "Barrido", value: match.barrido, icon: "broom" },
                                { label: "Desechos / tren de aseo", value: match.recoleccion, icon: "refresh" },
                                { label: "Desechos peligrosos", value: match.desechos_peligrosos, icon: "waste" }
                              ].map((service) => {
                                const serviceMeta = getLookupServiceMeta(service.value);
                                return (
                                  <div key={service.label} className={`lookup-service-pill ${serviceMeta.tone}`}>
                                    <div className="lookup-service-pill-top">
                                      <span className="lookup-service-icon">
                                        <Icon name={service.icon} />
                                      </span>
                                      <span>{service.label}</span>
                                    </div>
                                    <strong>{serviceMeta.label}</strong>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                          <div className="lookup-match-actions">
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() =>
                                startNewRecordFromLookup(
                                  {
                                    ...buildRecordPatchFromAguasMatch(match),
                                    comentarios: "Datos copiados desde padron Aguas",
                                    estado_padron: "varios_padrones"
                                  },
                                  `Datos copiados al formulario para ${match.clave_catastral || "--"}.`
                                )
                              }
                            >
                              <Icon name="copy" />
                              Copiar al formulario
                            </button>
                            <button type="button" className="button-secondary" onClick={() => handlePrintLookupMatchReport(match)}>
                              <Icon name="records" />
                              Generar reporte
                            </button>
                            <button
                              type="button"
                              onClick={() => openLookupMatchInRecord(match)}
                            >
                              <Icon name="search" />
                              Actualizar ficha
                            </button>
                          </div>
                        </article>
                      );
                    })()
                  ))}
                  </div>
                </>
              ) : null}
            </article>
          ) : (
            <article className="lookup-empty-card">
              <h3>Consulta rapida de padron</h3>
              <p>
                Usa esta pantalla para validar en campo por clave, nombre o abonado sin entrar al modulo de
                registro de clandestinos.
              </p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
