import { useCallback, useEffect, useState } from "react";
import { CheckCheck, ServerCrash, WifiOff, XCircle } from "lucide-react";
import { Icon } from "../../components/Icon";
import { FALLAS_CAMBIARON, TIPOS_FALLA, codigoLegible, haceCuanto, tipoFalla } from "../../utils/fallasFormato";
import "../../app/fallas.css";
import "./fallasWorkspace.css";

const ICONOS = { sin_conexion: WifiOff, rechazada: XCircle, error_servidor: ServerCrash };
const POR_PAGINA = 30;
const fechaCompleta = (iso) => new Date(iso).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// "Fallas del equipo": lo que técnicos y operadores intentaron guardar y no se pudo, sin
// los datos que enviaron. Administración las marca como revisadas; Gerencia solo consulta.
export default function FallasWorkspace({ apiFetch, session }) {
  const puedeRevisar = session?.user?.role === "admin" && !session?.user?.preview;
  const [filtros, setFiltros] = useState({ estado: "pendientes", tipo: "", persona: "", pagina: 1 });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const params = new URLSearchParams({ estado: filtros.estado, limit: String(POR_PAGINA), pagina: String(filtros.pagina) });
      if (filtros.tipo) params.set("tipo", filtros.tipo);
      if (filtros.persona) params.set("persona", filtros.persona);
      const response = await apiFetch(`/fallas?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "No se pudieron consultar las fallas.");
      setData(body);
    } catch (reason) { setError(reason.message || "No se pudieron consultar las fallas."); }
    finally { setCargando(false); }
  }, [apiFetch, filtros]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = (cambio) => setFiltros((actual) => ({ ...actual, ...cambio, pagina: cambio.pagina ?? 1 }));
  const marcar = async (cuerpo) => {
    setMarcando(true);
    try {
      const response = await apiFetch("/fallas/revisadas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "No se pudieron marcar.");
      window.dispatchEvent(new Event(FALLAS_CAMBIARON));
      await cargar();
    } catch (reason) { setError(reason.message); }
    finally { setMarcando(false); }
  };

  const total = data?.total || 0;
  const desde = total ? (filtros.pagina - 1) * POR_PAGINA + 1 : 0;
  const hasta = Math.min(filtros.pagina * POR_PAGINA, total);
  return <section className="fw" aria-labelledby="fw-titulo" aria-busy={cargando}>
    <header className="fw-head">
      <div>
        <h1 id="fw-titulo">Fallas del equipo</h1>
        <p>Lo que el equipo intentó guardar y no se pudo. Solo se registra la acción y el motivo, nunca lo que la persona escribió.</p>
      </div>
      {puedeRevisar && data?.sin_revisar ? <button type="button" className="fw-revisar-todo" onClick={() => marcar({ todas: true })} disabled={marcando}><CheckCheck size={16} aria-hidden="true" />Marcar todas como revisadas</button> : null}
    </header>

    <div className="fw-tipos" role="group" aria-label="Filtrar por tipo">
      <button type="button" className={!filtros.tipo ? "is-activo" : ""} aria-pressed={!filtros.tipo} onClick={() => cambiar({ tipo: "" })}>
        <strong>{data?.sin_revisar ?? "—"}</strong><span>Sin revisar</span>
      </button>
      {Object.entries(TIPOS_FALLA).map(([clave, tipo]) => {
        const IconoTipo = ICONOS[clave];
        return <button type="button" key={clave} className={`is-${tipo.tono}${filtros.tipo === clave ? " is-activo" : ""}`} aria-pressed={filtros.tipo === clave} onClick={() => cambiar({ tipo: filtros.tipo === clave ? "" : clave })}>
          <IconoTipo size={16} aria-hidden="true" /><strong>{data?.por_tipo?.[clave] || 0}</strong><span>{tipo.label}</span><small>{tipo.detalle}</small>
        </button>;
      })}
    </div>

    <div className="fw-filtros">
      <div className="fw-estado" role="group" aria-label="Estado">
        {[["pendientes", "Sin revisar"], ["todas", "Todas"]].map(([clave, label]) => <button type="button" key={clave} className={filtros.estado === clave ? "is-activo" : ""} aria-pressed={filtros.estado === clave} onClick={() => cambiar({ estado: clave })}>{label}</button>)}
      </div>
      <label>Persona
        <select value={filtros.persona} onChange={(event) => cambiar({ persona: event.target.value })}>
          <option value="">Todo el equipo</option>
          {(data?.personas || []).map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre}{persona.sin_revisar ? ` (${persona.sin_revisar})` : ""}</option>)}
        </select>
      </label>
      <button type="button" className="fw-recargar" onClick={cargar} disabled={cargando} aria-label="Actualizar" title="Actualizar"><Icon name="refresh" /></button>
    </div>

    {error ? <p className="fw-error" role="alert">{error} <button type="button" onClick={cargar}>Reintentar</button></p> : null}

    {data && !data.items.length ? <div className="fw-vacio"><CheckCheck size={28} aria-hidden="true" /><strong>{filtros.estado === "pendientes" ? "Nada pendiente de revisar" : "Sin fallas registradas"}</strong><span>Todo lo que el equipo envió con estos filtros se guardó bien.</span></div> : null}

    {data?.items.length ? <ol className="fw-lista">
      {data.items.map((falla) => {
        const tipo = tipoFalla(falla.tipo);
        const IconoTipo = ICONOS[falla.tipo] || XCircle;
        return <li key={falla.id} className={falla.revisada ? "is-revisada" : ""}>
          <span className={`fw-icono is-${tipo.tono}`} aria-hidden="true"><IconoTipo size={17} /></span>
          <div className="fw-cuerpo">
            <p className="fw-accion"><strong>{falla.accion}</strong>{falla.veces > 1 ? <span className="fw-veces">{falla.veces} veces</span> : null}</p>
            <p className="fw-quien">{falla.user_nombre || "Sin nombre"} · <span className={`fw-tipo is-${tipo.tono}`}>{tipo.label}</span>{falla.codigo ? ` · ${codigoLegible(falla.codigo)}` : ""} · {falla.origen === "dispositivo" ? "anotada en su teléfono" : "vista en el servidor"}</p>
            {falla.mensaje ? <p className="fw-mensaje">“{falla.mensaje}”</p> : null}
          </div>
          <div className="fw-lado">
            <time dateTime={falla.ocurrido_en} title={fechaCompleta(falla.ocurrido_en)}>{haceCuanto(falla.ocurrido_en)}</time>
            {falla.revisada ? <span className="fw-ok">Revisada</span> : puedeRevisar ? <button type="button" onClick={() => marcar({ ids: [falla.id] })} disabled={marcando}>Marcar revisada</button> : null}
          </div>
        </li>;
      })}
    </ol> : null}

    {total > POR_PAGINA ? <nav className="fw-paginas" aria-label="Páginas">
      <span>{desde}–{hasta} de {total}</span>
      <button type="button" onClick={() => cambiar({ pagina: filtros.pagina - 1 })} disabled={filtros.pagina === 1} aria-label="Página anterior"><Icon name="arrowLeft" /></button>
      <button type="button" onClick={() => cambiar({ pagina: filtros.pagina + 1 })} disabled={hasta >= total} aria-label="Página siguiente"><Icon name="arrowRight" /></button>
    </nav> : null}
  </section>;
}
