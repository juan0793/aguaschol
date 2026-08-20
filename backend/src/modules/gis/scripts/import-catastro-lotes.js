import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import initSqlJs from "sql.js";
import { getGisPool } from "../../../config/gisDb.js";
import { normalizeLookupKey } from "../../../services/claveLookupService.js";
import {
  buildClaveBase,
  chooseCanonicalFeatureLayer,
  cleanLoteNumber,
  normalizeClaveText,
  quoteSqliteIdentifier,
  stripGpkgHeader
} from "../gisImportUtils.js";

const zipPath = process.argv[2];
if (!zipPath) {
  console.error("Uso: node src/modules/gis/scripts/import-catastro-lotes.js <SIG-CHOL.zip>");
  process.exit(1);
}

const files = [
  "SIG-CHOL/SIG-CHOL/Lotes.gpkg",
  "SIG-CHOL/SIG-CHOL/NumeroLotes.gpkg",
  "SIG-CHOL/SIG-CHOL/BD_CatastroUsuarios.gpkg"
];

const wantedColumns = {
  bd_catastrousuarios: [
    "fid", "geom", "catastral2", "abonado", "inquilino", "direccion", "des_coloni",
    "37. Uso de", "38. Activi", "Comentario"
  ],
  numerolotes__texts: ["fid", "geom", "text", "Numero_Lote", "NumeroLote"]
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sig-fase3-"));
execFileSync("tar", ["-xf", zipPath, "-C", tmp, ...files], { stdio: "inherit" });

const hash = crypto.createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
const SQL = await initSqlJs();
const gpkgPath = (name) => path.join(tmp, "SIG-CHOL", "SIG-CHOL", name);
const open = (name) => new SQL.Database(fs.readFileSync(gpkgPath(name)));
const selectRows = (db, table, columns) => {
  const result = db.exec(`SELECT ${columns.map(quoteSqliteIdentifier).join(", ")} FROM ${quoteSqliteIdentifier(table)} ORDER BY fid`)[0];
  return result?.values.map((value) => Object.fromEntries(result.columns.map((column, index) => [column, value[index]]))) ?? [];
};
const layers = (db) =>
  (db.exec("SELECT c.table_name, c.data_type, c.identifier, c.srs_id, COUNT(i.name) column_count FROM gpkg_contents c LEFT JOIN pragma_table_info(c.table_name) i GROUP BY c.table_name, c.data_type, c.identifier, c.srs_id")[0]?.values ?? [])
    .map(([table_name, data_type, identifier, srs_id, column_count]) => {
      const count = db.exec(`SELECT COUNT(*) FROM ${quoteSqliteIdentifier(table_name)}`)[0].values[0][0];
      return { table_name, data_type, identifier, srs_id, column_count, count };
    });
const q = (value) => String(value ?? "").trim() || null;
const normalizeGisClave = (value = "") => {
  try {
    return normalizeLookupKey(value);
  } catch {
    return normalizeClaveText(value);
  }
};
const chunks = (items, size = 500) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

const pool = getGisPool();
const client = await pool.connect();
let batchId = null;

try {
  await client.query("BEGIN");
  const batch = await client.query(
    `INSERT INTO gis_import_batches (source_file, source_hash, source_type, status, metadata)
     VALUES ($1, $2, 'fase3_catastro_lotes', 'running', $3) RETURNING id`,
    [path.basename(zipPath), hash, { files }]
  );
  batchId = batch.rows[0].id;
  const recordError = async (sourceFid, reason, rawData = {}) => {
    await client.query(
      "INSERT INTO gis_import_errors (batch_id, source_fid, reason, raw_data) VALUES ($1, $2, $3, $4)",
      [batchId, String(sourceFid ?? ""), reason, rawData]
    );
  };
  const resilientInsert = async (items, buildQuery, reason) => {
    const savepoint = `sp_${Math.random().toString(36).slice(2)}`;
    try {
      const { sql, values } = buildQuery(items);
      await client.query(`SAVEPOINT ${savepoint}`);
      await client.query(sql, values);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      return { inserted: items.length, rejected: 0 };
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`).catch(() => {});
      await client.query(`RELEASE SAVEPOINT ${savepoint}`).catch(() => {});
      if (items.length === 1) {
        await recordError(items[0].fid, `${reason}: ${error.message}`, { fid: items[0].fid });
        return { inserted: 0, rejected: 1 };
      }
      const middle = Math.ceil(items.length / 2);
      const left = await resilientInsert(items.slice(0, middle), buildQuery, reason);
      const right = await resilientInsert(items.slice(middle), buildQuery, reason);
      return { inserted: left.inserted + right.inserted, rejected: left.rejected + right.rejected };
    }
  };

  const lotesDb = open("Lotes.gpkg");
  const lotesLayers = layers(lotesDb);
  const canonical = chooseCanonicalFeatureLayer(lotesLayers);
  if (!canonical) throw new Error("Lotes.gpkg no contiene capas feature.");

  const loteRows = selectRows(lotesDb, canonical.table_name, ["fid", "geom"]);
  let read = loteRows.length;
  let rejected = 0;
  for (const part of chunks(loteRows)) {
    const result = await resilientInsert(part, (items) => {
    const values = [];
    const placeholders = items.map((row, index) => {
      const offset = index * 3;
      values.push(canonical.table_name, row.fid, stripGpkgHeader(row.geom));
      return `($${offset + 1}, $${offset + 2}, ST_Multi(ST_Force2D(ST_SetSRID(ST_GeomFromWKB($${offset + 3}), 32616))))`;
    });
    return {
      sql: `INSERT INTO gis_lotes (source_dataset, source_fid, geom)
       VALUES ${placeholders.join(",")}
       ON CONFLICT (source_dataset, source_fid) DO UPDATE
       SET geom = EXCLUDED.geom, updated_at = NOW()`,
      values
    };
    }, "lote rechazado");
    rejected += result.rejected;
  }
  lotesDb.close();

  await client.query(`
    UPDATE gis_lotes l
    SET barrio_id = b.id, updated_at = NOW()
    FROM gis_barrios b
    WHERE l.source_dataset = $1 AND ST_Covers(b.geom, ST_PointOnSurface(l.geom))
  `, [canonical.table_name]);
  await client.query(`
    UPDATE gis_lotes l
    SET manzana_id = m.id, updated_at = NOW()
    FROM gis_manzanas m
    WHERE l.source_dataset = $1 AND ST_Covers(m.geom, ST_PointOnSurface(l.geom))
  `, [canonical.table_name]);

  await client.query("DELETE FROM gis_lote_etiquetas");
  const labelsDb = open("NumeroLotes.gpkg");
  const labelRows = selectRows(labelsDb, "numerolotes__texts", wantedColumns.numerolotes__texts)
    .map((row) => ({ ...row, numero: cleanLoteNumber(row.NumeroLote || row.Numero_Lote || row.text) }))
    .filter((row) => row.numero);
  for (const part of chunks(labelRows)) {
    const result = await resilientInsert(part, (items) => {
    const values = [];
    const placeholders = items.map((row, index) => {
      const offset = index * 4;
      values.push(row.fid, row.numero, q(row.text), stripGpkgHeader(row.geom));
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, ST_Force2D(ST_SetSRID(ST_GeomFromWKB($${offset + 4}), 32616)))`;
    });
    return {
      sql: `INSERT INTO gis_lote_etiquetas (source_fid, numero_lote, source_text, geom)
       VALUES ${placeholders.join(",")}
       ON CONFLICT (source_fid) DO UPDATE
       SET numero_lote = EXCLUDED.numero_lote, source_text = EXCLUDED.source_text, geom = EXCLUDED.geom`,
      values
    };
    }, "etiqueta lote rechazada");
    rejected += result.rejected;
  }
  labelsDb.close();
  await client.query(`
    WITH matched AS (
      SELECT e.id etiqueta_id, l.id lote_id,
             ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY ST_Area(l.geom)) rn
      FROM gis_lote_etiquetas e
      JOIN gis_lotes l ON l.source_dataset = $1 AND ST_Covers(l.geom, e.geom)
    )
    UPDATE gis_lote_etiquetas e
    SET lote_id = m.lote_id
    FROM matched m
    WHERE e.id = m.etiqueta_id AND m.rn = 1
  `, [canonical.table_name]);
  await client.query(`
    WITH picked AS (
      SELECT lote_id, numero_lote, ROW_NUMBER() OVER (PARTITION BY lote_id ORDER BY source_fid) rn
      FROM gis_lote_etiquetas
      WHERE lote_id IS NOT NULL
    )
    UPDATE gis_lotes l
    SET numero_lote = p.numero_lote, updated_at = NOW()
    FROM picked p
    WHERE l.id = p.lote_id AND p.rn = 1
  `);

  const catastroDb = open("BD_CatastroUsuarios.gpkg");
  const catastroRows = selectRows(catastroDb, "bd_catastrousuarios", wantedColumns.bd_catastrousuarios)
    .map((row) => ({ ...row, clave: normalizeGisClave(row.catastral2) }));
  for (const part of chunks(catastroRows, 400)) {
    const result = await resilientInsert(part, (items) => {
    const values = [];
    const placeholders = items.map((row, index) => {
      const offset = index * 11;
      values.push(
        row.fid,
        row.clave || null,
        buildClaveBase(row.clave) || null,
        q(row.abonado),
        q(row.inquilino),
        q(row.direccion),
        q(row.des_coloni),
        q(row["37. Uso de"]),
        q(row["38. Activi"]),
        q(row.Comentario),
        stripGpkgHeader(row.geom)
      );
      return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},ST_Transform(ST_Force2D(ST_SetSRID(ST_GeomFromWKB($${offset + 11}), 4326)), 32616))`;
    });
    return {
      sql: `INSERT INTO gis_catastro_puntos (
         source_fid, clave_catastral, clave_base, abonado, inquilino, direccion, colonia_origen,
         uso_inmueble, actividad, observacion, geom
       )
       VALUES ${placeholders.join(",")}
       ON CONFLICT (source_fid) DO UPDATE
       SET clave_catastral = EXCLUDED.clave_catastral, clave_base = EXCLUDED.clave_base,
           abonado = EXCLUDED.abonado, inquilino = EXCLUDED.inquilino, direccion = EXCLUDED.direccion,
           colonia_origen = EXCLUDED.colonia_origen, uso_inmueble = EXCLUDED.uso_inmueble,
           actividad = EXCLUDED.actividad, observacion = EXCLUDED.observacion,
           geom = EXCLUDED.geom, updated_at = NOW()`,
      values
    };
    }, "catastro rechazado");
    rejected += result.rejected;
  }
  catastroDb.close();

  await client.query(`
    UPDATE gis_catastro_puntos c
    SET barrio_id = b.id, updated_at = NOW()
    FROM gis_barrios b
    WHERE ST_Covers(b.geom, c.geom)
  `);
  await client.query(`
    UPDATE gis_catastro_puntos c
    SET manzana_id = m.id, updated_at = NOW()
    FROM gis_manzanas m
    WHERE ST_Covers(m.geom, c.geom)
  `);
  await client.query(`
    UPDATE gis_catastro_puntos c
    SET lote_id = l.id, updated_at = NOW()
    FROM gis_lotes l
    WHERE l.source_dataset = $1 AND ST_Covers(l.geom, c.geom)
  `, [canonical.table_name]);
  await client.query(`
    UPDATE gis_lotes l
    SET clave_catastral = c.clave_base, updated_at = NOW()
    FROM (
      SELECT lote_id, clave_base, ROW_NUMBER() OVER (PARTITION BY lote_id ORDER BY source_fid) rn
      FROM gis_catastro_puntos
      WHERE lote_id IS NOT NULL AND clave_base IS NOT NULL
    ) c
    WHERE l.id = c.lote_id AND c.rn = 1
  `);

  const report = await client.query(`
    WITH overlap_sample AS (
      SELECT a.id lote_a, b.id lote_b
      FROM gis_lotes a
      JOIN gis_lotes b ON a.id < b.id AND a.geom && b.geom AND ST_Overlaps(a.geom, b.geom)
      WHERE a.source_dataset = $1 AND b.source_dataset = $1
      LIMIT 500
    )
    SELECT json_build_object(
      'capa_canonica_lotes', $1,
      'capas_lotes', $2::jsonb,
      'lotes', (SELECT COUNT(*)::int FROM gis_lotes WHERE source_dataset = $1),
      'lotes_con_barrio', (SELECT COUNT(*)::int FROM gis_lotes WHERE source_dataset = $1 AND barrio_id IS NOT NULL),
      'lotes_con_manzana', (SELECT COUNT(*)::int FROM gis_lotes WHERE source_dataset = $1 AND manzana_id IS NOT NULL),
      'lotes_con_numero', (SELECT COUNT(*)::int FROM gis_lotes WHERE source_dataset = $1 AND numero_lote IS NOT NULL),
      'lotes_con_clave', (SELECT COUNT(*)::int FROM gis_lotes WHERE source_dataset = $1 AND clave_catastral IS NOT NULL),
      'etiquetas_lote', (SELECT COUNT(*)::int FROM gis_lote_etiquetas),
      'etiquetas_lote_emparejadas', (SELECT COUNT(*)::int FROM gis_lote_etiquetas WHERE lote_id IS NOT NULL),
      'catastro_puntos', (SELECT COUNT(*)::int FROM gis_catastro_puntos),
      'catastro_con_barrio', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE barrio_id IS NOT NULL),
      'catastro_con_manzana', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE manzana_id IS NOT NULL),
      'catastro_con_lote', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE lote_id IS NOT NULL),
      'catastro_con_clave', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE clave_catastral IS NOT NULL),
      'claves_catastro_duplicadas', (
        SELECT COUNT(*)::int FROM (
          SELECT clave_catastral FROM gis_catastro_puntos WHERE clave_catastral IS NOT NULL GROUP BY clave_catastral HAVING COUNT(*) > 1
        ) d
      ),
      'lotes_solapados_muestra', (SELECT COUNT(*)::int FROM overlap_sample),
      'lotes_integrados_detectados', (SELECT COALESCE(SUM(count),0)::int FROM jsonb_to_recordset($2::jsonb) AS x(table_name text, count int) WHERE table_name ILIKE '%integrado%'),
      'geometrias_invalidas', json_build_object(
        'lotes', (SELECT COUNT(*)::int FROM gis_lotes WHERE source_dataset = $1 AND NOT ST_IsValid(geom)),
        'catastro', (SELECT COUNT(*)::int FROM gis_catastro_puntos WHERE NOT ST_IsValid(geom))
      )
    ) resumen
  `, [canonical.table_name, JSON.stringify(lotesLayers)]);

  await client.query(
    `UPDATE gis_import_batches
     SET finished_at = NOW(), status = 'completed', records_read = $1, records_inserted = $2, records_rejected = $3, metadata = metadata || $4::jsonb
     WHERE id = $5`,
    [read, read - rejected, rejected, JSON.stringify(report.rows[0].resumen), batchId]
  );
  await client.query("COMMIT");
  console.log(JSON.stringify(report.rows[0].resumen, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  if (batchId) {
    await pool.query("UPDATE gis_import_batches SET finished_at = NOW(), status = 'failed', records_rejected = 1, metadata = metadata || $1::jsonb WHERE id = $2", [
      JSON.stringify({ error: error.message }),
      batchId
    ]);
  }
  throw error;
} finally {
  client.release();
  await pool.end();
  fs.rmSync(tmp, { recursive: true, force: true });
}
