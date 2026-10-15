import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import BuscarEntrega from "./BuscarEntrega";
import {
  DIAS_ATRASO,
  ESTADOS,
  diasDesde,
  documentos,
  fechaCorta,
  fechaHora,
  guardarBorrador,
  haceCuanto,
  inicial,
  leerBorrador,
  leerJson,
  textoError,
  nombrePropio,
  origenTexto,
  periodoHn,
  plural,
  tituloPeriodo
} from "./reclamosFormato";
import "./reclamos.css";

const REFRESCO_MS = 60000;
const FILTRO_INICIAL = { estado: "ABIERTOS", responsable: "", q: "", pagina: 1, agrupar: "dia" };

// Reclamos de entrega: pantalla de inicio de los técnicos. Todo el equipo ve todos los
// reclamos; el técnico escribe qué pasó y la oficina los registra y los cierra.
export default function ReclamosWorkspace({ apiFetch, session, showAlert }) {
  const user = session?.user;
  const [filtros, setFiltros] = useState(FILTRO_INICIAL);
  const [busqueda, setBusqueda] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resaltado, setResaltado] = useState(null);
  const pedido = useRef(0);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    const numero = ++pedido.current;
    if (!silencioso) setCargando(true);
    try {
      const params = new URLSearchParams({ estado: filtros.estado, pagina: String(filtros.pagina) });
      if (filtros.responsable) params.set("responsable", filtros.responsable);
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.estado === "CERRADO") params.set("agrupar", filtros.agrupar);
      const cuerpo = await leerJson(await apiFetch(`/entregas/reclamos?${params}`), "No se pudieron cargar los reclamos.");
      if (numero !== pedido.current) return;
      setData(cuerpo);
      setError("");
    } catch (reason) {
      if (numero === pedido.current && !silencioso) setError(textoError(reason));
    } finally {
      if (numero === pedido.current) setCargando(false);
    }
  }, [apiFetch, filtros]);

  useEffect(() => { cargar(); }, [cargar]);
  // Los reclamos nuevos llegan solos mientras la pestaña está a la vista.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") cargar({ silencioso: true }); };
    const intervalo = window.setInterval(tick, REFRESCO_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(intervalo); document.removeEventListener("visibilitychange", tick); };
  }, [cargar]);

  // La búsqueda de la lista espera a que se deje de escribir.
  useEffect(() => {
    const espera = window.setTimeout(() => setFiltros((actual) => (actual.q === busqueda.trim() ? actual : { ...actual, q: busqueda.trim(), pagina: 1 })), 320);
    return () => window.clearTimeout(espera);
  }, [busqueda]);

  const cambiar = (cambio) => setFiltros((actual) => ({ ...actual, ...cambio, pagina: cambio.pagina ?? 1 }));
  const reemplazar = (reclamo) => setData((actual) => actual && ({ ...actual, items: actual.items.map((item) => (item.id === reclamo.id ? reclamo : item)) }));

  const accion = async (ruta, opciones, mensaje) => {
    const reclamo = await leerJson(await apiFetch(ruta, opciones), mensaje);
    if (reclamo?.id) reemplazar(reclamo);
    cargar({ silencioso: true });
    return reclamo;
  };

  const verReclamo = (texto) => {
    setBusqueda(texto);
    setFiltros({ ...FILTRO_INICIAL, q: texto });
    window.requestAnimationFrame(() => document.getElementById("rc-lista-titulo")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const permisos = data?.permisos || {};
  const resumen = data?.resumen || {};
  // La oficina se sabe por la sesión, para que el técnico nunca vea el tablero mientras carga.
  const oficina = user?.role === "admin" && !user?.preview;
  const esTecnico = ["operator", "validadora_campo"].includes(user?.role);
  const antiguo = resumen.mas_antiguo_sin_respuesta;
  const diasAntiguo = antiguo ? diasDesde(antiguo) : 0;
  const enArchivo = filtros.estado === "CERRADO";

  const franja = [
    {
      clave: "SIN_RESPUESTA",
      cifra: resumen.sin_respuesta,
      label: "Sin respuesta",
      detalle: resumen.sin_respuesta ? `El más antiguo: ${haceCuanto(antiguo)}` : "Nadie espera respuesta",
      tono: resumen.sin_respuesta ? (diasAntiguo > DIAS_ATRASO ? "rojo" : "ocre") : "verde"
    },
    { clave: "RESPONDIDO", cifra: resumen.respondido, label: "Respondidos", detalle: "Esperan que la oficina los archive", tono: "azul" },
    { clave: "CERRADO", cifra: resumen.cerrado_ciclo, label: "Archivados", detalle: data?.ciclo_desde ? `Desde el ${fechaCorta(data.ciclo_desde)}` : "En este ciclo", tono: "verde" }
  ];

  const filtroPersona = data?.por_tecnico?.find((fila) => String(fila.id ?? "sin") === filtros.responsable);
  const titulosLista = { ABIERTOS: oficina ? "Reclamos abiertos" : "Reclamos activos", SIN_RESPUESTA: "Sin respuesta", RESPONDIDO: "Respondidos", CERRADO: "Archivo" };
  const total = data?.total || 0;
  const desde = total ? (filtros.pagina - 1) * (data?.por_pagina || 30) + 1 : 0;
  const hasta = Math.min(filtros.pagina * (data?.por_pagina || 30), total);
  const grupos = enArchivo && data?.periodos ? agruparPorPeriodo(data.items, data.periodos, data.agrupar || filtros.agrupar) : null;
  const filas = (lista) => lista.map((reclamo) => <ReclamoFila
    key={reclamo.id}
    reclamo={reclamo}
    userId={user?.id}
    permisos={permisos}
    esTecnico={esTecnico}
    resaltado={resaltado === reclamo.id}
    onAccion={accion}
  />);

  return <section className={`rc${oficina ? "" : " is-campo"}`} aria-labelledby="rc-titulo" aria-busy={cargando}>
    <header className="rc-head">
      <div>
        <h1 id="rc-titulo">Reclamos de entrega</h1>
        <p>{oficina
          ? "Escribe la clave o el abonado que reclama: el sistema dice qué técnico entregó ese barrio y el reclamo le llega a todo el equipo."
          : "Facturas y notas de cobro que el abonado dice que no recibió. Revisa el reclamo y escribe qué pasó con esa entrega."}</p>
      </div>
      <button type="button" className="rc-icono-boton" onClick={() => cargar()} disabled={cargando} aria-label="Actualizar" title="Actualizar"><Icon name="refresh" /></button>
    </header>

    {oficina ? <>
      <div className="rc-franja" role="group" aria-label="Filtrar por estado">
        {franja.map((celda) => {
          const activa = filtros.estado === celda.clave;
          return <button type="button" key={celda.clave} className={`is-${celda.tono}${activa ? " is-activo" : ""}`} aria-pressed={activa} onClick={() => cambiar({ estado: activa ? "ABIERTOS" : celda.clave })}>
            <strong>{data ? celda.cifra ?? 0 : "—"}</strong>
            <span>{celda.label}</span>
            <small>{data ? celda.detalle : "Cargando…"}</small>
          </button>;
        })}
      </div>

      <BuscarEntrega
        apiFetch={apiFetch}
        puedeRegistrar={Boolean(permisos.registrar)}
        motivos={data?.motivos || []}
        onVerReclamo={verReclamo}
        onRegistrado={(reclamo) => {
          showAlert?.(`Reclamo #${reclamo.id} registrado${reclamo.responsable ? ` para ${reclamo.responsable.nombre}` : ""}.`);
          setResaltado(reclamo.id);
          setBusqueda("");
          setFiltros(FILTRO_INICIAL);
          cargar({ silencioso: true });
        }}
      />
      <PorTecnico filas={data?.por_tecnico} activo={filtros.responsable} onElegir={(id) => cambiar({ responsable: filtros.responsable === id ? "" : id })} />
    </> : null}

    <section className="rc-lista-zona" aria-labelledby="rc-lista-titulo">
      <div className="rc-lista-head">
        <h2 id="rc-lista-titulo">
          {titulosLista[filtros.estado]}
          {filtroPersona ? <span> · {filtroPersona.nombre}</span> : null}
        </h2>
        <div className="rc-lista-filtros">
          {enArchivo ? <div className="rc-periodo" role="group" aria-label="Agrupar el archivo">
            {[["dia", "Día"], ["mes", "Mes"], ["anio", "Año"]].map(([valor, label]) => <button type="button" key={valor} className={filtros.agrupar === valor ? "is-activo" : ""} aria-pressed={filtros.agrupar === valor} onClick={() => cambiar({ agrupar: valor })}>{label}</button>)}
          </div> : null}
          <label className="rc-filtro-texto">
            <span className="rc-sr">Buscar en la lista</span>
            <Icon name="search" />
            <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Clave, abonado o barrio" />
          </label>
          <select value={filtros.estado} onChange={(event) => cambiar({ estado: event.target.value })} aria-label="Estado">
            <option value="ABIERTOS">{oficina ? "Abiertos" : "Activos"}</option>
            <option value="SIN_RESPUESTA">Sin respuesta</option>
            <option value="RESPONDIDO">Respondidos</option>
            {oficina ? <option value="CERRADO">Archivados</option> : null}
          </select>
          {oficina && (filtros.responsable || filtros.q || filtros.estado !== "ABIERTOS")
            ? <button type="button" className="rc-enlace" onClick={() => { setBusqueda(""); setFiltros(FILTRO_INICIAL); }}>Quitar filtros</button> : null}
        </div>
      </div>

      {error ? <p className="rc-aviso is-error" role="alert">{error} <button type="button" className="rc-enlace" onClick={() => cargar()}>Reintentar</button></p> : null}

      {!data && !error ? <ol className="rc-lista is-cargando" aria-hidden="true">{[0, 1, 2].map((n) => <li key={n}><span /><span /><span /></li>)}</ol> : null}

      {data && !data.items.length && !error ? <div className="rc-vacio">
        <Icon name="success" />
        <strong>{filtros.q || filtros.responsable ? "Nada con estos filtros" : enArchivo ? "Todavía no hay reclamos archivados" : "Ningún reclamo pendiente"}</strong>
        <span>{filtros.q || filtros.responsable
          ? "Prueba con otra clave o quita los filtros."
          : enArchivo
            ? "Cuando archives un reclamo, se guarda aquí por día, mes y año."
            : oficina
              ? "Cuando un abonado reclame, busca su clave arriba y registra el reclamo."
              : "Cuando la oficina registre un reclamo aparecerá aquí, con el técnico que entregó esa factura."}</span>
      </div> : null}

      {grupos?.length ? <div className="rc-archivo">
        {grupos.map((grupo) => <section key={grupo.periodo} className="rc-grupo" aria-label={grupo.titulo}>
          <h3 className="rc-grupo-head">
            <span>{grupo.titulo}</span>
            <small>{plural(grupo.total, "reclamo", "reclamos")}{grupo.items.length < grupo.total ? ` · ${grupo.items.length} en esta página` : ""}</small>
          </h3>
          <ol className="rc-lista">{filas(grupo.items)}</ol>
        </section>)}
      </div> : null}

      {!grupos && data?.items.length ? <ol className="rc-lista">{filas(data.items)}</ol> : null}

      {total > (data?.por_pagina || 30) ? <nav className="rc-paginas" aria-label="Páginas">
        <span>{desde}–{hasta} de {total}</span>
        <button type="button" onClick={() => cambiar({ pagina: filtros.pagina - 1 })} disabled={filtros.pagina === 1} aria-label="Página anterior"><Icon name="arrowLeft" /></button>
        <button type="button" onClick={() => cambiar({ pagina: filtros.pagina + 1 })} disabled={hasta >= total} aria-label="Página siguiente"><Icon name="arrowRight" /></button>
      </nav> : null}
    </section>
  </section>;
}

// Junta las filas de la página bajo su periodo de archivo, con el total de cada periodo.
const agruparPorPeriodo = (items, periodos, agrupar) => {
  const totales = new Map(periodos.map((item) => [item.periodo, item.total]));
  const grupos = new Map();
  for (const item of items) {
    const periodo = periodoHn(item.cerrado_en, agrupar);
    if (!grupos.has(periodo)) grupos.set(periodo, { periodo, titulo: tituloPeriodo(periodo, agrupar), total: totales.get(periodo) || 0, items: [] });
    grupos.get(periodo).items.push(item);
  }
  return [...grupos.values()].map((grupo) => ({ ...grupo, total: Math.max(grupo.total, grupo.items.length) }));
};

// Carga del equipo: una barra por técnico, todas en la misma escala. Ocre lo que espera
// respuesta, azul lo respondido y verde lo cerrado en el ciclo. Tocar una fila filtra.
function PorTecnico({ filas, activo, onElegir }) {
  const lista = filas || [];
  const maximo = Math.max(1, ...lista.map((fila) => fila.sin_respuesta + fila.respondido + fila.cerrado));
  return <section className="rc-equipo" aria-labelledby="rc-equipo-titulo">
    <h2 id="rc-equipo-titulo">Por técnico</h2>
    {filas && !lista.length ? <p className="rc-equipo-vacio">Nadie tiene reclamos en este ciclo.</p> : null}
    {!filas ? <p className="rc-equipo-vacio">Cargando…</p> : null}
    {lista.length ? <ul>
      {lista.map((fila) => {
        const id = String(fila.id ?? "sin");
        const total = fila.sin_respuesta + fila.respondido + fila.cerrado;
        const resumen = [
          fila.sin_respuesta ? plural(fila.sin_respuesta, "sin respuesta", "sin respuesta") : "",
          fila.respondido ? plural(fila.respondido, "respondido", "respondidos") : "",
          fila.cerrado ? plural(fila.cerrado, "archivado", "archivados") : ""
        ].filter(Boolean).join(" · ");
        return <li key={id}>
          <button type="button" className={activo === id ? "is-activo" : ""} aria-pressed={activo === id} onClick={() => onElegir(id)} aria-label={`${fila.nombre}: ${resumen}`}>
            <span className="rc-equipo-nombre">{fila.nombre}</span>
            <span className={`rc-equipo-cifra${fila.sin_respuesta ? " is-ocre" : ""}`}>{fila.sin_respuesta || "—"}</span>
            <span className="rc-barra" aria-hidden="true" style={{ "--ancho": `${(total / maximo) * 100}%` }}>
              {fila.sin_respuesta ? <i className="is-ocre" style={{ flexGrow: fila.sin_respuesta }} /> : null}
              {fila.respondido ? <i className="is-azul" style={{ flexGrow: fila.respondido }} /> : null}
              {fila.cerrado ? <i className="is-verde" style={{ flexGrow: fila.cerrado }} /> : null}
            </span>
            <span className="rc-equipo-detalle">{resumen}</span>
          </button>
        </li>;
      })}
    </ul> : null}
    {lista.length ? <p className="rc-leyenda" aria-hidden="true"><span className="is-ocre">Sin respuesta</span><span className="is-azul">Respondido</span><span className="is-verde">Archivado</span></p> : null}
  </section>;
}

function ReclamoFila({ reclamo, userId, permisos, esTecnico, resaltado, onAccion }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [error, setError] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const areaRef = useRef(null);

  const dias = diasDesde(reclamo.created_at);
  const atrasado = reclamo.estado === "SIN_RESPUESTA" && dias > DIAS_ATRASO;
  const estado = ESTADOS[reclamo.estado] || ESTADOS.SIN_RESPUESTA;
  const puedeResponder = permisos.responder && reclamo.estado !== "CERRADO";
  const borrador = leerBorrador(userId, reclamo.id);

  const abrir = () => {
    setTexto(leerBorrador(userId, reclamo.id) || reclamo.respuesta || "");
    setEditando(true);
    setError("");
    window.requestAnimationFrame(() => areaRef.current?.focus());
  };

  const correr = async (tipo, ruta, opciones, mensaje) => {
    setOcupado(tipo); setError("");
    try {
      await onAccion(ruta, opciones, mensaje);
      return true;
    } catch (reason) {
      setError(textoError(reason, "Sin conexión: no se guardó. Inténtalo cuando vuelva la señal."));
      return false;
    } finally {
      setOcupado("");
    }
  };

  const responder = async (event) => {
    event.preventDefault();
    if (texto.trim().length < 5) { setError("Escribe qué pasó con la entrega (mínimo 5 caracteres)."); return; }
    const ok = await correr("responder", `/entregas/reclamos/${reclamo.id}/respuesta`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respuesta: texto })
    }, "No se pudo guardar la respuesta.");
    if (ok) { guardarBorrador(userId, reclamo.id, ""); setEditando(false); }
  };

  const nombre = reclamo.abonado_nombre ? nombrePropio(reclamo.abonado_nombre) : "Sin nombre en el padrón";
  const clase = ["rc-fila", `is-${reclamo.estado.toLowerCase()}`, atrasado ? "is-atrasado" : "", resaltado ? "is-nuevo" : ""].filter(Boolean).join(" ");

  return <li className={clase}>
    <div className="rc-fila-principal">
      <div className="rc-fila-abonado">
        <p className="rc-fila-nombre">{nombre}</p>
        <p className="rc-fila-ident">
          {reclamo.clave_catastral ? <span>{reclamo.clave_catastral}</span> : null}
          {reclamo.numero_abonado ? <span>Abonado {reclamo.numero_abonado}</span> : null}
          {reclamo.barrio_nombre ? <span>{reclamo.barrio_nombre}</span> : null}
        </p>
      </div>
      <div className="rc-fila-motivo">
        <p><strong>{reclamo.motivo_etiqueta}</strong> · {documentos(reclamo.cantidad, reclamo.tipo_documento)}</p>
        {reclamo.detalle ? <p className="rc-fila-detalle">“{reclamo.detalle}”</p> : null}
      </div>
      <div className="rc-fila-tecnico">
        <span className="rc-avatar is-chico" aria-hidden="true">{reclamo.responsable ? inicial(reclamo.responsable.nombre) : "?"}</span>
        <div>
          <p className="rc-fila-quien">{reclamo.responsable?.nombre || "Sin técnico"}</p>
          <p className="rc-fila-origen">{origenTexto({ origen: reclamo.responsable_origen, lote: reclamo.lote })}</p>
        </div>
      </div>
      <div className="rc-fila-estado">
        <span className={`rc-estado is-${atrasado ? "rojo" : estado.tono}`}>{atrasado ? `Sin respuesta · ${dias} días` : estado.label}</span>
        <time dateTime={reclamo.created_at} title={`Registrado el ${fechaHora(reclamo.created_at)} por ${reclamo.created_by_nombre || "la oficina"}`}>Registrado {haceCuanto(reclamo.created_at)}</time>
      </div>
    </div>

    {reclamo.respuesta && !editando ? <div className="rc-respuesta">
      <p className="rc-respuesta-quien"><Icon name="send" />{reclamo.respondido_por_nombre || "El técnico"} respondió <time dateTime={reclamo.respondido_en} title={fechaHora(reclamo.respondido_en)}>{haceCuanto(reclamo.respondido_en)}</time></p>
      <p className="rc-respuesta-texto">{reclamo.respuesta}</p>
      {reclamo.estado === "CERRADO" ? <p className="rc-respuesta-cierre">Archivado por {reclamo.cerrado_por_nombre || "la oficina"} {haceCuanto(reclamo.cerrado_en)}.</p> : null}
    </div> : null}
    {!reclamo.respuesta && reclamo.estado === "CERRADO" && !editando ? <p className="rc-respuesta-cierre is-suelto">Archivado por {reclamo.cerrado_por_nombre || "la oficina"} {haceCuanto(reclamo.cerrado_en)}, sin respuesta del técnico.</p> : null}

    {editando ? <form className="rc-responder" onSubmit={responder}>
      <label htmlFor={`rc-resp-${reclamo.id}`}>¿Qué pasó con {reclamo.cantidad === 1 ? "esta entrega" : "estas entregas"}?</label>
      <textarea
        id={`rc-resp-${reclamo.id}`}
        ref={areaRef}
        rows={3}
        maxLength={1000}
        value={texto}
        onChange={(event) => { setTexto(event.target.value); guardarBorrador(userId, reclamo.id, event.target.value); }}
        placeholder="Ej.: La dejé el 3 de octubre con la vecina de la casa 12. Mañana paso a confirmar con el abonado."
      />
      {error ? <p className="rc-aviso is-error" role="alert">{error} Lo escrito sigue aquí.</p> : null}
      <div className="rc-form-acciones">
        <button type="button" className="rc-boton" onClick={() => { setEditando(false); setError(""); }} disabled={ocupado === "responder"}>Cancelar</button>
        <button type="submit" className="rc-boton is-primario" disabled={ocupado === "responder"}>{ocupado === "responder" ? "Guardando…" : "Guardar respuesta"}</button>
      </div>
    </form> : null}

    {!editando && (puedeResponder || permisos.cerrar) ? <div className="rc-fila-acciones">
      {puedeResponder ? <button type="button" className={`rc-boton${reclamo.respuesta ? "" : esTecnico ? " is-primario" : ""}`} onClick={abrir}>
        <Icon name={reclamo.respuesta ? "edit" : "send"} />{reclamo.respuesta ? "Cambiar respuesta" : borrador ? "Seguir respuesta" : "Responder"}
      </button> : null}
      {permisos.cerrar && reclamo.estado !== "CERRADO" ? <button type="button" className={`rc-boton${reclamo.estado === "RESPONDIDO" ? " is-primario" : ""}`} disabled={Boolean(ocupado)}
        onClick={() => correr("cerrar", `/entregas/reclamos/${reclamo.id}/cerrar`, { method: "POST" }, "No se pudo archivar el reclamo.")}>
        <Icon name="archive" />{ocupado === "cerrar" ? "Archivando…" : "Archivar"}
      </button> : null}
      {permisos.cerrar && reclamo.estado === "CERRADO" ? <button type="button" className="rc-boton" disabled={Boolean(ocupado)}
        onClick={() => correr("reabrir", `/entregas/reclamos/${reclamo.id}/reabrir`, { method: "POST" }, "No se pudo sacar del archivo.")}>
        <Icon name="history" />{ocupado === "reabrir" ? "Sacando…" : "Sacar del archivo"}
      </button> : null}
      {permisos.cerrar ? (confirmarBorrar
        ? <span className="rc-confirmar">¿Eliminar el reclamo #{reclamo.id}?
          <button type="button" className="rc-boton is-peligro" disabled={Boolean(ocupado)} onClick={() => correr("borrar", `/entregas/reclamos/${reclamo.id}`, { method: "DELETE" }, "No se pudo eliminar el reclamo.")}>Sí, eliminar</button>
          <button type="button" className="rc-enlace" onClick={() => setConfirmarBorrar(false)}>No</button>
        </span>
        : <button type="button" className="rc-boton is-discreto" onClick={() => setConfirmarBorrar(true)} aria-label={`Eliminar el reclamo #${reclamo.id}`}><Icon name="trash" /></button>) : null}
    </div> : null}
    {!editando && error ? <p className="rc-aviso is-error" role="alert">{error}</p> : null}
  </li>;
}
