import { listAuditLogs } from "../services/auditService.js";
import { createUser, deleteUser, listUsers } from "../services/userService.js";

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

export const listAuditLogsHandler = async (req, res, next) => {
  try {
    const logs = await listAuditLogs({ limit: req.query.limit ?? 100 });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};
