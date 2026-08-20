import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGisPool } from "../../../config/gisDb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../migrations");

const pool = getGisPool();
const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
for (const file of files) {
  const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
  await pool.query(sql);
  console.log(`Migracion aplicada: ${file}`);
}
await pool.end();
