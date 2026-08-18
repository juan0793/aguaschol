// Controlador HTTP del modulo Control de Entregas: solo traduce req/res a
// llamadas del servicio. Ninguna regla de negocio vive aqui.

import {
  cerrarLote,
  createLote,
  createNoEntregadas,
  createPersonal,
  deleteNoEntregada,
  getEntregasConfig,
  getLoteDetail,
  getNoEntregadaDetail,
  getResumen,
  listLotes,
  listNoEntregadas,
  listPersonal,
  registrarIntento,
  updateLote,
  updateNoEntregada,
  updatePersonal
} from "../services/entregasService.js";
import {
  anularReporte,
  generarCorreccion,
  generarReporteSemanal,
  getReporteSemanal,
  listReportesSemanales,
  previewReporteSemanal
} from "../services/entregasReportService.js";

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

export const config = handle(async (req, res) => res.json(await getEntregasConfig(req.authUser)));
export const resumen = handle(async (req, res) => res.json(await getResumen(req.query, req.authUser)));

export const personalList = handle(async (req, res) => res.json(await listPersonal(req.query, req.authUser)));
export const personalCreate = handle(async (req, res) =>
  res.status(201).json(await createPersonal(req.body || {}, req.authUser))
);
export const personalUpdate = handle(async (req, res) =>
  res.json(await updatePersonal(req.params.id, req.body || {}, req.authUser))
);

export const lotesList = handle(async (req, res) => res.json(await listLotes(req.query, req.authUser)));
export const loteDetail = handle(async (req, res) => res.json(await getLoteDetail(req.params.id, req.authUser)));
export const loteCreate = handle(async (req, res) =>
  res.status(201).json(await createLote(req.body || {}, req.authUser))
);
export const loteUpdate = handle(async (req, res) =>
  res.json(await updateLote(req.params.id, req.body || {}, req.authUser))
);
export const loteCerrar = handle(async (req, res) =>
  res.json(await cerrarLote(req.params.id, req.body || {}, req.authUser))
);
export const loteNoEntregadasCreate = handle(async (req, res) =>
  res.status(201).json(await createNoEntregadas(req.params.id, req.body || {}, req.authUser))
);

export const noEntregadasList = handle(async (req, res) => res.json(await listNoEntregadas(req.query, req.authUser)));
export const noEntregadaDetail = handle(async (req, res) =>
  res.json(await getNoEntregadaDetail(req.params.id, req.authUser))
);
export const noEntregadaUpdate = handle(async (req, res) =>
  res.json(await updateNoEntregada(req.params.id, req.body || {}, req.authUser))
);
export const noEntregadaRemove = handle(async (req, res) =>
  res.json(await deleteNoEntregada(req.params.id, req.authUser))
);
export const intentoCreate = handle(async (req, res) =>
  res.status(201).json(await registrarIntento(req.params.id, req.body || {}, req.authUser))
);

export const reportesList = handle(async (req, res) => res.json(await listReportesSemanales(req.query)));
export const reportePreview = handle(async (req, res) => res.json(await previewReporteSemanal(req.query, req.authUser)));
export const reporteDetail = handle(async (req, res) => res.json(await getReporteSemanal(req.params.id, req.authUser)));
export const reporteCreate = handle(async (req, res) =>
  res.status(201).json(await generarReporteSemanal(req.body || {}, req.authUser))
);
export const reporteCorreccion = handle(async (req, res) =>
  res.status(201).json(await generarCorreccion(req.params.id, req.body || {}, req.authUser))
);
export const reporteAnular = handle(async (req, res) =>
  res.json(await anularReporte(req.params.id, req.body || {}, req.authUser))
);
