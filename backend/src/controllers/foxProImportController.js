import {
  activateFoxProBatch, applyFoxProBatch, checkR2PadronConnection, claimFoxProUpdateRequest, discardFoxProRecords, finalizeFoxProBatch,
  finishFoxProUpdateRequest, getFoxProUpdateRequest, listFoxProBatchRecords,
  getR2PadronStatus, listFoxProBatches, migrateActivePadronToR2, receiveFoxProBlock, requestFoxProUpdate,
  restoreHistoricalPadronFromR2, startFoxProBatch, verifyActiveFoxProBatch
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
export const activateBatchHandler = async (req, res, next) => {
  try { res.json({ ok: true, ...(await activateFoxProBatch(req.params.codigoLote, req.authUser)) }); } catch (error) { next(error); }
};
export const verifyBatchHandler = async (req, res, next) => {
  try { res.json({ ok: true, verification: await verifyActiveFoxProBatch(req.params.codigoLote) }); } catch (error) { next(error); }
};
export const discardRecordsHandler = async (req, res, next) => {
  try { res.json({ ok: true, ...(await discardFoxProRecords(req.params.codigoLote, req.body?.ids, req.authUser)) }); } catch (error) { next(error); }
};
export const checkR2ConnectionHandler = async (_req, res, next) => {
  try { res.json(await checkR2PadronConnection()); } catch (error) { next(error); }
};
export const getR2PadronStatusHandler = async (_req, res, next) => {
  try { res.json({ ok: true, ...(await getR2PadronStatus()) }); } catch (error) { next(error); }
};
export const migratePadronToR2Handler = async (req, res, next) => {
  try { res.json({ ok: true, ...(await migrateActivePadronToR2(req.authUser)) }); } catch (error) { next(error); }
};
export const restoreHistoricalPadronHandler = async (req, res, next) => {
  try { res.json({ ok: true, ...(await restoreHistoricalPadronFromR2(req.body, req.authUser)) }); } catch (error) { next(error); }
};
