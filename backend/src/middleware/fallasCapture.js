import { debeRegistrar } from "../services/fallasRules.js";
import { registrarFallaServidor } from "../services/fallasService.js";

// Observa cada respuesta al terminar: si quien la pidió no es administración y la acción
// no se pudo guardar (o el servidor falló), queda en "Fallas del equipo". Se guarda solo
// el mensaje de error de la respuesta, nunca lo que la persona envió.
export const capturarFallas = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && body && typeof body.message === "string") res.locals.falla = body.message;
    return json(body);
  };
  res.on("finish", () => {
    const ruta = String(req.originalUrl || "").split("?")[0];
    if (!debeRegistrar({ metodo: req.method, ruta, codigo: res.statusCode, user: req.authUser })) return;
    registrarFallaServidor({
      user: req.authUser, metodo: req.method, ruta, codigo: res.statusCode,
      mensaje: res.statusCode >= 500 ? "Error interno del servidor." : res.locals.falla || `Respuesta ${res.statusCode}`
    });
  });
  next();
};
