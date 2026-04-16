import {
  addTransportRoutePosition,
  completeTransportRoute,
  createTransportRoute,
  listTransportRoutes,
  startTransportRoute,
  updateTransportRoute
} from "../services/transportService.js";

export const listTransportRoutesHandler = async (req, res, next) => {
  try {
    const routes = await listTransportRoutes(req.authUser);
    res.json(routes);
  } catch (error) {
    next(error);
  }
};

export const createTransportRouteHandler = async (req, res, next) => {
  try {
    const route = await createTransportRoute(req.body ?? {}, req.authUser);
    res.status(201).json(route);
  } catch (error) {
    next(error);
  }
};

export const updateTransportRouteHandler = async (req, res, next) => {
  try {
    const route = await updateTransportRoute(req.params.id, req.body ?? {}, req.authUser);
    res.json(route);
  } catch (error) {
    next(error);
  }
};

export const startTransportRouteHandler = async (req, res, next) => {
  try {
    const route = await startTransportRoute(req.params.id, req.authUser);
    res.json(route);
  } catch (error) {
    next(error);
  }
};

export const completeTransportRouteHandler = async (req, res, next) => {
  try {
    const route = await completeTransportRoute(req.params.id, req.authUser);
    res.json(route);
  } catch (error) {
    next(error);
  }
};

export const addTransportRoutePositionHandler = async (req, res, next) => {
  try {
    const position = await addTransportRoutePosition(req.params.id, req.body ?? {}, req.authUser);
    res.status(201).json(position);
  } catch (error) {
    next(error);
  }
};
