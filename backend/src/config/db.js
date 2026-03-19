import mysql from "mysql2/promise";
import { env } from "./env.js";

let pool;

export const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: env.dbHost,
      port: env.dbPort,
      user: env.dbUser,
      password: env.dbPassword,
      database: env.dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  return pool;
};
