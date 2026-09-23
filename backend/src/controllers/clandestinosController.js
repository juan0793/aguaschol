import { asignarCandidatos, descartarCandidato, enviarCandidatoAFicha, importBancoClandestinos, listadoBancoClandestinos, listBancoClandestinos, listTecnicosBanco, quitarAsignacion, restaurarCandidato, verificarBancoClandestinos } from "../services/bancoClandestinosService.js";
import { attachReportEvidence, changeFichaState, changeReportState, compareClandestinosFichas, createTechnicalReport, getClandestinosConfig, linkTechnicalReport, listClandestinosFichas, listStateHistory, listTechnicalReports, updateFichaInternalNotes } from "../services/clandestinosService.js";

export const config = async (req, res) => res.json(getClandestinosConfig(req.authUser));
export const fichas = async (req, res, next) => { try { const data = await listClandestinosFichas({ query: req.query.q, state: req.query.state, barrio: req.query.barrio, page: req.query.page, limit: req.query.limit }); if (req.authUser?.role === "validadora_campo") data.items = data.items.map(({ id, clave_catastral, abonado, barrio_colonia, estado_operativo }) => ({ id, clave_catastral, abonado, barrio_colonia, estado_operativo })); res.json(data); } catch (error) { next(error); } };
export const compareFichas = async (req, res, next) => { try { res.json(await compareClandestinosFichas(req.body?.ids)); } catch (error) { next(error); } };
export const fichaState = async (req, res, next) => { try { res.json(await changeFichaState(req.params.id, req.body || {}, req.authUser)); } catch (error) { next(error); } };
export const fichaInternalNotes = async (req, res, next) => { try { res.json(await updateFichaInternalNotes(req.params.id, req.body?.observaciones_internas, req.authUser)); } catch (error) { next(error); } };
export const history = async (req, res, next) => { try { res.json(await listStateHistory(req.params.entityType, req.params.id)); } catch (error) { next(error); } };
export const reports = async (req, res, next) => { try { res.json(await listTechnicalReports({ query: req.query.q, state: req.query.state })); } catch (error) { next(error); } };
export const createReport = async (req, res, next) => { try { res.status(201).json(await createTechnicalReport(req.body || {}, req.authUser)); } catch (error) { next(error); } };
export const reportState = async (req, res, next) => { try { res.json(await changeReportState(req.params.id, req.body || {}, req.authUser)); } catch (error) { next(error); } };
export const linkReport = async (req, res, next) => { try { res.json(await linkTechnicalReport(req.params.id, req.body?.inmueble_id, req.authUser)); } catch (error) { next(error); } };
export const evidence = async (req, res, next) => { try { res.status(201).json(await attachReportEvidence(req.params.id, req.file, req.body?.description, req.authUser)); } catch (error) { next(error); } };
// "mine" en el filtro de asignación se resuelve con la sesión, nunca con un id del cliente.
const bancoFiltros = (req) => ({ query: req.query.q, dictamen: req.query.dictamen, estado: req.query.estado ?? "pendiente", barrio: req.query.barrio, asignado: req.query.asignado === "mine" ? String(req.authUser?.id || -1) : req.query.asignado, page: req.query.page, limit: req.query.limit });
export const banco = async (req, res, next) => { try { res.json(await listBancoClandestinos(bancoFiltros(req))); } catch (error) { next(error); } };
export const bancoListado = async (req, res, next) => { try { res.json(await listadoBancoClandestinos(bancoFiltros(req))); } catch (error) { next(error); } };
export const bancoTecnicos = async (req, res, next) => { try { res.json(await listTecnicosBanco(req.authUser)); } catch (error) { next(error); } };
export const bancoAssign = async (req, res, next) => { try { res.json(await asignarCandidatos(req.body || {}, req.authUser)); } catch (error) { next(error); } };
export const bancoUnassign = async (req, res, next) => { try { res.json(await quitarAsignacion(req.body || {}, req.authUser)); } catch (error) { next(error); } };
export const bancoImport = async (req, res, next) => { try { res.status(201).json(await importBancoClandestinos(req.body || {}, req.authUser)); } catch (error) { next(error); } };
export const bancoVerify = async (req, res, next) => { try { res.json(await verificarBancoClandestinos(req.authUser)); } catch (error) { next(error); } };
export const bancoSend = async (req, res, next) => { try { res.json(await enviarCandidatoAFicha(req.params.id, req.body || {}, req.authUser)); } catch (error) { next(error); } };
export const bancoDiscard = async (req, res, next) => { try { res.json(await descartarCandidato(req.params.id, req.body || {}, req.authUser)); } catch (error) { next(error); } };
export const bancoRestore = async (req, res, next) => { try { res.json(await restaurarCandidato(req.params.id, req.authUser)); } catch (error) { next(error); } };
