import { createMapPoint, deleteMapPoint, listMapPoints } from "../services/mapPointService.js";

export const listMapPointsHandler = async (_req, res, next) => {
  try {
    const points = await listMapPoints();
    res.json(points);
  } catch (error) {
    next(error);
  }
};

export const createMapPointHandler = async (req, res, next) => {
  try {
    const point = await createMapPoint(req.body ?? {}, req.authUser);
    res.status(201).json(point);
  } catch (error) {
    next(error);
  }
};

export const deleteMapPointHandler = async (req, res, next) => {
  try {
    const point = await deleteMapPoint(req.params.id, req.authUser);
    res.json({
      ok: true,
      point
    });
  } catch (error) {
    next(error);
  }
};
