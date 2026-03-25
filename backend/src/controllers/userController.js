import { exportAuditLogsCsv, listAuditLogs } from "../services/auditService.js";
import { createUser, deleteUser, listUsers, resetUserPassword } from "../services/userService.js";

export const listUsersHandler = async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const createUserHandler = async (req, res, next) => {
  try {
    const result = await createUser(req.body ?? {}, req.authUser);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteUserHandler = async (req, res, next) => {
  try {
    const user = await deleteUser(req.params.id, req.authUser);
    res.json({
      ok: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

export const resetUserPasswordHandler = async (req, res, next) => {
  try {
    const result = await resetUserPassword(req.params.id, req.authUser);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const listAuditLogsHandler = async (req, res, next) => {
  try {
    const logs = await listAuditLogs({
      limit: req.query.limit ?? 100,
      action: req.query.action ?? "",
      entityType: req.query.entity_type ?? "",
      actor: req.query.actor ?? "",
      search: req.query.search ?? "",
      dateFrom: req.query.date_from ?? "",
      dateTo: req.query.date_to ?? ""
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

export const exportAuditLogsHandler = async (req, res, next) => {
  try {
    const csv = await exportAuditLogsCsv({
      limit: req.query.limit ?? 500,
      action: req.query.action ?? "",
      entityType: req.query.entity_type ?? "",
      actor: req.query.actor ?? "",
      search: req.query.search ?? "",
      dateFrom: req.query.date_from ?? "",
      dateTo: req.query.date_to ?? ""
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="bitacora-auditoria.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
