import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
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
    analista_datos: "Ing. Juan Ordoñez Bonilla",
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

const mapArchivePayload = (payload = {}) => ({
  archived_reason: payload.archived_reason?.trim() ?? ""
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

export const listInmuebles = async ({ query = "", archived = false } = {}) => {
  if (env.useMemoryDb) {
    const term = query.trim().toLowerCase();
    const scoped = memoryRecords.filter((item) => Boolean(item.archived_at) === archived);
    const filtered = term
      ? scoped.filter((item) =>
          [item.clave_catastral, item.abonado, item.barrio_colonia]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      : scoped;

    return sortByUpdatedAt(filtered);
  }

  const pool = getPool();
  const sql = `
    SELECT *
    FROM inmuebles_clandestinos
    WHERE archived_at IS ${archived ? "NOT NULL" : "NULL"}
      AND (? = '' OR clave_catastral LIKE ? OR abonado LIKE ? OR barrio_colonia LIKE ?)
    ORDER BY updated_at DESC
  `;
  const term = query.trim();
  const [rows] = await pool.query(sql, [term, likeValue(term), likeValue(term), likeValue(term)]);
  return rows;
};

export const getByClave = async (clave) => {
  const normalized = normalizeKey(clave);

  if (env.useMemoryDb) {
    return (
      memoryRecords.find((item) => item.clave_catastral === normalized && !item.archived_at) ?? null
    );
  }

  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM inmuebles_clandestinos WHERE clave_catastral = ? AND archived_at IS NULL LIMIT 1",
    [normalized]
  );
  return rows[0] ?? null;
};

export const getById = async (id, { includeArchived = true } = {}) => {
  if (env.useMemoryDb) {
    return (
      memoryRecords.find(
        (item) => item.id === Number(id) && (includeArchived ? true : !item.archived_at)
      ) ?? null
    );
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM inmuebles_clandestinos WHERE id = ? ${
      includeArchived ? "" : "AND archived_at IS NULL"
    } LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
};

export const createInmueble = async (payload, options = {}) => {
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
      archived_at: null,
      archived_reason: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryRecords.unshift(record);
    await createAuditLog({
      actorUserId: options.actorUserId ?? null,
      action: "inmueble.created",
      entityType: "inmueble",
      entityId: record.id,
      summary: `Ficha ${record.clave_catastral} creada`
    });
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

  const record = await getById(result.insertId);
  await createAuditLog({
    actorUserId: options.actorUserId ?? null,
    action: "inmueble.created",
    entityType: "inmueble",
    entityId: record.id,
    summary: `Ficha ${record.clave_catastral} creada`
  });
  return record;
};

export const updateInmueble = async (id, payload, options = {}) => {
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
      archived_at: memoryRecords[index].archived_at ?? null,
      archived_reason: memoryRecords[index].archived_reason ?? "",
      updated_at: new Date().toISOString()
    };

    await createAuditLog({
      actorUserId: options.actorUserId ?? null,
      action: "inmueble.updated",
      entityType: "inmueble",
      entityId: memoryRecords[index].id,
      summary: `Ficha ${memoryRecords[index].clave_catastral} actualizada`
    });
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

  const record = await getById(id);
  await createAuditLog({
    actorUserId: options.actorUserId ?? null,
    action: "inmueble.updated",
    entityType: "inmueble",
    entityId: record.id,
    summary: `Ficha ${record.clave_catastral} actualizada`
  });
  return record;
};

export const attachPhoto = async (id, fotoPath, options = {}) => {
  if (env.useMemoryDb) {
    const record = memoryRecords.find((item) => item.id === Number(id));
    if (!record) {
      const error = new Error("Inmueble no encontrado.");
      error.status = 404;
      throw error;
    }

    record.foto_path = fotoPath;
    record.updated_at = new Date().toISOString();
    await createAuditLog({
      actorUserId: options.actorUserId ?? null,
      action: "inmueble.photo_attached",
      entityType: "inmueble",
      entityId: record.id,
      summary: `Fotografia actualizada para ${record.clave_catastral}`,
      details: {
        foto_path: record.foto_path
      }
    });
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

  const record = await getById(id);
  await createAuditLog({
    actorUserId: options.actorUserId ?? null,
    action: "inmueble.photo_attached",
    entityType: "inmueble",
    entityId: record.id,
    summary: `Fotografia actualizada para ${record.clave_catastral}`,
    details: {
      foto_path: record.foto_path
    }
  });
  return record;
};

export const archiveInmueble = async (id, payload = {}, options = {}) => {
  const archiveData = mapArchivePayload(payload);

  if (env.useMemoryDb) {
    const record = memoryRecords.find((item) => item.id === Number(id));
    if (!record || record.archived_at) {
      const error = new Error("Inmueble no encontrado.");
      error.status = 404;
      throw error;
    }

    record.archived_at = new Date().toISOString();
    record.archived_reason = archiveData.archived_reason;
    record.updated_at = new Date().toISOString();
    await createAuditLog({
      actorUserId: options.actorUserId ?? null,
      action: "inmueble.archived",
      entityType: "inmueble",
      entityId: record.id,
      summary: `Ficha ${record.clave_catastral} archivada`,
      details: { archived_reason: record.archived_reason }
    });
    return record;
  }

  const pool = getPool();
  const [result] = await pool.query(
    `
      UPDATE inmuebles_clandestinos
      SET archived_at = CURRENT_TIMESTAMP, archived_reason = ?
      WHERE id = ? AND archived_at IS NULL
    `,
    [archiveData.archived_reason, id]
  );

  if (result.affectedRows === 0) {
    const error = new Error("Inmueble no encontrado.");
    error.status = 404;
    throw error;
  }

  const record = await getById(id);
  await createAuditLog({
    actorUserId: options.actorUserId ?? null,
    action: "inmueble.archived",
    entityType: "inmueble",
    entityId: record.id,
    summary: `Ficha ${record.clave_catastral} archivada`,
    details: { archived_reason: record.archived_reason }
  });
  return record;
};

export const restoreInmueble = async (id, options = {}) => {
  if (env.useMemoryDb) {
    const record = memoryRecords.find((item) => item.id === Number(id));
    if (!record || !record.archived_at) {
      const error = new Error("Inmueble archivado no encontrado.");
      error.status = 404;
      throw error;
    }

    record.archived_at = null;
    record.archived_reason = "";
    record.updated_at = new Date().toISOString();
    await createAuditLog({
      actorUserId: options.actorUserId ?? null,
      action: "inmueble.restored",
      entityType: "inmueble",
      entityId: record.id,
      summary: `Ficha ${record.clave_catastral} restaurada`
    });
    return record;
  }

  const pool = getPool();
  const [result] = await pool.query(
    `
      UPDATE inmuebles_clandestinos
      SET archived_at = NULL, archived_reason = ''
      WHERE id = ? AND archived_at IS NOT NULL
    `,
    [id]
  );

  if (result.affectedRows === 0) {
    const error = new Error("Inmueble archivado no encontrado.");
    error.status = 404;
    throw error;
  }

  const record = await getById(id);
  await createAuditLog({
    actorUserId: options.actorUserId ?? null,
    action: "inmueble.restored",
    entityType: "inmueble",
    entityId: record.id,
    summary: `Ficha ${record.clave_catastral} restaurada`
  });
  return record;
};

export const deleteArchivedInmueble = async (id, options = {}) => {
  if (env.useMemoryDb) {
    const index = memoryRecords.findIndex((item) => item.id === Number(id) && item.archived_at);
    if (index === -1) {
      const error = new Error("Ficha archivada no encontrada.");
      error.status = 404;
      throw error;
    }

    const [record] = memoryRecords.splice(index, 1);
    await createAuditLog({
      actorUserId: options.actorUserId ?? null,
      action: "inmueble.deleted",
      entityType: "inmueble",
      entityId: record.id,
      summary: `Ficha archivada ${record.clave_catastral} eliminada`,
      details: { archived_reason: record.archived_reason }
    });
    return record;
  }

  const record = await getById(id);
  if (!record || !record.archived_at) {
    const error = new Error("Ficha archivada no encontrada.");
    error.status = 404;
    throw error;
  }

  const pool = getPool();
  const [result] = await pool.query("DELETE FROM inmuebles_clandestinos WHERE id = ? AND archived_at IS NOT NULL", [id]);

  if (result.affectedRows === 0) {
    const error = new Error("Ficha archivada no encontrada.");
    error.status = 404;
    throw error;
  }

  if (record.foto_path) {
    const relativePhotoPath = record.foto_path.startsWith("/") ? `.${record.foto_path}` : record.foto_path;
    const absolutePhotoPath = path.resolve(env.dbRoot, relativePhotoPath);
    await fs.unlink(absolutePhotoPath).catch(() => {});
  }

  await createAuditLog({
    actorUserId: options.actorUserId ?? null,
    action: "inmueble.deleted",
    entityType: "inmueble",
    entityId: record.id,
    summary: `Ficha archivada ${record.clave_catastral} eliminada`,
    details: { archived_reason: record.archived_reason }
  });

  return record;
};

export const buildAviso = async (id) => {
  const record = await getById(id, { includeArchived: false });

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
