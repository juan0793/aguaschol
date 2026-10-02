// Impresión de avisos y fichas técnicas en lote, intercalados por inmueble: la
// ficha (carta horizontal) y enseguida su aviso (carta vertical), listos para
// engrapar y entregar. Funciones puras: createFichaPrinting.js pone los datos.

// Más de esto vuelve lenta la vista previa (cada ficha lleva foto y consulta a Alcaldía).
export const LOTE_IMPRESION_MAX = 100;

// La hoja por defecto es vertical (el aviso); la ficha usa una página con nombre
// en horizontal. Chrome y Edge respetan el cambio de orientación dentro del mismo
// documento.
export const ESTILOS_LOTE = `
  @page lote-ficha { size: Letter landscape; margin: 8mm 8mm 8mm 12mm; }
  .lote-ficha { page: lote-ficha; }
`;

// Ejecuta `worker` sobre cada elemento con a lo sumo `limit` a la vez y devuelve
// los resultados en el mismo orden. Avisa el avance con onProgress({ done, total }).
export const mapEnOrden = async (items, limit, worker, onProgress) => {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
      done += 1;
      onProgress?.({ done, total: items.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, run));
  return results;
};

// entries: [{ ficha: "<html de la ficha>" | "", aviso: "<html del aviso>" | "" }]
export const armarPaginasLote = (entries = []) =>
  entries
    .flatMap(({ ficha, aviso }) => [
      ficha ? `<section class="print-batch-page print-ficha lote-ficha">${ficha}</section>` : "",
      aviso ? `<section class="print-batch-page lote-aviso">${aviso}</section>` : ""
    ])
    .filter(Boolean)
    .join("");

export const tituloLote = ({ total, avisos, fichas }) => {
  const que = avisos && fichas ? "Avisos y fichas técnicas" : avisos ? "Avisos" : "Fichas técnicas";
  return `${que} · ${total} ${total === 1 ? "inmueble" : "inmuebles"}`;
};

// Lo que queda en el archivo de reportes: la lista del lote, no las páginas
// completas (con las fotos, el lote pasaba el límite de 8 MB y no se guardaba).
export const resumenLoteHtml = (records = [], { avisos, fichas, plazo = "" }, escapeHtml) => `
  <h2 class="print-title">${escapeHtml(tituloLote({ total: records.length, avisos, fichas }))}</h2>
  ${plazo ? `<p>Plazo del aviso: ${escapeHtml(plazo)}</p>` : ""}
  <style>.lote-resumen { width: 100%; border-collapse: collapse; margin-top: 8px; } .lote-resumen th, .lote-resumen td { padding: 4px 6px; border: 1px solid #999; text-align: left; }</style>
  <table class="lote-resumen">
    <thead><tr><th>#</th><th>Clave</th><th>Abonado / nombre</th><th>Barrio</th></tr></thead>
    <tbody>${records
      .map((record, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(record.clave_catastral || "--")}</td><td>${escapeHtml(record.abonado || record.inquilino || record.nombre_catastral || "--")}</td><td>${escapeHtml(record.barrio_colonia || "--")}</td></tr>`)
      .join("")}</tbody>
  </table>
`;
