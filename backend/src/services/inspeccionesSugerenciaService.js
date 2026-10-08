// Sugiere el tecnico mas cercano a la clave de una inspeccion usando el reparto de
// barrios de Control de entregas. Las reglas viven en inspeccionesSugerenciaRules.js.

import { env } from "../config/env.js";
import { getPool } from "../config/db.js";
import { getRepartoMapa, leerRepartoBarrios } from "./entregasRepartoService.js";
import { listTecnicosElegibles } from "./inspeccionesService.js";
import { centroidesDeBarrios, sugerirTecnicos } from "./inspeccionesSugerenciaRules.js";

let centroidesCache = null;
const centroides = () => {
  if (!centroidesCache) centroidesCache = centroidesDeBarrios(getRepartoMapa());
  return centroidesCache;
};

export const sugerirTecnicoInspeccion = async (clave, excluirId = null) => {
  if (env.useMemoryDb) {
    return { barrio_codigo: "", barrio_nombre: "", sugerencias: [], aviso: "La sugerencia por zona necesita la base de datos." };
  }
  const [{ barrios }, [personal], tecnicos] = await Promise.all([
    leerRepartoBarrios(),
    getPool().query("SELECT id, nombre_completo, user_id, activo FROM personal_campo"),
    listTecnicosElegibles()
  ]);
  return sugerirTecnicos({ clave, barrios, personal, tecnicos, centroides: centroides(), excluirId });
};
