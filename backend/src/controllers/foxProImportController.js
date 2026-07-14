import {
  applyFoxProBatch, discardFoxProRecords, finalizeFoxProBatch, listFoxProBatchRecords,
  listFoxProBatches, receiveFoxProBlock, startFoxProBatch
} from "../services/foxProImportService.js";

export const startBatchHandler = async (req, res, next) => {
  try { res.status(201).json({ ok: true, lot: await startFoxProBatch(req.body) }); } catch (error) { next(error); }
};
export const receiveBlockHandler = async (req, res, next) => {
  try { res.json({ ok: true, block: await receiveFoxProBlock(req.params.codigoLote, req.body) }); } catch (error) { next(error); }
};
export const finalizeBatchHandler = async (req, res, next) => {
  try { res.json({ ok: true, lot: await finalizeFoxProBatch(req.params.codigoLote) }); } catch (error) { next(error); }
};
export const listBatchesHandler = async (req, res, next) => {
  try { res.json({ ok: true, ...(await listFoxProBatches(req.query)) }); } catch (error) { next(error); }
};
export const listBatchRecordsHandler = async (req, res, next) => {
  try { res.json({ ok: true, ...(await listFoxProBatchRecords(req.params.codigoLote, req.query)) }); } catch (error) { next(error); }
};
export const applyBatchHandler = async (req, res, next) => {
  try { res.json({ ok: true, ...(await applyFoxProBatch(req.params.codigoLote, req.body, req.authUser)) }); } catch (error) { next(error); }
};
export const discardRecordsHandler = async (req, res, next) => {
  try { res.json({ ok: true, ...(await discardFoxProRecords(req.params.codigoLote, req.body?.ids, req.authUser)) }); } catch (error) { next(error); }
};
