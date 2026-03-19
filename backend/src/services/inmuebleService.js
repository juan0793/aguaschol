import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { buildAvisoHtml } from "../utils/avisoTemplate.js";
import { likeValue, normalizeKey } from "../utils/normalize.js";

const memoryRecords = [
  {
    id: 1,
    clave_catastral: "10-22-23",
    abonado: "",
    nombre_catastral: "10-22-23",
    inquilino: "",
    barrio_colonia: "Barrio San Juan Bosco",
    identidad: "",
    telefono: "",
    accion_inspeccion:
      "Inspeccion realizada por Oscar Ivan Alvarez, tiene activos los tres servicios y se visualiza la conexion de agua potable y alcantarillado sanitario.",
    situacion_inmueble: "Habitado",
    tendencia_inmueble: "",
    uso_suelo: "Residencial",
    actividad: "Vivienda",
    codigo_sector: "",
    comentarios: "Clandestino",
    conexion_agua: "Si",
    conexion_alcantarillado: "Si",
    recoleccion_desechos: "Si",
    foto_path: "",
    fecha_aviso: "2026-03-17",
    firmante_aviso: "Maria Eugenia Berrios",
    cargo_firmante: "Jefe de Facturacion",
    levantamiento_datos: "LUIS FERNANDO HERRERA SOLIZ",
    analista_datos: "JUAN ORDONEZ BONILLA",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const mapPayload = (payload) => ({
  clave_catastral: normalizeKey(payload.clave_catastral),
  abonado: payload.abonado?.trim() ?? "",
  nombre_catastral: payload.nombre_catastral?.trim() ?? "",
  inquilino: payload.inquilino?.trim() ?? "",
  barrio_colonia: payload.barrio_colonia?.trim() ?? "",
  identidad: payload.identidad?.trim() ?? "",
  telefono: payload.telefono?.trim() ?? "",
  accion_inspeccion: payload.accion_inspeccion?.trim() ?? "",
  situacion_inmueble: payload.situacion_inmueble?.trim() ?? "",
  tendencia_inmueble: payload.tendencia_inmueble?.trim() ?? "",
  uso_suelo: payload.uso_suelo?.trim() ?? "",
  actividad: payload.actividad?.trim() ?? "",
  codigo_sector: payload.codigo_sector?.trim() ?? "",
  comentarios: payload.comentarios?.trim() ?? "",
  conexion_agua: payload.conexion_agua?.trim() ?? "No",
  conexion_alcantarillado: payload.conexion_alcantarillado?.trim() ?? "No",
  recoleccion_desechos: payload.recoleccion_desechos?.trim() ?? "No",
  fecha_aviso: payload.fecha_aviso || null,
  firmante_aviso: payload.firmante_aviso?.trim() ?? "",
  cargo_firmante: payload.cargo_firmante?.trim() ?? "",
  levantamiento_datos: payload.levantamiento_datos?.trim() ?? "",
  analista_datos: payload.analista_datos?.trim() ?? ""
});

const ensureKey = (payload) => {
  if (!payload.clave_catastral) {
    const error = new Error("La clave catastral es obligatoria.");
    error.status = 400;
    throw error;
  }
};

const sortByUpdatedAt = (items) =>
  [...items].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

export const listInmuebles = async ({ query = "" } = {}) => {
  if (env.useMemoryDb) {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? memoryRecords.filter((item) =>
          [item.clave_catastral, item.abonado, item.barrio_colonia]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      : memoryRecords;

    return sortByUpdatedAt(filtered);
  }

  const pool = getPool();
  const sql = `
    SELECT *
    FROM inmuebles_clandestinos
    WHERE (? = '' OR clave_catastral LIKE ? OR abonado LIKE ? OR barrio_colonia LIKE ?)
    ORDER BY updated_at DESC
  `;
  const term = query.trim();
  const [rows] = await pool.query(sql, [term, likeValue(term), likeValue(term), likeValue(term)]);
  return rows;
};

export const getByClave = async (clave) => {
  const normalized = normalizeKey(clave);

  if (env.useMemoryDb) {
    return memoryRecords.find((item) => item.clave_catastral === normalized) ?? null;
  }

  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM inmuebles_clandestinos WHERE clave_catastral = ? LIMIT 1",
    [normalized]
  );
  return rows[0] ?? null;
};

export const getById = async (id) => {
  if (env.useMemoryDb) {
    return memoryRecords.find((item) => item.id === Number(id)) ?? null;
  }

  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM inmuebles_clandestinos WHERE id = ? LIMIT 1", [id]);
  return rows[0] ?? null;
};

export const createInmueble = async (payload) => {
  const data = mapPayload(payload);
  ensureKey(data);

  if (env.useMemoryDb) {
    const existing = memoryRecords.find((item) => item.clave_catastral === data.clave_catastral);
    if (existing) {
      const error = new Error("Ya existe un inmueble con esa clave catastral.");
      error.status = 409;
      throw error;
    }

    const record = {
      id: memoryRecords.length + 1,
      ...data,
      foto_path: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryRecords.unshift(record);
    return record;
  }

  const pool = getPool();
  const [result] = await pool.query(
    `
      INSERT INTO inmuebles_clandestinos (
        clave_catastral, abonado, nombre_catastral, inquilino, barrio_colonia,
        identidad, telefono, accion_inspeccion, situacion_inmueble, tendencia_inmueble,
        uso_suelo, actividad, codigo_sector, comentarios, conexion_agua,
        conexion_alcantarillado, recoleccion_desechos, fecha_aviso, firmante_aviso,
        cargo_firmante, levantamiento_datos, analista_datos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.clave_catastral,
      data.abonado,
      data.nombre_catastral,
      data.inquilino,
      data.barrio_colonia,
      data.identidad,
      data.telefono,
      data.accion_inspeccion,
      data.situacion_inmueble,
      data.tendencia_inmueble,
      data.uso_suelo,
      data.actividad,
      data.codigo_sector,
      data.comentarios,
      data.conexion_agua,
      data.conexion_alcantarillado,
      data.recoleccion_desechos,
      data.fecha_aviso,
      data.firmante_aviso,
      data.cargo_firmante,
      data.levantamiento_datos,
      data.analista_datos
    ]
  );

  return getById(result.insertId);
};

export const updateInmueble = async (id, payload) => {
  const data = mapPayload(payload);
  ensureKey(data);

  if (env.useMemoryDb) {
    const index = memoryRecords.findIndex((item) => item.id === Number(id));
    if (index === -1) {
      const error = new Error("Inmueble no encontrado.");
      error.status = 404;
      throw error;
    }

    memoryRecords[index] = {
      ...memoryRecords[index],
      ...data,
      updated_at: new Date().toISOString()
    };

    return memoryRecords[index];
  }

  const pool = getPool();
  const [result] = await pool.query(
    `
      UPDATE inmuebles_clandestinos
      SET clave_catastral = ?, abonado = ?, nombre_catastral = ?, inquilino = ?,
          barrio_colonia = ?, identidad = ?, telefono = ?, accion_inspeccion = ?,
          situacion_inmueble = ?, tendencia_inmueble = ?, uso_suelo = ?,
          actividad = ?, codigo_sector = ?, comentarios = ?, conexion_agua = ?,
          conexion_alcantarillado = ?, recoleccion_desechos = ?, fecha_aviso = ?,
          firmante_aviso = ?, cargo_firmante = ?, levantamiento_datos = ?, analista_datos = ?
      WHERE id = ?
    `,
    [
      data.clave_catastral,
      data.abonado,
      data.nombre_catastral,
      data.inquilino,
      data.barrio_colonia,
      data.identidad,
      data.telefono,
      data.accion_inspeccion,
      data.situacion_inmueble,
      data.tendencia_inmueble,
      data.uso_suelo,
      data.actividad,
      data.codigo_sector,
      data.comentarios,
      data.conexion_agua,
      data.conexion_alcantarillado,
      data.recoleccion_desechos,
      data.fecha_aviso,
      data.firmante_aviso,
      data.cargo_firmante,
      data.levantamiento_datos,
      data.analista_datos,
      id
    ]
  );

  if (result.affectedRows === 0) {
    const error = new Error("Inmueble no encontrado.");
    error.status = 404;
    throw error;
  }

  return getById(id);
};

export const attachPhoto = async (id, fotoPath) => {
  if (env.useMemoryDb) {
    const record = memoryRecords.find((item) => item.id === Number(id));
    if (!record) {
      const error = new Error("Inmueble no encontrado.");
      error.status = 404;
      throw error;
    }

    record.foto_path = fotoPath;
    record.updated_at = new Date().toISOString();
    return record;
  }

  const pool = getPool();
  const [result] = await pool.query(
    "UPDATE inmuebles_clandestinos SET foto_path = ? WHERE id = ?",
    [fotoPath, id]
  );

  if (result.affectedRows === 0) {
    const error = new Error("Inmueble no encontrado.");
    error.status = 404;
    throw error;
  }

  return getById(id);
};

export const buildAviso = async (id) => {
  const record = await getById(id);

  if (!record) {
    const error = new Error("Inmueble no encontrado.");
    error.status = 404;
    throw error;
  }

  return {
    ...record,
    aviso_html: buildAvisoHtml(record)
  };
};

export const buildAvisoPreview = async (payload) => {
  const data = mapPayload(payload);

  return {
    ...data,
    foto_path: payload.foto_path ?? "",
    aviso_html: buildAvisoHtml(data)
  };
};
