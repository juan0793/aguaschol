import {
  applyFoxProBatch, claimFoxProUpdateRequest, discardFoxProRecords, finalizeFoxProBatch,
  finishFoxProUpdateRequest, getFoxProUpdateRequest, listFoxProBatchRecords,
  listFoxProBatches, receiveFoxProBlock, requestFoxProUpdate, startFoxProBatch
} from "../services/foxProImportService.js";

export const requestUpdateHandler = async (req, res, next) => {
  try { res.status(201).json({ ok: true, request: await requestFoxProUpdate(req.authUser) }); } catch (error) { next(error); }
};
export const getUpdateRequestHandler = async (req, res, next) => {
  try { res.json({ ok: true, request: await getFoxProUpdateRequest(req.params.id) }); } catch (error) { next(error); }
};
export const claimUpdateRequestHandler = async (_req, res, next) => {
  try {
    const request = await claimFoxProUpdateRequest();
    if (!request) return res.status(204).end();
    return res.json({ ok: true, request });
  } catch (error) { return next(error); }
};
export const finishUpdateRequestHandler = async (req, res, next) => {
  try { res.json({ ok: true, request: await finishFoxProUpdateRequest(req.params.id, req.body) }); } catch (error) { next(error); }
};

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
