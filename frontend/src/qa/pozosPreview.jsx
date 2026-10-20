import React from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import PozosWorkspace from "../modules/pozos/PozosWorkspace";

// Banco de pruebas de la pantalla Pozos. Datos de mentira con la forma real de /api/pozos:
// nombres y mediciones inventados, ubicados en Choluteca. Abre `qa-pozos.html`.

const colonias = ["Bo. Cabañas", "Bo. Guadalupe", "La Libertad", "Bo. Brisas del Sur", "Campo Sol"];
const pozos = Array.from({ length: 14 }, (_, i) => {
  const valida = i !== 9;
  const lat = 13.296 + (i % 5) * 0.004 + Math.floor(i / 5) * 0.0015;
  const lng = -87.195 + (i % 4) * 0.005 + Math.floor(i / 4) * 0.002;
  return {
    id: i + 1,
    codigo: `Pchol.-${String((i % 11) + 1).padStart(3, "0")}`,
    nombre: i % 3 === 0 ? `Pozo de prueba ${i + 1} con un nombre bastante largo para ver el corte` : `Pozo de prueba ${i + 1}`,
    colonia: colonias[i % colonias.length],
    municipio: "Choluteca",
    utm_x: 479000 + i * 120,
    utm_y: valida ? 1470200 + i * 90 : 14702443,
    elevacion_m: i % 4 ? 40 + i : null,
    latitud: valida ? lat : null,
    longitud: valida ? lng : null,
    coordenada_valida: valida,
    codigo_repetido: i >= 11,
    en_uso: i % 5 === 4 ? null : true,
    profundidad_m: i % 3 ? 20 + i * 1.5 : null,
    nivel_freatico_m: i % 2 ? 10 + i * 0.4 : null,
    diametro_pulg: i % 2 ? 6 : 4,
    tipo_bomba: i % 2 ? "Sumergible, 2 hp" : "Bomba de mecate (prueba)",
    temperatura_c: i % 2 ? 31.5 + i * 0.1 : null,
    ph: i % 2 ? [5.4, 6.9, 7.2, 8.9, 6.6][i % 5] : null,
    tds_g_l: i % 2 ? [0.22, 0.57, 1.31, 0.78, 0.4][i % 5] : null,
    salinidad: i % 2 ? 0.16 + i * 0.02 : null,
    oxigeno_disuelto: i % 2 ? 60 + i : null,
    conductividad: i % 2 ? "386/345" : null,
    cloro_residual: i % 2 ? 0.05 : null,
    observaciones: i % 2 ? "Dato de prueba: pozo usado para limpieza, sellado en la parte superior. Encuestado ficticio." : null
  };
});

// Se repiten los 14 pozos (con id nuevo) para tener más de una página en el listado.
const inventario = [0, 1, 2].flatMap((vuelta) => pozos.map((pozo) => ({ ...pozo, id: pozo.id + vuelta * 100, codigo: `Pchol.-${String(Number(pozo.codigo.slice(-3)) + vuelta * 14).padStart(3, "0")}` })));
const apiFetch = async () => {
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  return new Response(JSON.stringify({ fuente: "datos de prueba (QA)", actualizado: "2026-10-20T12:00:00.000Z", resumen: {}, pozos: inventario }), { status: 200, headers: { "Content-Type": "application/json" } });
};

ReactDOM.createRoot(document.getElementById("root")).render(<PozosWorkspace apiFetch={apiFetch} />);
