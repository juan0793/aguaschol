import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGisPool } from "../../../config/gisDb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(__dirname, "../migrations/001_territorio.sql");

const sql = await fs.readFile(migrationPath, "utf8");
await getGisPool().query(sql);
await getGisPool().end();
console.log("Migracion territorio SIG aplicada.");
