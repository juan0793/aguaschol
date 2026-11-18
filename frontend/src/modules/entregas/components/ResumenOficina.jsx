import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import BarriosEntregaPrint from "../print/BarriosEntregaPrint";
import { useImprimirHoja } from "../hooks/useImprimirHoja";
import "../styles/resumenPrioridad.css";
import { formatNumber } from "../utils/entregasFormatters";
import { textoFechaPlan } from "../utils/planBarrios.js";

// Menú "Imprimir" del Resumen: junta en un lugar lo que la oficina imprime del ciclo.
export function MenuImprimir({ mes, onPrioridad, onReportes }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const [hoja, setHoja] = useImprimirHoja();

  useEffect(() => {
    if (!abierto) return undefined;
    raiz.current?.querySelector("[role=menuitem]:not([disabled])")?.focus();
    const cerrar = (event) => {
      if (event.type === "keydown") {
        if (event.key === "Escape") { setAbierto(false); raiz.current?.querySelector("button")?.focus(); }
        return;
      }
      if (!raiz.current?.contains(event.target)) setAbierto(false);
    };
    window.addEventListener("pointerdown", cerrar);
    window.addEventListener("keydown", cerrar);
    return () => {
      window.removeEventListener("pointerdown", cerrar);
      window.removeEventListener("keydown", cerrar);
    };
  }, [abierto]);

  // Flechas arriba y abajo recorren las opciones, como en un menú del sistema.
  const mover = (event) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const opciones = [...raiz.current.querySelectorAll("[role=menuitem]:not([disabled])")];
    const actual = opciones.indexOf(document.activeElement);
    const siguiente = event.key === "ArrowDown" ? (actual + 1) % opciones.length : (actual - 1 + opciones.length) % opciones.length;
    opciones[siguiente]?.focus();
  };

  const elegir = (accion) => () => { setAbierto(false); accion(); };

  return (
    <div className="ent-imprimir" ref={raiz}>
      <button type="button" className="cl-secondary" aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((valor) => !valor)}>
        <Icon name="print" />
        Imprimir
        <Icon name="chevronDown" />
      </button>
      {abierto ? (
        <div className="ent-imprimir-menu" role="menu" aria-label="Imprimir" onKeyDown={mover}>
          <button type="button" role="menuitem" onClick={elegir(onPrioridad)}>
            <strong>Barrios por prioridad</strong>
            <small>Lo que falta del ciclo, del más urgente al menos, con técnico y carga.</small>
          </button>
          <button type="button" role="menuitem" disabled={!mes?.total} onClick={elegir(() => setHoja({ mes, tecnicoId: null, generadoEn: new Date().toISOString() }))}>
            <strong>Barrios de entrega por técnico</strong>
            <small>Todo el reparto del ciclo con casilla para marcar.</small>
          </button>
          {onReportes ? (
            <button type="button" role="menuitem" onClick={elegir(onReportes)}>
              <strong>Reporte semanal</strong>
              <small>Efectividad, días y barrios de la semana.</small>
            </button>
          ) : null}
        </div>
      ) : null}
      {hoja ? createPortal(<div className="ent-acta-portal"><BarriosEntregaPrint hoja={hoja} /></div>, document.body) : null}
    </div>
  );
}

const ESTADO_EQUIPO = { abierto: "Lote abierto", cerrado: "Cerró", sin_lote: "Sin lote hoy" };

// Cómo va cada técnico en la jornada: su lote de hoy y lo que anotó para la próxima.
export function EquipoHoy({ filas, proxima, hoy }) {
  if (!filas?.length) return null;
  const cuando = textoFechaPlan(proxima, hoy);
  return (
    <section className="ent-card ent-equipo" aria-labelledby="ent-equipo-titulo">
      <div className="ent-card-head">
        <h3 id="ent-equipo-titulo">El equipo hoy</h3>
      </div>
      <ul className="ent-equipo-lista">
        {filas.map((fila) => {
          const lote = fila.lotes[0];
          const detalle = !lote
            ? `${formatNumber(fila.faltan)} ${fila.faltan === 1 ? "barrio" : "barrios"} por entregar`
            : fila.lotes.length > 1
              ? `${formatNumber(fila.lotes.length)} lotes · ${formatNumber(fila.asignadas)} asignadas`
              : lote.abierto
                ? `${lote.barrio} · ${formatNumber(lote.asignadas)} asignadas`
                : `${lote.barrio} · ${formatNumber(lote.entregadas)} de ${formatNumber(lote.asignadas)}`;
          return (
            <li key={fila.id}>
              <strong>{fila.nombre}</strong>
              <span className={`ent-equipo-estado is-${fila.estado}`}>{ESTADO_EQUIPO[fila.estado]}</span>
              <small>{detalle}</small>
              <small className={`ent-equipo-manana${!fila.manana.length && fila.faltan ? " is-sin-plan" : ""}`}>
                {fila.manana.length ? `${cuando[0].toUpperCase()}${cuando.slice(1)}: ${fila.manana.join(", ")}` : fila.faltan ? "Sin plan" : ""}
              </small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
