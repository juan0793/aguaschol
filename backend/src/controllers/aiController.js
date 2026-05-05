import { generateRecordAssistance, isLlmConfigured } from "../services/llmService.js";

export const getAiStatus = (_req, res) => {
  res.json({
    configured: isLlmConfigured()
  });
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
