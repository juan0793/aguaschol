import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import initSqlJs from "sql.js";
import { getGisPool } from "../../../config/gisDb.js";
import { parseBarrioLabel, stripGpkgHeader } from "../gisImportUtils.js";

const zipPath = process.argv[2];
if (!zipPath) {
  console.error("Uso: node src/modules/gis/scripts/import-territorio.js <SIG-CHOL.zip>");
  process.exit(1);
}

const files = [
  "SIG-CHOL/SIG-CHOL/Barrios.gpkg",
  "SIG-CHOL/SIG-CHOL/Texto_Barrios.gpkg",
  "SIG-CHOL/SIG-CHOL/Manzanas.gpkg",
  "SIG-CHOL/SIG-CHOL/Quebradas.gpkg"
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sig-territorio-"));
execFileSync("tar", ["-xf", zipPath, "-C", tmp, ...files], { stdio: "inherit" });

const SQL = await initSqlJs();
const open = (name) => new SQL.Database(fs.readFileSync(path.join(tmp, "SIG-CHOL", "SIG-CHOL", name)));
const rows = (db, table, columns) => {
  const result = db.exec(`SELECT ${columns.map((c) => `"${c}"`).join(", ")} FROM "${table}" ORDER BY fid`)[0];
  return result.values.map((value) => Object.fromEntries(result.columns.map((column, index) => [column, value[index]])));
};

const insertGeom = (client, table, fields, values, geom, srid) => {
  const names = [...fields, "geom"];
  const params = fields.map((_, index) => `$${index + 1}`);
  params.push(`ST_Multi(ST_Force2D(ST_SetSRID(ST_GeomFromWKB($${fields.length + 1}), ${srid})))`);
  const updates = [
    ...fields.filter((field) => field !== "source_fid").map((field) => `${field} = EXCLUDED.${field}`),
    "geom = EXCLUDED.geom",
    "updated_at = NOW()"
  ];
  return client.query(
    `INSERT INTO ${table} (${names.join(", ")}) VALUES (${params.join(", ")})
     ON CONFLICT (source_fid) DO UPDATE SET ${updates.join(", ")}`,
    [...values, geom]
  );
};

const pool = getGisPool();
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const barrios = open("Barrios.gpkg");
  for (const row of rows(barrios, "barrios", ["fid", "geom", "Shape_Area"])) {
    await insertGeom(client, "gis_barrios", ["source_fid", "area_m2"], [row.fid, row.Shape_Area], stripGpkgHeader(row.geom), 32616);
  }
  barrios.close();

  await client.query("DELETE FROM gis_barrio_etiquetas");
  const etiquetas = open("Texto_Barrios.gpkg");
  for (const row of rows(etiquetas, "texto_barrios", ["fid", "geom", "Text"])) {
    const parsed = parseBarrioLabel(row.Text);
    await client.query(
      `INSERT INTO gis_barrio_etiquetas (source_fid, tipo, nombre, clave, source_text, geom)
       VALUES ($1, $2, $3, $4, $5, ST_Force2D(ST_SetSRID(ST_GeomFromWKB($6), 32616)))
       ON CONFLICT (source_fid) DO UPDATE
       SET tipo = EXCLUDED.tipo, nombre = EXCLUDED.nombre, clave = EXCLUDED.clave,
           source_text = EXCLUDED.source_text, geom = EXCLUDED.geom`,
      [row.fid, parsed.tipo, parsed.nombre, parsed.clave, parsed.sourceText, stripGpkgHeader(row.geom)]
    );
  }
  etiquetas.close();

  await client.query(`
    UPDATE gis_barrio_etiquetas e
    SET barrio_id = b.id
    FROM gis_barrios b
    WHERE ST_Covers(b.geom, e.geom)
  `);
  await client.query(`
    WITH picked AS (
      SELECT e.*, COUNT(*) OVER (PARTITION BY e.clave) clave_count,
             ROW_NUMBER() OVER (PARTITION BY e.barrio_id ORDER BY e.source_fid) rn
      FROM gis_barrio_etiquetas e
      WHERE e.barrio_id IS NOT NULL
    )
    UPDATE gis_barrios b
    SET tipo = p.tipo,
        nombre = p.nombre,
        clave = CASE WHEN p.clave_count = 1 THEN p.clave ELSE NULL END,
        source_text = p.source_text,
        updated_at = NOW()
    FROM picked p
    WHERE b.id = p.barrio_id AND p.rn = 1
  `);

  const manzanas = open("Manzanas.gpkg");
  for (const row of rows(manzanas, "manzanas_choluteca", ["fid", "geom"])) {
    await insertGeom(client, "gis_manzanas", ["source_fid"], [row.fid], stripGpkgHeader(row.geom), 32616);
  }
  manzanas.close();
  await client.query(`
    UPDATE gis_manzanas m
    SET barrio_id = b.id, updated_at = NOW()
    FROM gis_barrios b
    WHERE ST_Covers(b.geom, ST_PointOnSurface(m.geom))
  `);

  const quebradas = open("Quebradas.gpkg");
  for (const row of rows(quebradas, "quebradas", ["fid", "geom"])) {
    await client.query(
      `INSERT INTO gis_quebradas (source_fid, geom)
       VALUES ($1, ST_Multi(ST_Force2D(ST_SetSRID(ST_GeomFromWKB($2), 32616))))
       ON CONFLICT (source_fid) DO UPDATE SET geom = EXCLUDED.geom`,
      [row.fid, stripGpkgHeader(row.geom)]
    );
  }
  quebradas.close();

  await client.query("COMMIT");
  const report = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM gis_barrios WHERE nombre IS NULL) sin_nombre,
      (SELECT COUNT(*)::int FROM gis_barrios WHERE clave IS NULL) sin_clave,
      (SELECT COUNT(*)::int FROM gis_barrios b WHERE NOT EXISTS (SELECT 1 FROM gis_barrio_etiquetas e WHERE e.barrio_id = b.id)) sin_etiqueta,
      (SELECT COUNT(*)::int FROM gis_barrio_etiquetas WHERE barrio_id IS NULL) fuera_de_poligono,
      (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM (
        SELECT clave, COUNT(*)::int total
        FROM gis_barrio_etiquetas
        WHERE clave IS NOT NULL
        GROUP BY clave
        HAVING COUNT(*) > 1
      ) d) duplicados
  `);
  console.log(JSON.stringify(report.rows[0], null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
  fs.rmSync(tmp, { recursive: true, force: true });
}
