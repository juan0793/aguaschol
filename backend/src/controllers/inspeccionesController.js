import {
  addGps,
  addParticipante,
  changeEstado,
  createInspeccion,
  finalizarInspeccion,
  getBitacora,
  getInspeccionDetail,
  getInspeccionesConfig,
  getResumenInspecciones,
  listGps,
  listInspecciones,
  listParticipantesHandler,
  listTecnicosElegibles,
  reasignarInspeccion,
  removeParticipante,
  updateInspeccion
} from "../services/inspeccionesService.js";
import { getInspeccionesStats } from "../services/inspeccionesStatsService.js";
import {
  attachPrintStatus,
  getPrintData,
  getPrintStatusForOne,
  listPrintHistory,
  registerPrintEvent
} from "../services/inspeccionesPrintService.js";

export const config = async (req, res) => res.json(getInspeccionesConfig(req.authUser));

export const tecnicos = async (req, res, next) => {
  try {
    res.json(await listTecnicosElegibles());
  } catch (error) {
    next(error);
  }
};

export const resumen = async (req, res, next) => {
  try {
    res.json(await getResumenInspecciones(req.authUser));
  } catch (error) {
    next(error);
  }
};

export const stats = async (req, res, next) => {
  try {
    res.json(await getInspeccionesStats(req.query, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const data = await listInspecciones(req.query, req.authUser);
    data.items = await attachPrintStatus(data.items);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const detail = async (req, res, next) => {
  try {
    const inspeccion = await getInspeccionDetail(req.params.id, req.authUser);
    inspeccion.print_status = await getPrintStatusForOne(req.params.id);
    res.json(inspeccion);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    res.status(201).json(await createInspeccion(req.body || {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    res.json(await updateInspeccion(req.params.id, req.body || {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const estado = async (req, res, next) => {
  try {
    res.json(await changeEstado(req.params.id, req.body || {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const finalizar = async (req, res, next) => {
  try {
    res.json(await finalizarInspeccion(req.params.id, req.body || {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const reasignar = async (req, res, next) => {
  try {
    res.json(await reasignarInspeccion(req.params.id, req.body || {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const tecnicosDeInspeccion = async (req, res, next) => {
  try {
    res.json(await listParticipantesHandler(req.params.id, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const addTecnico = async (req, res, next) => {
  try {
    res.status(201).json(await addParticipante(req.params.id, req.body || {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const removeTecnico = async (req, res, next) => {
  try {
    res.json(await removeParticipante(req.params.id, req.params.tecnicoId, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const gps = async (req, res, next) => {
  try {
    res.json(await listGps(req.params.id, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const createGps = async (req, res, next) => {
  try {
    res.status(201).json(await addGps(req.params.id, req.body || {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const historial = async (req, res, next) => {
  try {
    res.json(await getBitacora(req.params.id, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const printData = async (req, res, next) => {
  try {
    res.json(await getPrintData(req.params.id, req.query.tipo, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const printEvent = async (req, res, next) => {
  try {
    res.status(201).json(await registerPrintEvent(req.params.id, req.body || {}, req.authUser));
  } catch (error) {
    next(error);
  }
};

export const printHistory = async (req, res, next) => {
  try {
    res.json(await listPrintHistory(req.params.id, req.authUser));
  } catch (error) {
    next(error);
  }
};
