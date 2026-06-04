import {
  deleteBarrioCode,
  getBarrioByClave,
  listBarrioCodes,
  saveBarrioCode
} from "../services/barrioCodeService.js";

export const listBarrioCodesHandler = async (_req, res, next) => {
  try {
    res.json({ barrios: await listBarrioCodes() });
  } catch (error) {
    next(error);
  }
};

export const lookupBarrioByClaveHandler = async (req, res, next) => {
  try {
    const match = await getBarrioByClave(req.query.clave ?? req.params.clave ?? "");
    res.json({ exists: Boolean(match), match });
  } catch (error) {
    next(error);
  }
};

export const saveBarrioCodeHandler = async (req, res, next) => {
  try {
    const item = await saveBarrioCode(req.body ?? {}, {
      actorUserId: req.authUser?.id
    });
    res.json({ item, barrios: await listBarrioCodes() });
  } catch (error) {
    next(error);
  }
};

export const deleteBarrioCodeHandler = async (req, res, next) => {
  try {
    const result = await deleteBarrioCode(req.params.codigo, {
      actorUserId: req.authUser?.id
    });
    res.json({ ...result, barrios: await listBarrioCodes() });
  } catch (error) {
    next(error);
  }
};
