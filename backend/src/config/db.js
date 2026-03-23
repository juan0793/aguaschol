import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { env } from "./env.js";
import { hashPassword } from "../utils/password.js";

let pool;

const schemaPath = path.resolve(env.dbRoot, "backend", "sql", "schema.sql");

const escapeIdentifier = (value) => `\`${String(value).replace(/`/g, "``")}\``;

const connectionConfig = (includeDatabase = true, multipleStatements = false) => ({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  ...(includeDatabase ? { database: env.dbName } : {}),
  multipleStatements
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const canConnect = async (includeDatabase = true) => {
  let connection;

  try {
    connection = await mysql.createConnection(connectionConfig(includeDatabase));
    await connection.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await connection?.end().catch(() => {});
  }
};

const findLocalMariaDbBin = async () => {
  try {
    const entries = await fs.readdir(path.resolve(env.dbWorkspaceDir, "mariadb"), {
      withFileTypes: true
    });
    const folder = entries.find((entry) => entry.isDirectory() && entry.name.startsWith("mariadb-"));
    return folder
      ? path.resolve(env.dbWorkspaceDir, "mariadb", folder.name, "bin")
      : null;
  } catch {
    return null;
  }
};

const initializeLocalMariaDb = async (binDir) => {
  await fs.mkdir(env.dbDataDir, { recursive: true });
  await fs.mkdir(env.dbRunDir, { recursive: true });

  const myIniPath = path.resolve(env.dbDataDir, "my.ini");

  try {
    await fs.access(myIniPath);
    return myIniPath;
  } catch {
    // Continue with initialization.
  }

  const installDb = path.resolve(binDir, "mariadb-install-db.exe");

  await new Promise((resolve, reject) => {
    const child = spawn(
      installDb,
      [
        `--datadir=${env.dbDataDir}`,
        `--port=${env.dbPort}`,
        `--password=${env.dbPassword}`,
        "--default-user"
      ],
      {
        cwd: env.dbRoot,
        stdio: "pipe",
        windowsHide: true
      }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || "No fue posible inicializar MariaDB local."));
    });
  });

  return myIniPath;
};

const startLocalMariaDb = async () => {
  if (await canConnect(false)) {
    return;
  }

  if (!env.dbAutoStart) {
    throw new Error("MySQL no esta disponible y DB_AUTO_START esta deshabilitado.");
  }

  const binDir = await findLocalMariaDbBin();
  if (!binDir) {
    throw new Error(
      "No se encontro MariaDB local en .db/mariadb. Descarga o instala la version portable para activar el guardado persistente."
    );
  }

  const myIniPath = await initializeLocalMariaDb(binDir);
  const mariaDbExe = path.resolve(binDir, "mariadbd.exe");

  const child = spawn(mariaDbExe, [`--defaults-file=${myIniPath}`, "--console"], {
    cwd: env.dbRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  child.unref();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await canConnect(false)) {
      return;
    }

    await delay(1000);
  }

  throw new Error("MariaDB local no logro iniciar en el tiempo esperado.");
};

const ensureSchema = async () => {
  const admin = await mysql.createConnection(connectionConfig(false, true));

  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(env.dbName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );

    const schemaSql = await fs.readFile(schemaPath, "utf8");
    await admin.query(schemaSql);
    await admin.query(`
      ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS full_name VARCHAR(180) NOT NULL DEFAULT 'Usuario'
    `);
    await admin.query(`
      ALTER TABLE inmuebles_clandestinos
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS archived_reason VARCHAR(255) NOT NULL DEFAULT ''
    `);
    await admin.query(`
      CREATE INDEX IF NOT EXISTS idx_inmuebles_archived_at
      ON inmuebles_clandestinos (archived_at)
    `);
  } finally {
    await admin.end();
  }
};

const ensureDefaultAdminUser = async () => {
  const admin = await mysql.createConnection(connectionConfig(true));

  try {
    const [rows] = await admin.query("SELECT id FROM app_users WHERE username = ? LIMIT 1", [env.authUsername]);
    if (rows.length) {
      return;
    }

    const passwordHash = await hashPassword(env.authPassword);
    await admin.query(
      `
        INSERT INTO app_users (full_name, email, username, role, password_hash, is_active)
        VALUES (?, ?, ?, 'admin', ?, 1)
      `,
      [env.authSeedName, `${env.authUsername}@local.aguaschol`, env.authUsername, passwordHash]
    );
  } finally {
    await admin.end();
  }
};

export const ensureDatabaseReady = async () => {
  if (env.useMemoryDb) {
    return "memory";
  }

  if (!(await canConnect(false))) {
    await startLocalMariaDb();
  }

  await ensureSchema();
  await ensureDefaultAdminUser();

  if (!pool) {
    pool = mysql.createPool({
      ...connectionConfig(true),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  await pool.query("SELECT 1");
  return "mysql";
};

export const getPool = () => {
  if (!pool) {
    throw new Error("La base de datos aun no esta inicializada.");
  }

  return pool;
};
