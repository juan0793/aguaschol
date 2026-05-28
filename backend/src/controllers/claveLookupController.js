import {
  compareAlcaldiaWithAguas,
  exportClavePadronWorkbook,
  getAguasServiceReport,
  getAlcaldiaLookupMeta,
  generatePadronRequestReport,
  getClaveLookupMeta,
  getPadronRequestTemplates,
  reprocessClavePadron,
  searchAlcaldiaClaveCatastral,
  searchClaveCatastral,
  uploadAlcaldiaPadron,
  uploadClavePadron,
  verifyClavePadronIntegrity
} from "../services/claveLookupService.js";

const noStore = (res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
};

const attachPadronVerification = async (result) => {
  const verification = await verifyClavePadronIntegrity();

  return {
    ...result,
    cache: {
      cleared: true,
      refreshed_at: new Date().toISOString()
    },
    verification
  };
};

export const searchClave = async (req, res, next) => {
  try {
    // Evitar caché HTTP en el navegador para asegurar datos frescos
    noStore(res);
    
    const result = await searchClaveCatastral(req.query.clave ?? req.params.clave ?? "", {
      field: req.query.field ?? "clave"
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPadronMeta = async (_req, res, next) => {
  try {
    noStore(res);
    const result = await getClaveLookupMeta();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getAlcaldiaMeta = async (_req, res, next) => {
  try {
    noStore(res);
    const result = await getAlcaldiaLookupMeta();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPadronRequestMeta = async (_req, res, next) => {
  try {
    noStore(res);
    const result = await getPadronRequestTemplates();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPadronServiceReport = async (_req, res, next) => {
  try {
    noStore(res);
    const result = await getAguasServiceReport();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const runPadronRequest = async (req, res, next) => {
  try {
    noStore(res);
    const result = await generatePadronRequestReport(req.body ?? {});
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const uploadPadron = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debes seleccionar un archivo Excel del padron." });
    }

    const result = await uploadClavePadron(
      {
        buffer: req.file.buffer,
        originalName: req.file.originalname
      },
      {
        actorUserId: req.authUser?.id
      }
    );
    return res.json(await attachPadronVerification(result));
  } catch (error) {
    return next(error);
  }
};

export const uploadAlcaldia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debes seleccionar un archivo Excel del padron de alcaldia." });
    }

    const result = await uploadAlcaldiaPadron(
      {
        buffer: req.file.buffer,
        originalName: req.file.originalname
      },
      {
        actorUserId: req.authUser?.id
      }
    );
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const searchAlcaldia = async (req, res, next) => {
  try {
    // Evitar caché HTTP en el navegador para asegurar datos frescos
    noStore(res);
    
    const result = await searchAlcaldiaClaveCatastral(req.query.clave ?? req.params.clave ?? req.query.q ?? "", {
      field: req.query.field ?? "clave"
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const compareAlcaldia = async (_req, res, next) => {
  try {
    noStore(res);
    const result = await compareAlcaldiaWithAguas();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const reprocessPadron = async (req, res, next) => {
  try {
    noStore(res);
    const result = await reprocessClavePadron({
      actorUserId: req.authUser?.id
    });
    return res.json(await attachPadronVerification(result));
  } catch (error) {
    return next(error);
  }
};

export const syncPadron = async (req, res, next) => {
  try {
    noStore(res);
    const result = await reprocessClavePadron({
      actorUserId: req.authUser?.id
    });
    return res.json(await attachPadronVerification(result));
  } catch (error) {
    return next(error);
  }
};

export const downloadPadron = async (_req, res, next) => {
  try {
    const exportResult = await exportClavePadronWorkbook();
    res.setHeader("Content-Type", exportResult.contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${exportResult.fileName}"`);
    return res.send(exportResult.buffer);
  } catch (error) {
    return next(error);
  }
};
