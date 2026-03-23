import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const projectRoot = path.resolve(backendRoot, "..");
const isRailway =
  Boolean(process.env.RAILWAY_ENVIRONMENT) ||
  Boolean(process.env.RAILWAY_PROJECT_ID) ||
  Boolean(process.env.RAILWAY_SERVICE_ID);

const parseDatabaseUrl = (value) => {
  if (!value) {
    return {};
  }

  try {
    const url = new URL(value);
    const databaseName = url.pathname.replace(/^\/+/, "");

    return {
      dbHost: url.hostname || undefined,
      dbPort: url.port ? Number(url.port) : undefined,
      dbUser: url.username ? decodeURIComponent(url.username) : undefined,
      dbPassword: url.password ? decodeURIComponent(url.password) : undefined,
      dbName: databaseName || undefined
    };
  } catch {
    return {};
  }
};

const databaseUrlConfig = parseDatabaseUrl(process.env.DATABASE_URL ?? process.env.MYSQL_URL);
const frontendUrlDefaults = isRailway ? "" : "http://localhost:5173";
const frontendUrls = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? frontendUrlDefaults)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  isRailway,
  frontendUrl: frontendUrls[0] ?? "",
  frontendUrls,
  dbHost: process.env.DB_HOST ?? process.env.MYSQLHOST ?? databaseUrlConfig.dbHost ?? (isRailway ? "" : "localhost"),
  dbPort: Number(process.env.DB_PORT ?? process.env.MYSQLPORT ?? databaseUrlConfig.dbPort ?? 3306),
  dbUser: process.env.DB_USER ?? process.env.MYSQLUSER ?? databaseUrlConfig.dbUser ?? (isRailway ? "" : "root"),
  dbPassword: process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? databaseUrlConfig.dbPassword ?? "",
  dbName: process.env.DB_NAME ?? process.env.MYSQLDATABASE ?? databaseUrlConfig.dbName ?? (isRailway ? "" : "app_clandestinos"),
  useMemoryDb: String(process.env.USE_MEMORY_DB ?? "false").toLowerCase() === "true",
  dbAutoStart: String(process.env.DB_AUTO_START ?? (isRailway ? "false" : "true")).toLowerCase() === "true",
  dbConnectRetries: Number(process.env.DB_CONNECT_RETRIES ?? (isRailway ? 0 : 10)),
  dbConnectRetryDelayMs: Number(process.env.DB_CONNECT_RETRY_DELAY_MS ?? 5000),
  dbRoot: projectRoot,
  dbWorkspaceDir: path.resolve(projectRoot, ".db"),
  dbDataDir: path.resolve(projectRoot, ".db", "mariadb-data"),
  dbRunDir: path.resolve(projectRoot, ".db", "mariadb-run"),
  uploadDir: path.resolve(projectRoot, process.env.UPLOAD_DIR ?? "backend/uploads"),
  authUsername: process.env.AUTH_USERNAME ?? "admin",
  authPassword: process.env.AUTH_PASSWORD ?? "abcd123",
  authSeedName: process.env.AUTH_SEED_NAME ?? "Administrador General",
  authSessionDays: Number(process.env.AUTH_SESSION_DAYS ?? 7),
  emailProvider: process.env.EMAIL_PROVIDER ?? "brevo",
  emailFrom: process.env.EMAIL_FROM ?? "",
  emailFromName: process.env.EMAIL_FROM_NAME ?? "Aguas de Choluteca",
  emailApiKey: process.env.EMAIL_API_KEY ?? "",
  emailSandbox: String(process.env.EMAIL_SANDBOX ?? "true").toLowerCase() === "true"
};
