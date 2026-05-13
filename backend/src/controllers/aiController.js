import { generateRecordAssistance, getLlmStatus } from "../services/llmService.js";

export const getAiStatus = (_req, res) => {
  res.json(getLlmStatus());
};

export const assistRecord = async (req, res, next) => {
  try {
    const result = await generateRecordAssistance({
      action: req.body?.action,
      record: req.body?.record
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};
