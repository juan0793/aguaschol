// Header de página reutilizable: título + descripción a la izquierda,
// acciones secundarias + una única acción primaria a la derecha.
// Menos altura que un header tradicional; sin card/borde alrededor, solo un divisor inferior.
export default function PageHeader({ kicker, title, description, meta, secondaryActions, primaryAction }) {
  return (
    <header className="ds-page-header">
      <div className="ds-page-header-copy">
        {kicker ? <span className="ds-page-header-kicker">{kicker}</span> : null}
        <h1 className="ds-page-header-title">{title}</h1>
        {description ? <p className="ds-page-header-description">{description}</p> : null}
        {meta ? <div className="ds-page-header-meta">{meta}</div> : null}
      </div>
      {secondaryActions || primaryAction ? (
        <div className="ds-page-header-actions">
          {secondaryActions}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}
