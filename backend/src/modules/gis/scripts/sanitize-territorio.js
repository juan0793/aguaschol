import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGisPool } from "../../../config/gisDb.js";
import { parseBarrioLabel } from "../gisImportUtils.js";

const mode = process.argv.includes("--apply") ? "apply" : "preview";
const duplicateKeys = new Set(["15", "16", "21"]);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = getGisPool();
const client = await pool.connect();

const query = (sql, params) => client.query(sql, params);

try {
  if (mode === "apply") {
    await query(await fs.readFile(path.resolve(__dirname, "../migrations/002_saneamiento_territorio.sql"), "utf8"));
    await query("BEGIN");
  }

  const labels = await query(`
    SELECT e.id, e.barrio_id, e.source_fid, e.source_text, b.clave clave_actual
    FROM gis_barrio_etiquetas e
    JOIN gis_barrios b ON b.id = e.barrio_id
    WHERE e.source_text IS NOT NULL AND b.clave IS NULL
    ORDER BY e.source_fid
  `);
  const candidates = [];
  for (const row of labels.rows) {
    const parsed = parseBarrioLabel(row.source_text);
    if (!parsed.clave || duplicateKeys.has(parsed.clave)) continue;
    const conflict = await query("SELECT id FROM gis_barrios WHERE clave = $1 AND id <> $2 LIMIT 1", [parsed.clave, row.barrio_id]);
    candidates.push({
      etiqueta_id: Number(row.id),
      etiqueta_fid: Number(row.source_fid),
      barrio_id: Number(row.barrio_id),
      source_text: row.source_text,
      tipo: parsed.tipo,
      nombre: parsed.nombre,
      clave: parsed.clave,
      clave_sufijo: parsed.claveSufijo,
      action: conflict.rowCount ? "skip_conflict" : mode === "apply" ? "updated" : "would_update"
    });
  }

  if (mode === "apply") {
    for (const item of candidates.filter((candidate) => candidate.action === "updated")) {
      await query(`
        UPDATE gis_barrio_etiquetas
        SET tipo = $1, nombre = $2, clave = $3, clave_sufijo = $4
        WHERE id = $5
      `, [item.tipo, item.nombre, item.clave, item.clave_sufijo, item.etiqueta_id]);
      await query(`
        UPDATE gis_barrios
        SET tipo = $1, nombre = $2, clave = $3, clave_sufijo = $4, updated_at = NOW()
        WHERE id = $5 AND clave IS NULL
      `, [item.tipo, item.nombre, item.clave, item.clave_sufijo, item.barrio_id]);
    }
  }

  const invalidBefore = await query(`
    SELECT 'gis_barrios' tabla, id, source_fid, clave, nombre, tipo,
           ST_IsValidReason(geom) reason_before,
           ST_Area(geom) area_before_m2,
           ST_Area(ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3))) area_after_m2,
           ST_IsValidReason(ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3))) reason_after
    FROM gis_barrios
    WHERE NOT ST_IsValid(geom)
    UNION ALL
    SELECT 'gis_manzanas' tabla, id, source_fid, numero AS clave, NULL AS nombre, NULL AS tipo,
           ST_IsValidReason(geom) reason_before,
           ST_Area(geom) area_before_m2,
           ST_Area(ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3))) area_after_m2,
           ST_IsValidReason(ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3))) reason_after
    FROM gis_manzanas
    WHERE NOT ST_IsValid(geom)
    ORDER BY tabla, source_fid
  `);

  if (mode === "apply") {
    for (const item of invalidBefore.rows) {
      await query(`
        INSERT INTO gis_geometrias_originales (tabla, row_id, source_fid, reason_before, area_before_m2, geom)
        SELECT $1, id, source_fid, ST_IsValidReason(geom), ST_Area(geom), geom
        FROM ${item.tabla}
        WHERE id = $2
        ON CONFLICT (tabla, row_id) DO NOTHING
      `, [item.tabla, item.id]);
      await query(`
        UPDATE ${item.tabla}
        SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)),
            updated_at = COALESCE(updated_at, NOW())
        WHERE id = $1
      `, [item.id]);
    }
  }

  const invalidAfter = await query(`
    SELECT 'gis_barrios' tabla, id, source_fid, ST_IsValidReason(geom) reason_after, ST_Area(geom) area_after_m2
    FROM gis_barrios
    WHERE id = ANY($1::bigint[])
    UNION ALL
    SELECT 'gis_manzanas' tabla, id, source_fid, ST_IsValidReason(geom) reason_after, ST_Area(geom) area_after_m2
    FROM gis_manzanas
    WHERE id = ANY($2::bigint[])
    ORDER BY tabla, source_fid
  `, [
    invalidBefore.rows.filter((row) => row.tabla === "gis_barrios").map((row) => row.id),
    invalidBefore.rows.filter((row) => row.tabla === "gis_manzanas").map((row) => row.id)
  ]);

  if (mode === "apply") await query("COMMIT");

  console.log(JSON.stringify({
    mode,
    compact_label_updates: candidates,
    geometry_fixes: invalidBefore.rows.map((before) => {
      const after = invalidAfter.rows.find((row) => row.tabla === before.tabla && String(row.id) === String(before.id));
      return {
        tabla: before.tabla,
        id: Number(before.id),
        source_fid: Number(before.source_fid),
        clave: before.clave,
        nombre: before.nombre,
        tipo: before.tipo,
        reason_before: before.reason_before,
        reason_after: mode === "apply" ? (after?.reason_after ?? before.reason_after) : before.reason_after,
        area_before_m2: Number(before.area_before_m2),
        area_after_m2: Number(mode === "apply" ? (after?.area_after_m2 ?? before.area_after_m2) : before.area_after_m2),
        area_delta_m2: Number((Number(mode === "apply" ? (after?.area_after_m2 ?? before.area_after_m2) : before.area_after_m2) - Number(before.area_before_m2)).toFixed(6)),
        action: mode === "apply" ? "fixed_with_backup" : "would_fix_with_backup"
      };
    })
  }, null, 2));
} catch (error) {
  if (mode === "apply") await query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
