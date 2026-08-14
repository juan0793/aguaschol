import { listFieldValidationPoints, validateFieldPoint } from "../services/fieldValidationService.js";
import { getFieldAnalytics } from "../services/fieldAnalyticsService.js";

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

export const fieldAnalyticsHandler = async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const analytics = await getFieldAnalytics(req.body ?? {});
    res.json(analytics);
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
