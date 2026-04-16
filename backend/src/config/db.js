import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { env } from "./env.js";
import { hashPassword } from "../utils/password.js";

let pool;
let initializationPromise = null;
let retryTimer = null;

const dbStatus = {
  ready: env.useMemoryDb,
  mode: env.useMemoryDb ? "memory" : "mysql",
  lastError: null,
  attempts: 0,
  connectedAt: env.useMemoryDb ? new Date().toISOString() : null
};

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

const createConfigError = (message) => {
  const error = new Error(message);
  error.status = 503;
  return error;
};

const getMissingDatabaseFields = () => {
  const missing = [];

  if (!env.dbHost) {
    missing.push("DB_HOST o MYSQLHOST o DATABASE_URL");
  }

  if (!env.dbUser) {
    missing.push("DB_USER o MYSQLUSER o DATABASE_URL");
  }

  if (!env.dbName) {
    missing.push("DB_NAME o MYSQLDATABASE o DATABASE_URL");
  }

  return missing;
};

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

const ensureIndex = async (connection, { tableName, indexName, columns, unique = false }) => {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = ?
        AND table_name = ?
        AND index_name = ?
      LIMIT 1
    `,
    [env.dbName, tableName, indexName]
  );

  if (rows.length) {
    return;
  }

  const safeColumns = columns.map((column) => escapeIdentifier(column)).join(", ");
  const uniqueKeyword = unique ? "UNIQUE " : "";

  await connection.query(
    `CREATE ${uniqueKeyword}INDEX ${escapeIdentifier(indexName)} ON ${escapeIdentifier(tableName)} (${safeColumns})`
  );
};

const ensureColumn = async (connection, { tableName, columnName, definition }) => {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [env.dbName, tableName, columnName]
  );

  if (rows.length) {
    return;
  }

  await connection.query(
    `ALTER TABLE ${escapeIdentifier(tableName)} ADD COLUMN ${escapeIdentifier(columnName)} ${definition}`
  );
};

const ensureRoleEnum = async (connection) => {
  await connection.query(
    `
      ALTER TABLE ${escapeIdentifier("app_users")}
      MODIFY COLUMN ${escapeIdentifier("role")} ENUM('admin', 'operator', 'transport') NOT NULL DEFAULT 'operator'
    `
  );
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

const closePool = async () => {
  if (!pool) {
    return;
  }

  const currentPool = pool;
  pool = null;
  await currentPool.end().catch(() => {});
};

const ensureSchema = async () => {
  const admin = await mysql.createConnection(connectionConfig(false, true));

  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(env.dbName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await admin.query(`USE ${escapeIdentifier(env.dbName)}`);

    const schemaSql = await fs.readFile(schemaPath, "utf8");
    await admin.query(schemaSql);
    await ensureRoleEnum(admin);
    await ensureColumn(admin, {
      tableName: "app_users",
      columnName: "full_name",
      definition: "VARCHAR(180) NOT NULL DEFAULT 'Usuario'"
    });
    await ensureColumn(admin, {
      tableName: "app_users",
      columnName: "force_password_change",
      definition: "TINYINT(1) NOT NULL DEFAULT 0"
    });
    await ensureColumn(admin, {
      tableName: "inmuebles_clandestinos",
      columnName: "archived_at",
      definition: "TIMESTAMP NULL DEFAULT NULL"
    });
    await ensureColumn(admin, {
      tableName: "inmuebles_clandestinos",
      columnName: "archived_reason",
      definition: "VARCHAR(255) NOT NULL DEFAULT ''"
    });
    await ensureColumn(admin, {
      tableName: "audit_logs",
      columnName: "actor_name_snapshot",
      definition: "VARCHAR(180) NOT NULL DEFAULT ''"
    });
    await ensureColumn(admin, {
      tableName: "audit_logs",
      columnName: "actor_email_snapshot",
      definition: "VARCHAR(180) NOT NULL DEFAULT ''"
    });
    await ensureColumn(admin, {
      tableName: "map_points",
      columnName: "marker_color",
      definition: "VARCHAR(20) NOT NULL DEFAULT '#1576d1'"
    });
    await ensureColumn(admin, {
      tableName: "map_points",
      columnName: "is_terminal_point",
      definition: "TINYINT(1) NOT NULL DEFAULT 0"
    });
    await admin.query(
      `
        UPDATE audit_logs
        LEFT JOIN app_users ON app_users.id = audit_logs.actor_user_id
        SET
          audit_logs.actor_name_snapshot = CASE
            WHEN audit_logs.actor_name_snapshot = '' THEN COALESCE(app_users.full_name, audit_logs.actor_name_snapshot)
            ELSE audit_logs.actor_name_snapshot
          END,
          audit_logs.actor_email_snapshot = CASE
            WHEN audit_logs.actor_email_snapshot = '' THEN COALESCE(app_users.email, audit_logs.actor_email_snapshot)
            ELSE audit_logs.actor_email_snapshot
          END
      `
    );
    await ensureIndex(admin, {
      tableName: "auth_sessions",
      indexName: "idx_auth_sessions_user",
      columns: ["user_id"]
    });
    await ensureIndex(admin, {
      tableName: "auth_sessions",
      indexName: "idx_auth_sessions_expires_at",
      columns: ["expires_at"]
    });
    await ensureIndex(admin, {
      tableName: "audit_logs",
      indexName: "idx_audit_logs_created_at",
      columns: ["created_at"]
    });
    await ensureIndex(admin, {
      tableName: "audit_logs",
      indexName: "idx_audit_logs_entity",
      columns: ["entity_type", "entity_id"]
    });
    await ensureIndex(admin, {
      tableName: "inmuebles_clandestinos",
      indexName: "idx_inmuebles_barrio_colonia",
      columns: ["barrio_colonia"]
    });
    await ensureIndex(admin, {
      tableName: "inmuebles_clandestinos",
      indexName: "idx_inmuebles_archived_at",
      columns: ["archived_at"]
    });
    await ensureIndex(admin, {
      tableName: "map_points",
      indexName: "idx_map_points_created_at",
      columns: ["created_at"]
    });
    await ensureIndex(admin, {
      tableName: "map_points",
      indexName: "idx_map_points_creator",
      columns: ["created_by"]
    });
    await ensureIndex(admin, {
      tableName: "transport_routes",
      indexName: "idx_transport_routes_status",
      columns: ["status"]
    });
    await ensureIndex(admin, {
      tableName: "transport_routes",
      indexName: "idx_transport_routes_assigned_user",
      columns: ["assigned_user_id"]
    });
    await ensureIndex(admin, {
      tableName: "transport_route_positions",
      indexName: "idx_transport_route_positions_route",
      columns: ["route_id", "captured_at"]
    });
    await ensureIndex(admin, {
      tableName: "transport_route_positions",
      indexName: "idx_transport_route_positions_user",
      columns: ["created_by"]
    });
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

const initializeDatabase = async () => {
  if (env.useMemoryDb) {
    dbStatus.ready = true;
    dbStatus.lastError = null;
    return "memory";
  }

  const missingFields = getMissingDatabaseFields();
  if (missingFields.length) {
    throw createConfigError(`Configuracion MySQL incompleta: falta ${missingFields.join(", ")}.`);
  }

  if (!(await canConnect(false))) {
    await startLocalMariaDb();
  }

  await closePool();
  await ensureSchema();
  await ensureDefaultAdminUser();

  pool = mysql.createPool({
    ...connectionConfig(true),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  await pool.query("SELECT 1");
  return "mysql";
};

export const ensureDatabaseReady = async () => {
  if (dbStatus.ready && pool) {
    return dbStatus.mode;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    dbStatus.attempts += 1;

    try {
      const mode = await initializeDatabase();
      dbStatus.ready = true;
      dbStatus.mode = mode;
      dbStatus.lastError = null;
      dbStatus.connectedAt = new Date().toISOString();
      return mode;
    } catch (error) {
      dbStatus.ready = false;
      dbStatus.lastError = error.message;
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
};

export const getDatabaseStatus = () => ({ ...dbStatus });

export const startDatabaseReconnectLoop = async () => {
  try {
    const mode = await ensureDatabaseReady();
    console.log(`Base de datos disponible en modo ${mode}.`);
    return mode;
  } catch (error) {
    console.error(`Base de datos aun no disponible: ${error.message}`);

    if (env.dbConnectRetries > 0 && dbStatus.attempts >= env.dbConnectRetries) {
      console.error("Se alcanzo el limite de reintentos de conexion a MySQL.");
      return null;
    }

    if (!retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        startDatabaseReconnectLoop().catch(() => {});
      }, env.dbConnectRetryDelayMs);
    }

    return null;
  }
};

export const getPool = () => {
  if (!pool) {
    throw createConfigError("La base de datos aun no esta lista. Intenta de nuevo en unos segundos.");
  }

  return pool;
};
