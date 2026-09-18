import "./skeleton.css";

// Pantallas de transición: en vez de un texto suelto mientras llega un módulo,
// se dibuja la silueta de lo que va a aparecer. El contenido entra sin que la
// página salte, que es lo que hacía sentir lenta la navegación.

const anchos = ["72%", "48%", "61%", "39%", "55%", "66%", "44%", "58%"];

// Silueta de un módulo completo: encabezado, barra de filtros y filas.
export function ModuleSkeleton({ title = "el módulo", rows = 6, toolbar = true, className = "" }) {
  return (
    <div className={`ds-skeleton${className ? ` ${className}` : ""}`} role="status" aria-live="polite">
      <span className="ds-skeleton__sr">Cargando {title}…</span>
      <div className="ds-skeleton__head" aria-hidden="true">
        <span className="ds-skeleton__bar ds-skeleton__bar--title" />
        <span className="ds-skeleton__bar ds-skeleton__bar--sub" />
      </div>
      {toolbar ? (
        <div className="ds-skeleton__toolbar" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="ds-skeleton__field" />
          ))}
        </div>
      ) : null}
      <div className="ds-skeleton__panel" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="ds-skeleton__row" style={{ animationDelay: `${index * 70}ms` }}>
            <span className="ds-skeleton__bar" style={{ width: anchos[index % anchos.length] }} />
            <span className="ds-skeleton__bar ds-skeleton__bar--short" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Filas fantasma con la forma real de la tabla: se usa dentro de <tbody>, para
// que el ancho de las columnas no cambie cuando lleguen los datos.
export function TableSkeleton({ columns, rows = 6, label = "Cargando datos…" }) {
  return (
    <>
      {Array.from({ length: rows }, (_, fila) => (
        <tr key={fila} className="ds-skeleton-row" aria-hidden={fila ? "true" : undefined}>
          {Array.from({ length: columns }, (_, columna) => (
            <td key={columna}>
              {fila === 0 && columna === 0 ? <span className="ds-skeleton__sr" role="status">{label}</span> : null}
              <span
                className="ds-skeleton__bar"
                style={{ width: anchos[(fila + columna) % anchos.length], animationDelay: `${fila * 70}ms` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
