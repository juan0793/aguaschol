import React from "react";
import ReactDOM from "react-dom/client";
import "../styles.css";
import BarriosSinAguasWorkspace from "../modules/barriosSinAguas/BarriosSinAguasWorkspace";

// Banco de pruebas de "Barrios sin Aguas". Datos de mentira con la forma de
// GET /claves/alcaldia/barrios-sin-aguas: ningún barrio, nombre ni clave es real.
let semilla = 7;
const azar = (n) => { semilla = (semilla * 16807) % 2147483647; return semilla % n; };
const nombres = ["Col. Ensayo Norte", "Res. Prueba Uno", "Col. Muestra Sur", "Lot. Modelo", "Res. Plantilla", "Col. Boceto", "Aldea Simulada", "Caserío de Prueba", "Res. Ejemplo Largo con Nombre que no Cabe", "Col. Patrón", "Bo. Maqueta", "Col. Croquis", "Res. Esquema", "Col. Borrador", "Lot. Prototipo", "Aldea Ficticia"];
const barrios = Array.from({ length: 60 }, (_, i) => {
  const nombre = nombres[i] || `Col. Ficticia ${i + 1}`;
  const claves = i < 6 ? 300 + azar(1500) : 1 + azar(260);
  const cobertura = i % 3 === 0 ? 0 : i % 3 === 1 ? azar(30) : 20 + azar(80);
  const en_aguas = Math.round((claves * cobertura) / 100);
  const rural = i % 5 === 3 ? claves - azar(3) : azar(3);
  return {
    barrio: nombre, codigo_caserio: `06010010${String(i + 10).padStart(2, "0")}`, sectores: [`${70 + i}-01`],
    claves, en_aguas, sin_registrar: claves - en_aguas, cobertura: claves ? Number(((en_aguas / claves) * 100).toFixed(1)) : 0,
    urbano: claves - rural, rural, avaluo: claves * (40000 + azar(90000)), con_pago_alcaldia: Math.round(claves * 0.3),
    mismo_nombre_en_aguas: false, parecido: i % 7 === 1 ? { nombre: `BO. ${nombre.split(" ").slice(1).join(" ").toUpperCase()}`, usuarios: 12 + azar(900), puntaje: 0.88 } : null
  };
});
const respuesta = { ok: true, alcaldia: { archivo: "Padron de prueba.xlsx", actualizado: "2026-04-28T17:46:01Z", claves: 47533, barrios: barrios.length }, aguas: { actualizado: "2026-11-04T18:09:00Z", usuarios: 25168 }, barrios };

const apiFetch = async (url) => {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const u = new URL(url, location.origin);
  if (u.pathname.endsWith("/claves")) {
    const barrio = barrios.find((b) => b.barrio === u.searchParams.get("barrio"));
    const claves = Array.from({ length: barrio?.claves || 0 }, (_, i) => ({
      clave_catastral: `${barrio.sectores[0]}-${String(i + 1).padStart(2, "0")}`, clave_aguas_formato: "", nombre: `PROPIETARIO DE PRUEBA ${i + 1}`,
      direccion: barrio.barrio, naturaleza: i % 9 ? "Urbano" : "Rural", avaluo: i % 4 ? 50000 + i * 10 : 0, ultimo_periodo_pagado: i % 3 ? "" : "2025", en_aguas: i < barrio.en_aguas
    }));
    return { ok: true, json: async () => ({ ok: true, barrio: barrio?.barrio, total: claves.length, claves }) };
  }
  return { ok: true, json: async () => respuesta };
};

ReactDOM.createRoot(document.getElementById("root")).render(<BarriosSinAguasWorkspace apiFetch={apiFetch} />);
