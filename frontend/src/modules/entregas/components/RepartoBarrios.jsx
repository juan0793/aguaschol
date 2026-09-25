import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/Icon";
import LatticeLoader from "../../../components/micro/LatticeLoader";
import RepartoMapa, { RAMPA_CLAVES } from "./RepartoMapa";
import RepartoPlantillaDialog from "./RepartoPlantillaDialog";
import RepartoPrint from "../print/RepartoPrint";
import { formatDateTime, formatNumber } from "../utils/entregasFormatters";
import {
  COLOR_SIN_ASIGNAR,
  TRAMOS_CARGA,
  desvioDeMeta,
  formatoDesvio,
  repartoComoTexto,
  tramoDeCarga
} from "../utils/repartoUtils";

const MODOS = [
  { clave: "responsable", etiqueta: "Persona" },
  { clave: "carga", etiqueta: "Carga de la zona" },
  { clave: "claves", etiqueta: "Claves por barrio" }
];

const SIN_ASIGNAR = "sin";

// Reparto por barrio: que persona entrega cada barrio. Se cambia tocando un
// barrio en el mapa o en la tabla; cada cambio se guarda al momento.
export default function RepartoBarrios({ model, personal = [], permissions, notify }) {
  const { barrios, mapa, participantes, colores, totales, sinAsignar, meta, cargando, error, guardando } = model;
  const [modo, setModo] = useState("responsable");
  const [resaltado, setResaltado] = useState(null);
  const [seleccionado, setSeleccionado] = useState("");
  const [filtros, setFiltros] = useState({ q: "", responsable: "" });
  const [plantillaAbierta, setPlantillaAbierta] = useState(false);
  const [impresion, setImpresion] = useState(null);
  const [aImprimir, setAImprimir] = useState("");
  const puedeEditar = Boolean(permissions?.can_manage_reparto);

  const opcionesPersona = useMemo(
    () => personal.filter((persona) => persona.activo).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo)),
    [personal]
  );
  const nombrePersona = (id) => personal.find((persona) => Number(persona.id) === Number(id))?.nombre_completo || `Persona #${id}`;

  const barrioSeleccionado = barrios.find((barrio) => barrio.codigo === seleccionado) || null;

  const visibles = useMemo(() => {
    const texto = filtros.q.trim().toLowerCase();
    return barrios.filter((barrio) => {
      if (!barrio.claves && !barrio.responsable_id) return false;
      if (texto && !`${barrio.codigo} ${barrio.nombre}`.toLowerCase().includes(texto)) return false;
      if (filtros.responsable === SIN_ASIGNAR) return !barrio.responsable_id;
      if (filtros.responsable) return Number(barrio.responsable_id) === Number(filtros.responsable);
      return true;
    }).sort((a, b) => b.claves - a.claves);
  }, [barrios, filtros]);

  const cargas = participantes.map((persona) => ({ persona, ...(totales.get(Number(persona.id)) || { claves: 0, barrios: 0 }) }));
  const valores = cargas.map((item) => item.claves);
  const dentroDeMeta = cargas.filter((item) => item.claves && Math.abs(desvioDeMeta(item.claves, meta)) <= 0.05).length;
  const escala = Math.max(meta * 1.5, ...valores, 1);

  const asignar = async (codigo, cambios) => {
    try {
      const guardado = await model.asignar(codigo, cambios);
      const barrio = barrios.find((item) => item.codigo === codigo);
      if (guardado && "responsable_id" in cambios) {
        notify(guardado.responsable_id ? `${barrio?.nombre} ahora lo entrega ${nombrePersona(guardado.responsable_id)}.` : `${barrio?.nombre} quedó sin asignar.`);
      }
    } catch (err) {
      notify(err.message || "No se pudo guardar el cambio.");
    }
  };

  const copiar = async () => {
    const texto = repartoComoTexto({ barrios, participantes, meta, titulo: "Reparto de barrios" });
    try {
      await navigator.clipboard.writeText(texto);
      notify("Reparto copiado. Ya puedes pegarlo en un mensaje.");
    } catch {
      notify("No se pudo copiar automáticamente.");
    }
  };

  // Impresion: el portal se monta fuera de la vista, se marca <body> para que el
  // CSS de impresion muestre solo las hojas y se dispara el dialogo del sistema.
  useEffect(() => {
    if (!impresion) return undefined;
    document.body.classList.add("ent-imprimiendo-acta");
    const temporizador = setTimeout(() => window.print(), 80);
    const limpiar = () => {
      document.body.classList.remove("ent-imprimiendo-acta");
      setImpresion(null);
    };
    window.addEventListener("afterprint", limpiar);
    return () => {
      clearTimeout(temporizador);
      window.removeEventListener("afterprint", limpiar);
      document.body.classList.remove("ent-imprimiendo-acta");
    };
  }, [impresion]);

  const imprimir = () => {
    if (!barrios.length) return;
    setImpresion({ responsableId: aImprimir || null, en: new Date().toISOString() });
  };

  if (!barrios.length && cargando) {
    return (
      <section className="cl-inbox">
        <div className="cl-module-loading"><LatticeLoader label="Cargando reparto…" /></div>
      </section>
    );
  }

  return (
    <section className="cl-inbox ent-reparto">
      <div className="cl-inbox-head">
        <div>
          <span className="cl-kicker">Zonas de entrega</span>
          <h3>Reparto por barrio</h3>
          <p>
            Qué persona entrega cada barrio, con las claves del padrón. Toca un barrio en el mapa o cambia su responsable en la tabla; se guarda al momento.
            {model.actualizadoEn ? ` Último cambio: ${formatDateTime(model.actualizadoEn).replace(/\.$/, "")}.` : ""}
          </p>
        </div>
        <div className="ent-reparto-acciones">
          {puedeEditar ? (
            <button type="button" className="cl-secondary" onClick={() => setPlantillaAbierta(true)} disabled={guardando === "lote"}>
              <Icon name="clipboard" />
              Cargar reparto
            </button>
          ) : null}
          <button type="button" className="cl-secondary" onClick={copiar} disabled={!barrios.length}>
            <Icon name="copy" />
            Copiar
          </button>
          <div className="ent-reparto-imprimir">
            <select id="reparto-imprimir" aria-label="Qué imprimir" value={aImprimir} onChange={(event) => setAImprimir(event.target.value)}>
              <option value="">Todo el reparto</option>
              {participantes.filter((persona) => totales.get(Number(persona.id))?.barrios).map((persona) => (
                <option key={persona.id} value={persona.id}>Hoja de {persona.nombre_completo}</option>
              ))}
            </select>
            <button type="button" className="cl-primary" onClick={imprimir} disabled={!barrios.length || Boolean(impresion)}>
              <Icon name="print" />
              Imprimir
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="ent-lotes-alert" role="alert">
          <Icon name="warning" />
          <span>{error}</span>
          <button type="button" className="cl-secondary" onClick={model.reload}>Reintentar</button>
        </div>
      ) : null}

      <div className="ent-jornada-strip">
        <article>
          <Icon name="users" />
          <span>Meta por persona</span>
          <strong>{formatNumber(meta)}</strong>
        </article>
        <article>
          <Icon name="barChart" />
          <span>Carga más baja y más alta</span>
          <strong>{valores.length ? `${formatNumber(Math.min(...valores))} – ${formatNumber(Math.max(...valores))}` : "—"}</strong>
        </article>
        <article className={dentroDeMeta === participantes.length && participantes.length ? "is-ok" : ""}>
          <Icon name="success" />
          <span>Dentro de ±5 % de la meta</span>
          <strong>{formatNumber(dentroDeMeta)} de {formatNumber(participantes.length)}</strong>
        </article>
        <article className={sinAsignar.barrios ? "is-atencion" : "is-ok"}>
          <Icon name="pin" />
          <span>Sin asignar</span>
          <strong>{sinAsignar.barrios ? `${formatNumber(sinAsignar.claves)} claves` : "Todo asignado"}</strong>
        </article>
      </div>

      <div className="ent-reparto-grid">
        <div className="ent-card ent-reparto-mapa-card">
          <div className="ent-reparto-card-head">
            <h3>Mapa por zona</h3>
            <div className="ent-reparto-modos" role="group" aria-label="Color del mapa">
              {MODOS.map((item) => (
                <button key={item.clave} type="button" aria-pressed={modo === item.clave} onClick={() => setModo(item.clave)}>
                  {item.etiqueta}
                </button>
              ))}
            </div>
          </div>
          <div className="ent-reparto-mapa">
            <RepartoMapa
              mapa={mapa}
              barrios={barrios}
              participantes={participantes}
              colores={colores}
              totales={totales}
              meta={meta}
              modo={modo}
              seleccionado={seleccionado}
              resaltado={resaltado}
              onSelect={setSeleccionado}
            />
          </div>
          {modo === "responsable" ? (
            <div className="ent-reparto-leyenda">
              {participantes.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  className="ent-reparto-chip"
                  aria-pressed={Number(resaltado) === Number(persona.id)}
                  onClick={() => setResaltado((actual) => (Number(actual) === Number(persona.id) ? null : persona.id))}
                >
                  <i style={{ background: colores.get(Number(persona.id)) }} />
                  {persona.nombre_completo.split(" ")[0]}
                  <b>{formatNumber(totales.get(Number(persona.id))?.claves || 0)}</b>
                </button>
              ))}
              <span className="ent-reparto-chip is-estatico"><i style={{ background: COLOR_SIN_ASIGNAR }} />Sin asignar</span>
            </div>
          ) : (
            <div className="ent-reparto-escala">
              <div>
                {(modo === "carga" ? TRAMOS_CARGA : RAMPA_CLAVES).map((paso) => <i key={paso.color} style={{ background: paso.color }} />)}
              </div>
              <div>
                {modo === "carga"
                  ? TRAMOS_CARGA.map((tramo) => <span key={tramo.clave}>{tramo.etiqueta}</span>)
                  : RAMPA_CLAVES.map((paso) => <span key={paso.desde}>{paso.desde ? `${formatNumber(paso.desde)}+` : "<100"}</span>)}
              </div>
            </div>
          )}
          <p className="ent-reparto-nota">Los círculos son barrios sin polígono en el SIG, ubicados por el plano; su tamaño va con las claves. Toca una persona para resaltar su zona.</p>
        </div>

        <aside className="ent-reparto-lateral">
          <div className="ent-card ent-reparto-editor" aria-live="polite">
            {barrioSeleccionado ? (
              <>
                <span className="cl-kicker">Barrio {barrioSeleccionado.codigo}</span>
                <h3>{barrioSeleccionado.nombre}</h3>
                <p>{formatNumber(barrioSeleccionado.claves)} claves en el padrón</p>
                <label className="cl-field">
                  Lo entrega
                  <select
                    value={barrioSeleccionado.responsable_id || ""}
                    disabled={!puedeEditar || guardando === barrioSeleccionado.codigo}
                    onChange={(event) => asignar(barrioSeleccionado.codigo, { responsable_id: event.target.value })}
                  >
                    <option value="">Sin asignar</option>
                    {opcionesPersona.map((persona) => {
                      const total = totales.get(Number(persona.id))?.claves || 0;
                      return <option key={persona.id} value={persona.id}>{persona.nombre_completo} · {formatNumber(total)}</option>;
                    })}
                  </select>
                </label>
                <OrdenRuta barrio={barrioSeleccionado} disabled={!puedeEditar || !barrioSeleccionado.responsable_id} onSave={(orden) => asignar(barrioSeleccionado.codigo, { orden_ruta: orden })} />
                <button type="button" className="cl-quiet" onClick={() => setSeleccionado("")}>Cerrar</button>
              </>
            ) : (
              <>
                <h3>Cambiar un barrio</h3>
                <p>Toca un barrio en el mapa para ver sus claves y pasarlo a otra persona. En la tabla de abajo puedes cambiar varios seguidos.</p>
              </>
            )}
          </div>

          <div className="ent-card">
            <h3>Carga contra la meta</h3>
            <ul className="ent-reparto-barras">
              {cargas.map(({ persona, claves }) => {
                const tramo = tramoDeCarga(claves, meta);
                return (
                  <li key={persona.id}>
                    <span className="ent-reparto-barra-nombre"><i style={{ background: colores.get(Number(persona.id)) }} />{persona.nombre_completo}</span>
                    <span className="ent-reparto-barra" title={`${formatNumber(claves)} claves · ${tramo.etiqueta}`}>
                      <b style={{ width: `${(claves / escala) * 100}%`, background: tramo.color }} />
                      <em style={{ left: `${(meta / escala) * 100}%` }} aria-hidden="true" />
                    </span>
                    <span className="ent-reparto-barra-valor">
                      <strong>{formatNumber(claves)}</strong>
                      <small>{claves ? formatoDesvio(claves, meta) : tramo.etiqueta}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="ent-reparto-nota">La línea marca la meta de {formatNumber(meta)} claves: el padrón repartido parejo entre {formatNumber(participantes.length)} personas.</p>
          </div>
        </aside>
      </div>

      <div className="cl-toolbar ent-toolbar">
        <label className="cl-search">
          Buscar barrio
          <div>
            <Icon name="search" />
            <input value={filtros.q} onChange={(event) => setFiltros({ ...filtros, q: event.target.value })} placeholder="Nombre o código" />
          </div>
        </label>
        <label>
          Persona
          <select value={filtros.responsable} onChange={(event) => setFiltros({ ...filtros, responsable: event.target.value })}>
            <option value="">Todas</option>
            <option value={SIN_ASIGNAR}>Sin asignar</option>
            {participantes.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>)}
          </select>
        </label>
      </div>

      <div className="cl-table-wrap">
        <table className="cl-table ent-table ent-reparto-tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Barrio</th>
              <th className="is-num">Claves</th>
              <th>Lo entrega</th>
              <th className="is-num">Orden</th>
            </tr>
          </thead>
          <tbody>
            {!visibles.length ? (
              <tr><td colSpan={5} className="cl-empty">No hay barrios con esos filtros.</td></tr>
            ) : null}
            {visibles.map((barrio) => (
              <tr key={barrio.codigo} className={seleccionado === barrio.codigo ? "is-seleccionado" : ""}>
                <td className="is-clave">{barrio.codigo}</td>
                <td>
                  <button type="button" className="ent-reparto-link" onClick={() => setSeleccionado(barrio.codigo)}>{barrio.nombre}</button>
                </td>
                <td className="is-num">{formatNumber(barrio.claves)}</td>
                <td>
                  <div className="ent-reparto-celda-persona">
                    <i style={{ background: barrio.responsable_id ? colores.get(Number(barrio.responsable_id)) : COLOR_SIN_ASIGNAR }} />
                    <select
                      aria-label={`Quién entrega ${barrio.nombre}`}
                      value={barrio.responsable_id || ""}
                      disabled={!puedeEditar || guardando === barrio.codigo}
                      onChange={(event) => asignar(barrio.codigo, { responsable_id: event.target.value })}
                    >
                      <option value="">Sin asignar</option>
                      {barrio.responsable_id && !opcionesPersona.some((p) => Number(p.id) === Number(barrio.responsable_id)) ? (
                        <option value={barrio.responsable_id}>{nombrePersona(barrio.responsable_id)} (inactivo)</option>
                      ) : null}
                      {opcionesPersona.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre_completo}</option>)}
                    </select>
                  </div>
                </td>
                <td className="is-num">{barrio.orden_ruta || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plantillaAbierta ? (
        <RepartoPlantillaDialog
          model={model}
          personal={personal}
          notify={notify}
          onClose={() => setPlantillaAbierta(false)}
        />
      ) : null}

      {impresion
        ? createPortal(
            <div className="ent-acta-portal">
              <RepartoPrint
                reparto={{ barrios, participantes, colores, totales, meta, mapa, sinAsignar }}
                responsableId={impresion.responsableId}
                generadoEn={impresion.en}
              />
            </div>,
            document.body
          )
        : null}
    </section>
  );
}

// El orden de ruta se guarda al salir del campo o con Enter, no en cada tecla.
function OrdenRuta({ barrio, disabled, onSave }) {
  const [valor, setValor] = useState(barrio.orden_ruta || "");
  useEffect(() => setValor(barrio.orden_ruta || ""), [barrio.codigo, barrio.orden_ruta]);
  const guardar = () => {
    if (String(valor) === String(barrio.orden_ruta || "")) return;
    onSave(valor === "" ? "" : Number(valor));
  };
  return (
    <label className="cl-field">
      Orden en su ruta
      <input
        type="number"
        min="1"
        max="999"
        inputMode="numeric"
        value={valor}
        disabled={disabled}
        placeholder="Sin orden"
        onChange={(event) => setValor(event.target.value)}
        onBlur={guardar}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); guardar(); } }}
      />
      <small>Opcional. Define en qué orden sale el barrio en la hoja impresa.</small>
    </label>
  );
}

