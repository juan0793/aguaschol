import { listFieldValidationPoints, validateFieldPoint } from "../services/fieldValidationService.js";

export const listFieldValidationPointsHandler = async (req, res, next) => {
  try {
    const points = await listFieldValidationPoints({
      date: req.query?.date,
      status: req.query?.status
    });
    res.json(points);
  } catch (error) {
    next(error);
  }
};

export const validateFieldPointHandler = async (req, res, next) => {
  try {
    const point = await validateFieldPoint(req.params.id, req.body ?? {}, req.authUser);
    res.json(point);
  } catch (error) {
    next(error);
  }
};
