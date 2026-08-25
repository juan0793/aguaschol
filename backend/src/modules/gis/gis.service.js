import {
  getBarrio,
  getBarrioSummary,
  getBarriosGeoJson,
  getGisHealth,
  getImportReport,
  getCatastroDetail,
  getCatastroReport,
  getLevantamientoDetail,
  getLoteDetail,
  listCatastroInBbox,
  listLevantamientosInBbox,
  listLotesInBbox,
  listBarrios,
  listManzanas,
  listQuebradas,
  resolveClaveGis,
  searchGis
} from "./gis.repository.js";
import { getGisPermissions } from "./gis.validation.js";

export const GIS_DATASETS = [
  { key: "barrios", file: "Barrios.gpkg", layer: "barrios", count: 82, geometry: "MULTIPOLYGON", srid: 32616 },
  { key: "texto_barrios", file: "Texto_Barrios.gpkg", layer: "texto_barrios", count: 72, geometry: "POINT", srid: 32616 },
  { key: "manzanas", file: "Manzanas.gpkg", layer: "manzanas_choluteca", count: 1723, geometry: "MULTIPOLYGON", srid: 32616 },
  { key: "lotes", file: "Lotes.gpkg", layer: "lotes_choluteca", count: 15304, geometry: "MULTIPOLYGON", srid: 32616 },
  { key: "lotes_integrados", file: "Lotes.gpkg", layer: "Lotes_Integrados", count: 5275, geometry: "POLYGON", srid: 32616 },
  { key: "lotesp_integrados", file: "Lotes.gpkg", layer: "Lotesp_Integrados", count: 3881, geometry: "POLYGON", srid: 32616 },
  { key: "numeros_lote", file: "NumeroLotes.gpkg", layer: "numerolotes__texts", count: 66443, geometry: "POINT", srid: 32616 },
  { key: "catastro", file: "BD_CatastroUsuarios.gpkg", layer: "bd_catastrousuarios", count: 15674, geometry: "POINT", srid: 4326 },
  { key: "servicios", file: "BD_CatastroUsuarios.gpkg", layer: "Red_Servicios", count: 3829, geometry: "POINT", srid: 32616 },
  { key: "quebradas", file: "Quebradas.gpkg", layer: "quebradas", count: 47, geometry: "MULTILINESTRING", srid: 32616 },
  { key: "red_agua", file: "PlanosCAD/CAPAS_RedAguasPotables/Capa0.gpkg", layer: "lines", count: 30677, geometry: "LINESTRING", srid: 32616 }
];

export const getGisConfig = (user) => ({
  srid: { canonical: 32616, web: 3857, gps: 4326 },
  tabs: ["mapa", "barrios", "analisis", "reportes"],
  permissions: getGisPermissions(user),
  datasets: GIS_DATASETS
});

export const getGisStatus = async () => {
  try {
    return await getGisHealth();
  } catch (error) {
    return { configured: true, ready: false, postgis: false, error: error.message };
  }
};

export const getTerritoryBarrios = () => listBarrios();
export const getTerritoryBarriosGeoJson = () => getBarriosGeoJson();
export const getTerritoryBarrio = (id) => getBarrio(id);
export const getTerritoryBarrioSummary = (id) => getBarrioSummary(id);
export const getTerritoryManzanas = (barrioId) => listManzanas(barrioId);
export const getTerritoryQuebradas = () => listQuebradas();
export const getTerritoryImportReport = () => getImportReport();
export const getLotesBbox = (options) => listLotesInBbox(options);
export const getCatastroBbox = (options) => listCatastroInBbox(options);
export const searchTerritorialGis = (query) => searchGis(query);
export const resolveTerritorialClave = (clave) => resolveClaveGis(clave);
export const getTerritoryLote = (id) => getLoteDetail(id);
export const getTerritoryCatastro = (id) => getCatastroDetail(id);
export const getTerritoryCatastroReport = () => getCatastroReport();
export const getLevantamientosBbox = (options) => listLevantamientosInBbox(options);
export const getTerritoryLevantamiento = (id) => getLevantamientoDetail(id);
