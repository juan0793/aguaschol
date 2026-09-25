import { memo, useMemo } from "react";
import { formatNumber } from "../utils/entregasFormatters";
import { COLOR_SIN_ASIGNAR, COLOR_ZONA_EXTRA, tramoDeCarga } from "../utils/repartoUtils";

// Rampa secuencial de un solo tono para "Claves por barrio".
export const RAMPA_CLAVES = [
  { desde: 0, color: "#cde2fb" },
  { desde: 100, color: "#9ec5f4" },
  { desde: 300, color: "#5598e7" },
  { desde: 600, color: "#256abf" },
  { desde: 1000, color: "#0d366b" }
];
const colorClaves = (claves) => [...RAMPA_CLAVES].reverse().find((paso) => claves >= paso.desde).color;

// Centro aproximado de un path "M x,y L x,y ... Z" (primer anillo, formula del area).
const centroDePath = (d) => {
  const anillo = d.split("Z")[0].replace("M", "").split("L").map((par) => par.split(",").map(Number));
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const f = anillo[j][0] * anillo[i][1] - anillo[i][0] * anillo[j][1];
    area += f; cx += (anillo[j][0] + anillo[i][0]) * f; cy += (anillo[j][1] + anillo[i][1]) * f;
  }
  if (!area) return anillo[0];
  return [cx / (3 * area), cy / (3 * area)];
};

const primerNombre = (nombre = "") => nombre.trim().split(/\s+/)[0] || nombre;

function RepartoMapa({
  mapa,
  barrios = [],
  participantes = [],
  colores,
  totales,
  meta = 0,
  modo = "responsable",
  seleccionado = "",
  resaltado = null,
  onSelect,
  impreso = false,
  titulo = "Mapa del reparto de barrios"
}) {
  const porCodigo = useMemo(() => new Map(barrios.map((barrio) => [barrio.codigo, barrio])), [barrios]);
  const nombrePorId = useMemo(() => new Map(participantes.map((p) => [Number(p.id), p.nombre_completo])), [participantes]);

  // Ubicacion de cada barrio: centro de su poligono o su punto del plano.
  const ubicaciones = useMemo(() => {
    const mapaUbic = new Map();
    for (const poligono of mapa?.poligonos || []) {
      if (poligono.codigo && !mapaUbic.has(poligono.codigo)) mapaUbic.set(poligono.codigo, centroDePath(poligono.d));
    }
    for (const punto of mapa?.puntos || []) if (!mapaUbic.has(punto.codigo)) mapaUbic.set(punto.codigo, [punto.x, punto.y]);
    return mapaUbic;
  }, [mapa]);

  if (!mapa?.ancho) return <div className="ent-reparto-mapa-vacio">{mapa ? "El mapa del SIG no está disponible." : "Cargando mapa…"}</div>;

  const relleno = (barrio) => {
    if (!barrio) return null;
    if (modo === "claves") return colorClaves(barrio.claves);
    if (!barrio.responsable_id) return COLOR_SIN_ASIGNAR;
    if (modo === "carga") return tramoDeCarga(totales?.get(Number(barrio.responsable_id))?.claves || 0, meta).color;
    return colores?.get(Number(barrio.responsable_id)) || COLOR_ZONA_EXTRA;
  };

  const atenuado = (barrio) => resaltado != null && Number(barrio?.responsable_id) !== Number(resaltado);

  const propsForma = (barrio) => {
    const nombre = barrio.responsable_id ? nombrePorId.get(Number(barrio.responsable_id)) || "Otra persona" : "Sin asignar";
    const clases = ["ent-reparto-forma", seleccionado === barrio.codigo ? "is-seleccionado" : "", atenuado(barrio) ? "is-atenuado" : ""].join(" ");
    if (impreso) return { className: clases };
    return {
      className: clases,
      role: "button",
      tabIndex: 0,
      "aria-label": `${barrio.nombre}, ${formatNumber(barrio.claves)} claves, ${nombre}`,
      onClick: () => onSelect?.(barrio.codigo),
      onKeyDown: (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect?.(barrio.codigo);
      }
    };
  };

  // Etiqueta de cada zona en su barrio mas grande: siempre cae dentro de la zona.
  const etiquetas = participantes
    .map((persona) => {
      const suyos = barrios.filter((b) => Number(b.responsable_id) === Number(persona.id) && ubicaciones.has(b.codigo));
      if (!suyos.length) return null;
      const mayor = suyos.reduce((a, b) => (b.claves > a.claves ? b : a));
      const [x, y] = ubicaciones.get(mayor.codigo);
      return { id: persona.id, nombre: primerNombre(persona.nombre_completo), total: totales?.get(Number(persona.id))?.claves || 0, x, y };
    })
    .filter(Boolean);

  const puntos = (mapa.puntos || []).filter((punto) => porCodigo.get(punto.codigo)?.claves > 0);

  return (
    <svg
      className={`ent-reparto-svg ${impreso ? "is-impreso" : ""}`}
      viewBox={`0 0 ${mapa.ancho} ${mapa.alto}`}
      role="img"
      aria-label={titulo}
    >
      <g>
        {mapa.poligonos.map((poligono, indice) => {
          const barrio = poligono.codigo ? porCodigo.get(poligono.codigo) : null;
          if (!barrio) return <path key={`f-${indice}`} d={poligono.d} className="ent-reparto-fondo" />;
          return (
            <path key={`p-${indice}`} d={poligono.d} fill={relleno(barrio)} {...propsForma(barrio)}>
              {impreso ? null : <title>{`${barrio.nombre} · ${formatNumber(barrio.claves)} claves`}</title>}
            </path>
          );
        })}
      </g>
      <g>
        {puntos
          .sort((a, b) => porCodigo.get(b.codigo).claves - porCodigo.get(a.codigo).claves)
          .map((punto) => {
            const barrio = porCodigo.get(punto.codigo);
            return (
              <circle key={`c-${punto.codigo}`} cx={punto.x} cy={punto.y} r={Math.max(6, Math.sqrt(barrio.claves) * 0.9)} fill={relleno(barrio)} {...propsForma(barrio)}>
                {impreso ? null : <title>{`${barrio.nombre} · ${formatNumber(barrio.claves)} claves`}</title>}
              </circle>
            );
          })}
      </g>
      {modo !== "claves" ? (
        <g className="ent-reparto-etiquetas" aria-hidden="true">
          {etiquetas.map((etiqueta) => (
            <text key={etiqueta.id} x={etiqueta.x} y={etiqueta.y} textAnchor="middle" opacity={resaltado != null && Number(resaltado) !== Number(etiqueta.id) ? 0.25 : 1}>
              {etiqueta.nombre}
              <tspan x={etiqueta.x} dy="15" className="is-cifra">{formatNumber(etiqueta.total)}</tspan>
            </text>
          ))}
        </g>
      ) : null}
    </svg>
  );
}

export default memo(RepartoMapa);
