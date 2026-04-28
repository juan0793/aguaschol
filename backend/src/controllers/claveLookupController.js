import {
  compareAlcaldiaWithAguas,
  exportClavePadronWorkbook,
  getAlcaldiaLookupMeta,
  generatePadronRequestReport,
  getClaveLookupMeta,
  getPadronRequestTemplates,
  reprocessClavePadron,
  searchAlcaldiaClaveCatastral,
  searchClaveCatastral,
  uploadAlcaldiaPadron,
  uploadClavePadron
} from "../services/claveLookupService.js";

export const searchClave = async (req, res, next) => {
  try {
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
    const result = await getClaveLookupMeta();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getAlcaldiaMeta = async (_req, res, next) => {
  try {
    const result = await getAlcaldiaLookupMeta();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getPadronRequestMeta = async (_req, res, next) => {
  try {
    const result = await getPadronRequestTemplates();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const runPadronRequest = async (req, res, next) => {
  try {
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
    return res.json(result);
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
    const result = await searchAlcaldiaClaveCatastral(req.query.clave ?? req.params.clave ?? "");
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const compareAlcaldia = async (_req, res, next) => {
  try {
    const result = await compareAlcaldiaWithAguas();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const reprocessPadron = async (req, res, next) => {
  try {
    const result = await reprocessClavePadron({
      actorUserId: req.authUser?.id
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const downloadPadron = async (_req, res, next) => {
  try {
    const exportResult = await exportClavePadronWorkbook();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${exportResult.fileName}"`);
    return res.send(exportResult.buffer);
  } catch (error) {
    return next(error);
  }
};
