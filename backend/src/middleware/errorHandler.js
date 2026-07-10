export const errorHandler = (error, _req, res, _next) => {
  const status = error.status ?? (error.code === "LIMIT_FILE_SIZE" ? 413 : error.name === "MulterError" ? 400 : 500);
  res.status(status).json({
    message: error.message ?? "Error interno del servidor."
  });
};
