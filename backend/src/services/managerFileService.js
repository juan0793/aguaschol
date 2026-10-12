import { getPool } from "../config/db.js";

// Solo evidencia institucional y PDF de versiones autorizadas; nunca adjuntos del chat.
export const assertManagerFileAccess = async (requestPath, executor) => {
  const match = requestPath.match(/^\/(?:api\/)?(uploads|planos-pdf)\/([A-Za-z0-9_.-]+)$/);
  if (!match || [".", ".."].includes(match[2])) {
    throw Object.assign(new Error("Archivo no autorizado."), { status: 403 });
  }
  const filePath = `/${match[1]}/${match[2]}`;
  const sql = match[1] === "uploads"
    ? `SELECT id FROM inmuebles_clandestinos WHERE foto_path = ?
       UNION ALL SELECT id FROM reporte_evidencias WHERE archivo_path = ?
       UNION ALL SELECT id FROM planos_versiones WHERE archivo_pdf_final = ? AND estado IN ('aprobado', 'publicado') LIMIT 1`
    : "SELECT id FROM planos_versiones WHERE archivo_pdf_final = ? AND estado IN ('aprobado', 'publicado') LIMIT 1";
  const [rows] = await (executor || getPool()).query(sql, match[1] === "uploads" ? [filePath, filePath, filePath] : [filePath]);
  if (!rows.length) throw Object.assign(new Error("Archivo no autorizado para Gerencia General."), { status: 403 });
};
