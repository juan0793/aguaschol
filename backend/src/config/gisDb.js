import pg from "pg";
import { env } from "./env.js";

let pool;

export const isGisConfigured = () => Boolean(env.gisDatabaseUrl);

export const getGisPool = () => {
  if (!isGisConfigured()) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: env.gisDatabaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return pool;
};

export const checkGisConnection = async () => {
  if (!isGisConfigured()) {
    return { configured: false, ready: false, postgis: false };
  }

  const result = await getGisPool().query("SELECT postgis_version() AS version");
  return {
    configured: true,
    ready: true,
    postgis: true,
    version: result.rows[0]?.version || ""
  };
};
