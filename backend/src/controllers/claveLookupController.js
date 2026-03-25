import { searchClaveCatastral } from "../services/claveLookupService.js";

export const searchClave = async (req, res, next) => {
  try {
    const result = await searchClaveCatastral(req.query.clave ?? req.params.clave ?? "");
    res.json(result);
  } catch (error) {
    next(error);
  }
};

