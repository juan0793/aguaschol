import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { formatDate, formatNumber, formatPercent, tipoPersonalLabel } from "../utils/entregasFormatters";

const FORM_INICIAL = { nombre_completo: "", tipo_personal: "ENTREGA_FACTURAS", telefono: "", user_id: "", activo: true };

// Persona registrada != usuario del sistema: quien entrega notas de cobro puede
// no tener acceso a la aplicación y aun así recibir lotes e historial.
export default function PersonalCampoTable({ config, personal, permissions, usuarios, notify, onSubmit, onToggle }) {
  const [form, setForm] = useState(FORM_INICIAL);
  const [filtros, setFiltros] = useState({ q: "", tipo_personal: "", acceso: "", activo: "" });
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);

  const resumen = useMemo(
    () =>
      personal.reduce(
        (acc, persona) => {
          if (persona.activo) acc.activos += 1;
          else acc.inactivos += 1;
          if (!persona.tiene_acceso) acc.sinAcceso += 1;
          return acc;
        },
        { activos: 0, inactivos: 0, sinAcceso: 0 }
      ),
    [personal]
  );

  const visibles = useMemo(
    () =>
      personal.filter((persona) => {
        if (filtros.q && !persona.nombre_completo.toLowerCase().includes(filtros.q.toLowerCase())) return false;
        if (filtros.tipo_personal && persona.tipo_personal !== filtros.tipo_personal) return false;
        if (filtros.acceso === "con" && !persona.tiene_acceso) return false;
        if (filtros.acceso === "sin" && persona.tiene_acceso) return false;
        if (filtros.activo === "1" && !persona.activo) return false;
        if (filtros.activo === "0" && persona.activo) return false;
        return true;
      }),
    [filtros, personal]
  );

  const submit = async (event) => {
    event.preventDefault();
    if (guardando) return;
    setGuardando(true);
    try {
      await onSubmit(editandoId, { ...form, user_id: form.user_id || null });
      setForm(FORM_INICIAL);
      setEditandoId(null);
      setFormAbierto(false);
    } catch (error) {
      notify(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setFormAbierto(true);
  };

  const editar = (persona) => {
    setEditandoId(persona.id);
    setForm({
      nombre_completo: persona.nombre_completo,
      tipo_personal: persona.tipo_personal,
      telefono: persona.telefono || "",
      user_id: persona.user_id || "",
      activo: persona.activo
    });
    setFormAbierto(true);
  };

  const cerrarForm = () => {
    setFormAbierto(false);
    setEditandoId(null);
    setForm(FORM_INICIAL);
  };

  return (
    <section className="cl-inbox">
      <div className="cl-inbox-head">
        <div>
          <span className="cl-kicker">Catálogo</span>
          <h3>Personal de campo</h3>
          <p>Todo responsable de lote debe estar registrado aquí. No se aceptan nombres libres.</p>
        </div>
        {permissions.can_manage_personal ? (
          <button type="button" className="cl-primary" onClick={abrirNuevo}>
            <Icon name="plus" />
            Registrar persona
          </button>
        ) : null}
      </div>

      <div className="ent-jornada-strip">
        <article className="is-ok">
          <Icon name="success" />
          <span>Activos</span>
          <strong>{formatNumber(resumen.activos)}</strong>
        </article>
        <article>
          <Icon name="auth" />
          <span>Sin acceso</span>
          <strong>{formatNumber(resumen.sinAcceso)}</strong>
        </article>
        <article>
          <Icon name="archive" />
          <span>Inactivos</span>
          <strong>{formatNumber(resumen.inactivos)}</strong>
        </article>
      </div>

      <div className="cl-toolbar ent-toolbar">
        <label className="cl-search">
          Buscar
          <div>
            <Icon name="search" />
            <input value={filtros.q} onChange={(event) => setFiltros({ ...filtros, q: event.target.value })} />
          </div>
        </label>
        <label>
          Tipo
          <select
            value={filtros.tipo_personal}
            onChange={(event) => setFiltros({ ...filtros, tipo_personal: event.target.value })}
          >
            <option value="">Todos</option>
            {config.tipos_personal.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipoPersonalLabel(tipo)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Acceso
          <select value={filtros.acceso} onChange={(event) => setFiltros({ ...filtros, acceso: event.target.value })}>
            <option value="">Todos</option>
            <option value="con">Con acceso</option>
            <option value="sin">Sin acceso</option>
          </select>
        </label>
        <label>
          Estado
          <select value={filtros.activo} onChange={(event) => setFiltros({ ...filtros, activo: event.target.value })}>
            <option value="">Todos</option>
            <option value="1">Activos</option>
            <option value="0">Inactivos</option>
          </select>
        </label>
      </div>

      <div className="cl-table-wrap">
        <table className="cl-table ent-table ent-personal-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              {permissions.can_view_all ? <th>Usuario</th> : null}
              <th>Estado</th>
              {permissions.can_view_all ? (
                <>
                  <th className="is-num">Lotes</th>
                  <th className="is-num">Asignadas</th>
                  <th className="is-num">Efectividad</th>
                  <th>Última actividad</th>
                </>
              ) : null}
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {!visibles.length ? (
              <tr>
                <td colSpan={permissions.can_view_all ? 9 : 5} className="cl-empty">
                  No hay personal registrado con esos filtros.
                </td>
              </tr>
            ) : null}
            {visibles.map((persona) => (
              <tr key={persona.id}>
                <td>
                  <strong>{persona.nombre_completo}</strong>
                  {persona.telefono ? <small>{persona.telefono}</small> : null}
                </td>
                <td>{tipoPersonalLabel(persona.tipo_personal)}</td>
                {permissions.can_view_all ? (
                  <td>
                    <span className={`cl-status ${persona.tiene_acceso ? "is-con-acceso" : "is-sin-acceso"}`}>
                      <i />
                      {persona.tiene_acceso ? "Con acceso" : "Sin acceso"}
                    </span>
                  </td>
                ) : null}
                <td>
                  <span className={`cl-status ${persona.activo ? "is-abierto" : "is-cancelada"}`}>
                    <i />
                    {persona.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                {permissions.can_view_all ? (
                  <>
                    <td className="is-num">{formatNumber(persona.lotes)}</td>
                    <td className="is-num">{formatNumber(persona.asignadas)}</td>
                    <td className="is-num">{formatPercent(persona.efectividad)}</td>
                    <td>{persona.ultima_actividad ? formatDate(persona.ultima_actividad) : "—"}</td>
                  </>
                ) : null}
                <td className="ent-acciones-celda">
                  {permissions.can_manage_personal ? (
                    <>
                      <button type="button" className="cl-secondary ent-boton-mini" onClick={() => editar(persona)}>
                        <Icon name="edit" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="cl-secondary ent-boton-mini"
                        onClick={() => onToggle(persona)}
                      >
                        {persona.activo ? "Desactivar" : "Activar"}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formAbierto ? (
        <div className="cl-drawer-backdrop" role="dialog" aria-modal="true">
          <aside className="cl-drawer ent-drawer">
            <header>
              <div>
                <span className="cl-kicker">Personal de campo</span>
                <h2>{editandoId ? "Editar persona" : "Registrar persona"}</h2>
                <p>Todo responsable de lote debe estar registrado aquí.</p>
              </div>
              <button type="button" className="cl-icon-button" onClick={cerrarForm} aria-label="Cerrar">
                ✕
              </button>
            </header>

            <div className="cl-drawer-scroll">
              <form id="personal-form" onSubmit={submit}>
                <div className="ent-grid-2">
                  <label className="cl-field">
                    Nombre completo
                    <input
                      value={form.nombre_completo}
                      onChange={(event) => setForm({ ...form, nombre_completo: event.target.value })}
                      required
                    />
                  </label>
                  <label className="cl-field">
                    Tipo
                    <select
                      value={form.tipo_personal}
                      onChange={(event) => setForm({ ...form, tipo_personal: event.target.value })}
                    >
                      {config.tipos_personal.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipoPersonalLabel(tipo)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cl-field">
                    Teléfono (opcional)
                    <input
                      value={form.telefono}
                      onChange={(event) => setForm({ ...form, telefono: event.target.value })}
                    />
                  </label>
                  <label className="cl-field">
                    Usuario del sistema (opcional)
                    <select value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })}>
                      <option value="">Sin acceso a la aplicación</option>
                      {usuarios.map((usuario) => (
                        <option key={usuario.id} value={usuario.id}>
                          {usuario.full_name || usuario.username}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cl-field ent-check is-wide">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(event) => setForm({ ...form, activo: event.target.checked })}
                    />
                    Activo
                  </label>
                </div>
              </form>
            </div>

            <footer className="ent-drawer-footer">
              <button type="button" className="cl-quiet" onClick={cerrarForm}>
                Cancelar
              </button>
              <button type="submit" form="personal-form" className="cl-primary" disabled={guardando}>
                <Icon name={editandoId ? "success" : "plus"} />
                {editandoId ? "Guardar cambios" : "Registrar"}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
