import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { createAuditLog } from "./auditService.js";
import { broadcastTransportEvent } from "./transportRealtimeService.js";

const memoryRoutes = [];
const memoryPositions = [];
const DEFAULT_ALLOWED_DEVIATION_METERS = 35;

const toNumberOrNull = (value) => {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizePathPoint = (point = {}) => {
  const latitude = Number(point.latitude ?? point.lat);
  const longitude = Number(point.longitude ?? point.lng ?? point.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }

  return {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7))
  };
};

const normalizeRoutePath = (value) => {
  const source = Array.isArray(value) ? value : [];
  return source.map(normalizePathPoint).filter(Boolean);
};

const parseRoutePath = (value) => {
  if (Array.isArray(value)) {
    return normalizeRoutePath(value);
  }

  if (!value) {
    return [];
  }

  try {
    return normalizeRoutePath(JSON.parse(value));
  } catch {
    return [];
  }
};

const ensureRoutePath = (routePath) => {
  const normalized = normalizeRoutePath(routePath);

  if (normalized.length < 2) {
    const error = new Error("Debes trazar al menos dos puntos para definir la calle.");
    error.status = 400;
    throw error;
  }

  return normalized;
};

const normalizeRoutePayload = (payload = {}) => {
  const name = String(payload.name ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const allowedDeviationMeters = Number(payload.allowed_deviation_meters ?? DEFAULT_ALLOWED_DEVIATION_METERS);
  const assignedUserId = payload.assigned_user_id == null || payload.assigned_user_id === ""
    ? null
    : Number(payload.assigned_user_id);
  const routePath = ensureRoutePath(payload.route_path ?? payload.route_path_json ?? []);

  if (!name) {
    const error = new Error("Debes ingresar un nombre para la ruta.");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(allowedDeviationMeters) || allowedDeviationMeters < 5 || allowedDeviationMeters > 250) {
    const error = new Error("La tolerancia de desvio debe estar entre 5 y 250 metros.");
    error.status = 400;
    throw error;
  }

  if (assignedUserId != null && (!Number.isInteger(assignedUserId) || assignedUserId <= 0)) {
    const error = new Error("El transportista asignado no es valido.");
    error.status = 400;
    throw error;
  }

  return {
    name,
    description,
    assigned_user_id: assignedUserId,
    allowed_deviation_meters: Number(allowedDeviationMeters.toFixed(2)),
    route_path: routePath
  };
};

const normalizePositionPayload = (payload = {}) => {
  const point = normalizePathPoint(payload);

  if (!point) {
    const error = new Error("Debes proporcionar una ubicacion valida del vehiculo.");
    error.status = 400;
    throw error;
  }

  return {
    ...point,
    accuracy_meters: toNumberOrNull(payload.accuracy_meters)
  };
};

const degreesToRadians = (value) => (value * Math.PI) / 180;

const toProjectedMeters = (point, referenceLatitude) => {
  const latRad = degreesToRadians(referenceLatitude);
  const x = degreesToRadians(point.longitude) * 6371000 * Math.cos(latRad);
  const y = degreesToRadians(point.latitude) * 6371000;
  return { x, y };
};

const distanceBetween = (left, right) => {
  const leftProjected = toProjectedMeters(left, (left.latitude + right.latitude) / 2);
  const rightProjected = toProjectedMeters(right, (left.latitude + right.latitude) / 2);
  return Math.hypot(rightProjected.x - leftProjected.x, rightProjected.y - leftProjected.y);
};

const distanceToSegment = (point, start, end) => {
  const referenceLatitude = (point.latitude + start.latitude + end.latitude) / 3;
  const projectedPoint = toProjectedMeters(point, referenceLatitude);
  const projectedStart = toProjectedMeters(start, referenceLatitude);
  const projectedEnd = toProjectedMeters(end, referenceLatitude);
  const segmentX = projectedEnd.x - projectedStart.x;
  const segmentY = projectedEnd.y - projectedStart.y;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;

  if (segmentLengthSquared === 0) {
    return Math.hypot(projectedPoint.x - projectedStart.x, projectedPoint.y - projectedStart.y);
  }

  const projection = (
    ((projectedPoint.x - projectedStart.x) * segmentX) +
    ((projectedPoint.y - projectedStart.y) * segmentY)
  ) / segmentLengthSquared;
  const clamped = Math.max(0, Math.min(1, projection));
  const closestX = projectedStart.x + (segmentX * clamped);
  const closestY = projectedStart.y + (segmentY * clamped);

  return Math.hypot(projectedPoint.x - closestX, projectedPoint.y - closestY);
};

const computeDeviationMeta = (routePath, point, allowedDeviationMeters) => {
  if (!routePath.length) {
    return {
      deviation_meters: null,
      is_on_route: true
    };
  }

  let minDistance = Infinity;

  for (let index = 0; index < routePath.length - 1; index += 1) {
    const candidate = distanceToSegment(point, routePath[index], routePath[index + 1]);
    if (candidate < minDistance) {
      minDistance = candidate;
    }
  }

  if (!Number.isFinite(minDistance) && routePath[0]) {
    minDistance = distanceBetween(point, routePath[0]);
  }

  const deviation = Number.isFinite(minDistance) ? Number(minDistance.toFixed(2)) : null;

  return {
    deviation_meters: deviation,
    is_on_route: deviation == null ? true : deviation <= allowedDeviationMeters
  };
};

const sanitizePosition = (position) => ({
  id: position.id,
  route_id: Number(position.route_id),
  latitude: Number(position.latitude),
  longitude: Number(position.longitude),
  accuracy_meters: toNumberOrNull(position.accuracy_meters),
  deviation_meters: toNumberOrNull(position.deviation_meters),
  is_on_route: Boolean(position.is_on_route),
  captured_at: position.captured_at,
  created_by: position.created_by ?? null,
  created_by_name: position.created_by_name ?? ""
});

const sanitizeRouteRow = (route) => ({
  id: route.id,
  name: route.name,
  description: route.description ?? "",
  status: route.status,
  assigned_user_id: route.assigned_user_id == null ? null : Number(route.assigned_user_id),
  assigned_user_name: route.assigned_user_name ?? "",
  created_by: route.created_by == null ? null : Number(route.created_by),
  created_by_name: route.created_by_name ?? "",
  allowed_deviation_meters: Number(route.allowed_deviation_meters ?? DEFAULT_ALLOWED_DEVIATION_METERS),
  route_path: parseRoutePath(route.route_path_json),
  started_at: route.started_at,
  completed_at: route.completed_at,
  created_at: route.created_at,
  updated_at: route.updated_at
});

const attachPositionsToRoutes = (routes, positions) => {
  const positionsByRoute = positions.reduce((accumulator, position) => {
    const current = accumulator.get(Number(position.route_id)) ?? [];
    current.push(sanitizePosition(position));
    accumulator.set(Number(position.route_id), current);
    return accumulator;
  }, new Map());

  return routes.map((route) => {
    const trackedPath = (positionsByRoute.get(Number(route.id)) ?? []).sort(
      (left, right) => new Date(left.captured_at) - new Date(right.captured_at)
    );
    const latestPosition = trackedPath[trackedPath.length - 1] ?? null;
    const offRouteCount = trackedPath.filter((position) => !position.is_on_route).length;

    return {
      ...route,
      tracked_path: trackedPath,
      latest_position: latestPosition,
      off_route_count: offRouteCount,
      is_off_route: Boolean(latestPosition && !latestPosition.is_on_route)
    };
  });
};

const getMemoryRoutesForUser = (authUser) => {
  if (authUser?.role === "admin") {
    return [...memoryRoutes];
  }

  return memoryRoutes.filter(
    (route) => Number(route.assigned_user_id) === Number(authUser?.id)
  );
};

const getRouteOrFail = async (routeId) => {
  const targetId = Number(routeId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    const error = new Error("La ruta de transporte no es valida.");
    error.status = 400;
    throw error;
  }

  if (env.useMemoryDb) {
    const route = memoryRoutes.find((item) => Number(item.id) === targetId);
    if (!route) {
      const error = new Error("Ruta de transporte no encontrada.");
      error.status = 404;
      throw error;
    }

    return route;
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT
        transport_routes.*,
        assigned_user.full_name AS assigned_user_name,
        creator.full_name AS created_by_name
      FROM transport_routes
      LEFT JOIN app_users AS assigned_user ON assigned_user.id = transport_routes.assigned_user_id
      LEFT JOIN app_users AS creator ON creator.id = transport_routes.created_by
      WHERE transport_routes.id = ?
      LIMIT 1
    `,
    [targetId]
  );

  if (!rows.length) {
    const error = new Error("Ruta de transporte no encontrada.");
    error.status = 404;
    throw error;
  }

  return sanitizeRouteRow(rows[0]);
};

const assertRouteAccess = (route, authUser) => {
  const isAdmin = authUser?.role === "admin";
  const isAssignedTransport = Number(route.assigned_user_id) === Number(authUser?.id);

  if (isAdmin || isAssignedTransport) {
    return;
  }

  const error = new Error("No tienes acceso a esta ruta de transporte.");
  error.status = 403;
  throw error;
};

const loadPositionsForRouteIds = async (routeIds) => {
  if (!routeIds.length) {
    return [];
  }

  if (env.useMemoryDb) {
    return memoryPositions.filter((position) => routeIds.includes(Number(position.route_id)));
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT
        transport_route_positions.*,
        app_users.full_name AS created_by_name
      FROM transport_route_positions
      LEFT JOIN app_users ON app_users.id = transport_route_positions.created_by
      WHERE transport_route_positions.route_id IN (?)
      ORDER BY transport_route_positions.captured_at ASC
    `,
    [routeIds]
  );

  return rows;
};

const ensureAssignedTransportUser = async (assignedUserId) => {
  if (assignedUserId == null) {
    return null;
  }

  if (env.useMemoryDb) {
    return assignedUserId;
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT id, role
      FROM app_users
      WHERE id = ?
      LIMIT 1
    `,
    [assignedUserId]
  );

  if (!rows.length || rows[0].role !== "transport") {
    const error = new Error("La ruta solo puede asignarse a un usuario con rol transporte.");
    error.status = 400;
    throw error;
  }

  return assignedUserId;
};

const buildRouteSnapshot = async (routeId) => {
  const route = sanitizeRouteRow(await getRouteOrFail(routeId));
  const positions = await loadPositionsForRouteIds([Number(routeId)]);
  return attachPositionsToRoutes([route], positions)[0] ?? route;
};

export const listTransportRoutes = async (authUser) => {
  if (env.useMemoryDb) {
    const routes = getMemoryRoutesForUser(authUser).map((route) => sanitizeRouteRow(route));
    const positions = await loadPositionsForRouteIds(routes.map((route) => Number(route.id)));
    return attachPositionsToRoutes(routes, positions);
  }

  const pool = getPool();
  const isAdmin = authUser?.role === "admin";
  const whereClause = isAdmin ? "" : "WHERE transport_routes.assigned_user_id = ?";
  const params = isAdmin ? [] : [authUser?.id ?? 0];
  const [rows] = await pool.query(
    `
      SELECT
        transport_routes.*,
        assigned_user.full_name AS assigned_user_name,
        creator.full_name AS created_by_name
      FROM transport_routes
      LEFT JOIN app_users AS assigned_user ON assigned_user.id = transport_routes.assigned_user_id
      LEFT JOIN app_users AS creator ON creator.id = transport_routes.created_by
      ${whereClause}
      ORDER BY
        FIELD(transport_routes.status, 'active', 'draft', 'completed'),
        transport_routes.updated_at DESC
    `,
    params
  );

  const routes = rows.map(sanitizeRouteRow);
  const positions = await loadPositionsForRouteIds(routes.map((route) => Number(route.id)));
  return attachPositionsToRoutes(routes, positions);
};

export const createTransportRoute = async (payload, authUser) => {
  const data = normalizeRoutePayload(payload);
  await ensureAssignedTransportUser(data.assigned_user_id);

  if (env.useMemoryDb) {
    const route = {
      id: memoryRoutes.length + 1,
      ...data,
      route_path_json: JSON.stringify(data.route_path),
      status: "draft",
      started_at: null,
      completed_at: null,
      created_by: authUser?.id ?? null,
      created_by_name: authUser?.full_name ?? authUser?.username ?? "",
      assigned_user_name: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryRoutes.unshift(route);
    const snapshot = await buildRouteSnapshot(route.id);
    broadcastTransportEvent({ type: "transport.route_created", route: snapshot });
    return snapshot;
  }

  const pool = getPool();
  const [result] = await pool.query(
    `
      INSERT INTO transport_routes (
        name, description, status, assigned_user_id, route_path_json, allowed_deviation_meters, created_by
      )
      VALUES (?, ?, 'draft', ?, ?, ?, ?)
    `,
    [
      data.name,
      data.description,
      data.assigned_user_id,
      JSON.stringify(data.route_path),
      data.allowed_deviation_meters,
      authUser?.id ?? null
    ]
  );

  const route = await getRouteOrFail(result.insertId);
  await createAuditLog({
    actorUserId: authUser?.id ?? null,
    actorName: authUser?.full_name ?? authUser?.username ?? "",
    actorEmail: authUser?.email ?? "",
    action: "transport.route_created",
    entityType: "transport_route",
    entityId: route.id,
    summary: `Ruta ${route.name} creada para transporte`,
    details: {
      assigned_user_id: route.assigned_user_id,
      allowed_deviation_meters: route.allowed_deviation_meters,
      total_route_points: route.route_path.length
    }
  });

  const snapshot = await buildRouteSnapshot(route.id);
  broadcastTransportEvent({ type: "transport.route_created", route: snapshot });
  return snapshot;
};

export const updateTransportRoute = async (routeId, payload, authUser) => {
  const current = await getRouteOrFail(routeId);
  const data = normalizeRoutePayload(payload);
  await ensureAssignedTransportUser(data.assigned_user_id);

  if (env.useMemoryDb) {
    const index = memoryRoutes.findIndex((route) => Number(route.id) === Number(routeId));
    memoryRoutes[index] = {
      ...memoryRoutes[index],
      ...data,
      route_path_json: JSON.stringify(data.route_path),
      updated_at: new Date().toISOString()
    };
    const snapshot = await buildRouteSnapshot(routeId);
    broadcastTransportEvent({ type: "transport.route_updated", route: snapshot });
    return snapshot;
  }

  const pool = getPool();
  await pool.query(
    `
      UPDATE transport_routes
      SET
        name = ?,
        description = ?,
        assigned_user_id = ?,
        route_path_json = ?,
        allowed_deviation_meters = ?
      WHERE id = ?
    `,
    [
      data.name,
      data.description,
      data.assigned_user_id,
      JSON.stringify(data.route_path),
      data.allowed_deviation_meters,
      routeId
    ]
  );

  const updated = await getRouteOrFail(routeId);
  await createAuditLog({
    actorUserId: authUser?.id ?? null,
    actorName: authUser?.full_name ?? authUser?.username ?? "",
    actorEmail: authUser?.email ?? "",
    action: "transport.route_updated",
    entityType: "transport_route",
    entityId: updated.id,
    summary: `Ruta ${updated.name} actualizada`,
    details: {
      previous: {
        assigned_user_id: current.assigned_user_id,
        allowed_deviation_meters: current.allowed_deviation_meters,
        total_route_points: current.route_path.length
      },
      next: {
        assigned_user_id: updated.assigned_user_id,
        allowed_deviation_meters: updated.allowed_deviation_meters,
        total_route_points: updated.route_path.length
      }
    }
  });

  const snapshot = await buildRouteSnapshot(updated.id);
  broadcastTransportEvent({ type: "transport.route_updated", route: snapshot });
  return snapshot;
};

export const startTransportRoute = async (routeId, authUser) => {
  const route = await getRouteOrFail(routeId);
  assertRouteAccess(route, authUser);

  const assignedUserId =
    route.assigned_user_id ?? (authUser?.role === "transport" ? authUser.id : route.assigned_user_id);

  if (env.useMemoryDb) {
    const index = memoryRoutes.findIndex((item) => Number(item.id) === Number(routeId));
    memoryRoutes[index] = {
      ...memoryRoutes[index],
      assigned_user_id: assignedUserId,
      status: "active",
      started_at: memoryRoutes[index].started_at || new Date().toISOString(),
      completed_at: null,
      updated_at: new Date().toISOString()
    };
    const snapshot = await buildRouteSnapshot(routeId);
    broadcastTransportEvent({ type: "transport.route_started", route: snapshot });
    return snapshot;
  }

  const pool = getPool();
  await pool.query(
    `
      UPDATE transport_routes
      SET
        status = 'active',
        assigned_user_id = COALESCE(assigned_user_id, ?),
        started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
        completed_at = NULL
      WHERE id = ?
    `,
    [assignedUserId, routeId]
  );

  const updated = await getRouteOrFail(routeId);
  await createAuditLog({
    actorUserId: authUser?.id ?? null,
    actorName: authUser?.full_name ?? authUser?.username ?? "",
    actorEmail: authUser?.email ?? "",
    action: "transport.route_started",
    entityType: "transport_route",
    entityId: updated.id,
    summary: `Ruta ${updated.name} iniciada`,
    details: {
      assigned_user_id: updated.assigned_user_id
    }
  });

  const snapshot = await buildRouteSnapshot(updated.id);
  broadcastTransportEvent({ type: "transport.route_started", route: snapshot });
  return snapshot;
};

export const completeTransportRoute = async (routeId, authUser) => {
  const route = await getRouteOrFail(routeId);
  assertRouteAccess(route, authUser);

  if (env.useMemoryDb) {
    const index = memoryRoutes.findIndex((item) => Number(item.id) === Number(routeId));
    memoryRoutes[index] = {
      ...memoryRoutes[index],
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const snapshot = await buildRouteSnapshot(routeId);
    broadcastTransportEvent({ type: "transport.route_completed", route: snapshot });
    return snapshot;
  }

  const pool = getPool();
  await pool.query(
    `
      UPDATE transport_routes
      SET
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [routeId]
  );

  const updated = await getRouteOrFail(routeId);
  await createAuditLog({
    actorUserId: authUser?.id ?? null,
    actorName: authUser?.full_name ?? authUser?.username ?? "",
    actorEmail: authUser?.email ?? "",
    action: "transport.route_completed",
    entityType: "transport_route",
    entityId: updated.id,
    summary: `Ruta ${updated.name} completada`
  });

  const snapshot = await buildRouteSnapshot(updated.id);
  broadcastTransportEvent({ type: "transport.route_completed", route: snapshot });
  return snapshot;
};

export const addTransportRoutePosition = async (routeId, payload, authUser) => {
  const route = await getRouteOrFail(routeId);
  assertRouteAccess(route, authUser);

  const point = normalizePositionPayload(payload);
  const deviationMeta = computeDeviationMeta(route.route_path, point, Number(route.allowed_deviation_meters));

  if (env.useMemoryDb) {
    const position = {
      id: memoryPositions.length + 1,
      route_id: Number(routeId),
      ...point,
      ...deviationMeta,
      created_by: authUser?.id ?? null,
      created_by_name: authUser?.full_name ?? authUser?.username ?? "",
      captured_at: new Date().toISOString()
    };
    memoryPositions.push(position);

    const routeIndex = memoryRoutes.findIndex((item) => Number(item.id) === Number(routeId));
    if (routeIndex >= 0 && memoryRoutes[routeIndex].status === "draft") {
      memoryRoutes[routeIndex].status = "active";
      memoryRoutes[routeIndex].started_at = memoryRoutes[routeIndex].started_at || new Date().toISOString();
      memoryRoutes[routeIndex].updated_at = new Date().toISOString();
    }

    const routeSnapshot = await buildRouteSnapshot(routeId);
    const sanitizedPosition = sanitizePosition(position);
    broadcastTransportEvent({
      type: sanitizedPosition.is_on_route ? "transport.position_logged" : "transport.route_alert",
      route: routeSnapshot,
      position: sanitizedPosition
    });
    return sanitizedPosition;
  }

  const pool = getPool();
  await pool.query(
    `
      UPDATE transport_routes
      SET
        status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
        assigned_user_id = COALESCE(assigned_user_id, ?),
        started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
      WHERE id = ?
    `,
    [authUser?.role === "transport" ? authUser.id : route.assigned_user_id, routeId]
  );
  const [result] = await pool.query(
    `
      INSERT INTO transport_route_positions (
        route_id, latitude, longitude, accuracy_meters, deviation_meters, is_on_route, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      routeId,
      point.latitude,
      point.longitude,
      point.accuracy_meters,
      deviationMeta.deviation_meters,
      deviationMeta.is_on_route ? 1 : 0,
      authUser?.id ?? null
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT
        transport_route_positions.*,
        app_users.full_name AS created_by_name
      FROM transport_route_positions
      LEFT JOIN app_users ON app_users.id = transport_route_positions.created_by
      WHERE transport_route_positions.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  const position = sanitizePosition(rows[0]);
  await createAuditLog({
    actorUserId: authUser?.id ?? null,
    actorName: authUser?.full_name ?? authUser?.username ?? "",
    actorEmail: authUser?.email ?? "",
    action: deviationMeta.is_on_route ? "transport.position_logged" : "transport.route_alert",
    entityType: "transport_route",
    entityId: routeId,
    summary: deviationMeta.is_on_route
      ? `Ubicacion registrada en ${route.name}`
      : `Desvio detectado en ${route.name}`,
    details: {
      latitude: position.latitude,
      longitude: position.longitude,
      deviation_meters: position.deviation_meters,
      is_on_route: position.is_on_route
    }
  });

  const routeSnapshot = await buildRouteSnapshot(routeId);
  broadcastTransportEvent({
    type: position.is_on_route ? "transport.position_logged" : "transport.route_alert",
    route: routeSnapshot,
    position
  });
  return position;
};
