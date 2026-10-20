import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

// Pozos de Choluteca: inventario de solo consulta que sale del shapefile "Pozos Choluteca Part1"
// (backend/scripts/convertir_pozos_shp.py lo pasa a backend/data/pozos-choluteca.json).
const rutaPorDefecto = path.resolve(env.dbRoot, "backend", "data", "pozos-choluteca.json");

const contar = (pozos, campo) => pozos.filter((pozo) => pozo[campo] !== null && pozo[campo] !== undefined && pozo[campo] !== false).length;

export const resumirPozos = (pozos = []) => ({
  total: pozos.length,
  en_mapa: pozos.filter((pozo) => pozo.coordenada_valida).length,
  coordenada_invalida: pozos.filter((pozo) => !pozo.coordenada_valida).map((pozo) => pozo.codigo),
  codigos_repetidos: new Set(pozos.filter((pozo) => pozo.codigo_repetido).map((pozo) => pozo.codigo)).size,
  en_uso: contar(pozos, "en_uso"),
  con_calidad: pozos.filter((pozo) => pozo.ph !== null || pozo.tds_g_l !== null).length,
  colonias: new Set(pozos.map((pozo) => pozo.colonia).filter(Boolean)).size
});

// El archivo se vuelve a leer solo cuando cambia (fecha de modificación): la pantalla consulta
// cada minuto y así ve un inventario regenerado sin reiniciar el servidor.
export const crearServicioPozos = ({
  ruta = rutaPorDefecto,
  leer = (archivo) => fs.readFile(archivo, "utf8"),
  modificado = async (archivo) => (await fs.stat(archivo)).mtimeMs
} = {}) => {
  let cache = null;
  let version = null;
  const listar = async () => {
    const actual = await modificado(ruta);
    if (!cache || actual !== version) {
      const datos = JSON.parse(await leer(ruta));
      const pozos = Array.isArray(datos?.pozos) ? datos.pozos : [];
      cache = { fuente: datos?.fuente ?? null, actualizado: new Date(actual).toISOString(), resumen: resumirPozos(pozos), pozos };
      version = actual;
    }
    return cache;
  };
  return { listar };
};

const servicio = crearServicioPozos();
export const listarPozos = () => servicio.listar();
