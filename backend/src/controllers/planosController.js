import {
  assignPlanoBarrio,
  createPlanoElement,
  createPlanoBarrio,
  deletePlanoElement,
  listMyPlanoAssignments,
  listPendingPlanoReviews,
  listPlanoElements,
  listPlanosBarrios,
  listPlanoVersions,
  reviewPlanoVersion,
  savePlanoDraft,
  savePlanoPdf,
  sendPlanoToReview,
  updatePlanoElement,
  updatePlanoBarrio
} from "../services/planosService.js";

export const listPlanosBarriosHandler = async (req, res, next) => {
  try {
    res.json({ barrios: await listPlanosBarrios(req.authUser) });
  } catch (error) {
    next(error);
  }
};

export const createPlanoBarrioHandler = async (req, res, next) => {
  try {
    const pdfPath = await savePlanoPdf(req.file);
    const barrio = await createPlanoBarrio(req.body ?? {}, pdfPath, req.authUser);
    res.status(201).json(barrio);
  } catch (error) {
    next(error);
  }
};

export const updatePlanoBarrioHandler = async (req, res, next) => {
  try {
    const pdfPath = await savePlanoPdf(req.file);
    res.json(await updatePlanoBarrio(req.params.id, req.body ?? {}, pdfPath, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const assignPlanoBarrioHandler = async (req, res, next) => {
  try {
    res.status(201).json(await assignPlanoBarrio(req.body ?? {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const listMyPlanoAssignmentsHandler = async (req, res, next) => {
  try {
    res.json({ barrios: await listMyPlanoAssignments(req.authUser) });
  } catch (error) {
    next(error);
  }
};

export const listPlanoElementsHandler = async (req, res, next) => {
  try {
    res.json(await listPlanoElements(req.params.barrioId, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const savePlanoDraftHandler = async (req, res, next) => {
  try {
    res.json(await savePlanoDraft(req.params.barrioId, req.body?.elements ?? [], req.authUser));
  } catch (error) {
    next(error);
  }
};

export const createPlanoElementHandler = async (req, res, next) => {
  try {
    res.status(201).json(await createPlanoElement(req.params.barrioId, req.body ?? {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const updatePlanoElementHandler = async (req, res, next) => {
  try {
    res.json(await updatePlanoElement(req.params.id, req.body ?? {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const deletePlanoElementHandler = async (req, res, next) => {
  try {
    res.json({ ok: true, element: await deletePlanoElement(req.params.id, req.authUser) });
  } catch (error) {
    next(error);
  }
};

export const sendPlanoToReviewHandler = async (req, res, next) => {
  try {
    res.json(await sendPlanoToReview(req.params.barrioId, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const listPendingPlanoReviewsHandler = async (req, res, next) => {
  try {
    res.json({ versiones: await listPendingPlanoReviews(req.authUser) });
  } catch (error) {
    next(error);
  }
};

export const reviewPlanoVersionHandler = (action) => async (req, res, next) => {
  try {
    res.json(await reviewPlanoVersion(req.params.versionId, action, req.body ?? {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const listPlanoVersionsHandler = async (req, res, next) => {
  try {
    res.json({ versiones: await listPlanoVersions(req.query?.barrioId, req.authUser) });
  } catch (error) {
    next(error);
  }
};
