import { Icon } from "../../../components/Icon";

const Field = ({ label, children, wide = false }) => <label className={wide ? "cl-field is-wide" : "cl-field"}><span>{label}</span>{children}</label>;
const Text = ({ name, value, onChange, ...props }) => <input name={name} value={value ?? ""} onChange={onChange} {...props} />;

export default function FichaSections({ form, onChange, onValidatePadron, history = [], canEditInternal = false }) {
  return <div className="cl-sections">
    <details open><summary><span><Icon name="users" />Abonado</span><small>Identificación y contacto</small></summary><div className="cl-fields">
      <Field label="Clave catastral"><Text required name="clave_catastral" value={form.clave_catastral} onChange={onChange} /></Field>
      <Field label="Abonado"><Text name="abonado" value={form.abonado} onChange={onChange} /></Field>
      <Field label="Nombre catastral"><Text name="nombre_catastral" value={form.nombre_catastral} onChange={onChange} /></Field>
      <Field label="Inquilino"><Text name="inquilino" value={form.inquilino} onChange={onChange} /></Field>
      <Field label="Identidad"><Text name="identidad" value={form.identidad} onChange={onChange} /></Field>
      <Field label="Teléfono"><Text name="telefono" value={form.telefono} onChange={onChange} /></Field>
      <button type="button" className="cl-secondary is-wide" onClick={onValidatePadron}><Icon name="search" />Validar padrones</button>
    </div></details>
    <details open><summary><span><Icon name="home" />Inmueble y ubicación</span><small>Características observadas</small></summary><div className="cl-fields">
      <Field label="Barrio / colonia" wide><Text name="barrio_colonia" value={form.barrio_colonia} onChange={onChange} /></Field>
      <Field label="Situación"><select name="situacion_inmueble" value={form.situacion_inmueble || "Habitado"} onChange={onChange}><option>Habitado</option><option>Deshabitado</option><option>En construcción</option></select></Field>
      <Field label="Uso del suelo"><select name="uso_suelo" value={form.uso_suelo || "Residencial"} onChange={onChange}><option>Residencial</option><option>Comercial</option><option>Mixto</option><option>Industrial</option></select></Field>
      <Field label="Actividad"><Text name="actividad" value={form.actividad} onChange={onChange} /></Field>
      <Field label="Código sector"><Text name="codigo_sector" value={form.codigo_sector} onChange={onChange} /></Field>
    </div></details>
    <details open><summary><span><Icon name="water" />Servicios</span><small>Conexiones detectadas</small></summary><div className="cl-service-grid">
      {[["conexion_agua","Agua potable","water"],["conexion_alcantarillado","Alcantarillado","sewer"],["recoleccion_desechos","Tren de aseo","waste"]].map(([name,label,icon]) => <label key={name}><Icon name={icon} /><span>{label}</span><select name={name} value={form[name] || "No"} onChange={onChange}><option>Si</option><option>No</option></select></label>)}
    </div></details>
    <details><summary><span><Icon name="warning" />Investigación y avisos</span><small>Solo lo necesario para el expediente</small></summary><div className="cl-fields">
      <Field label="Acción / inspección" wide><textarea name="accion_inspeccion" value={form.accion_inspeccion || ""} onChange={onChange} rows="4" /></Field>
      <Field label="Comentario para ficha" wide><textarea name="comentarios" value={form.comentarios || ""} onChange={onChange} rows="3" /></Field>
      <Field label="Fecha de aviso"><Text type="date" name="fecha_aviso" value={(form.fecha_aviso || "").slice(0,10)} onChange={onChange} /></Field>
      <Field label="Firmante"><Text name="firmante_aviso" value={form.firmante_aviso} onChange={onChange} /></Field>
      <Field label="Cargo"><Text name="cargo_firmante" value={form.cargo_firmante} onChange={onChange} /></Field>
      <Field label="Técnico"><Text name="levantamiento_datos" value={form.levantamiento_datos} onChange={onChange} /></Field>
      {canEditInternal ? <Field label="Observaciones internas (no se imprimen)" wide><textarea name="observaciones_internas" value={form.observaciones_internas || ""} onChange={onChange} rows="4" /></Field> : null}
    </div></details>
    <details><summary><span><Icon name="activity" />Evidencias</span><small>Fotografía principal</small></summary><div className="cl-evidence-placeholder">{form.foto_path ? <img src={form.foto_path} alt="Evidencia principal del inmueble" /> : <><Icon name="activity" /><p>La fotografía se administra desde la ficha guardada.</p></>}</div></details>
    <details><summary><span><Icon name="history" />Historial</span><small>{history.length} movimientos</small></summary><ol className="cl-history">{history.length ? history.map((item) => <li key={item.id}><i /><div><strong>{item.estado_nuevo}</strong><span>{item.motivo || "Cambio de estado"}</span><small>{item.actor_name || "Sistema"} · {new Date(item.created_at).toLocaleString("es-HN")}</small></div></li>) : <li className="is-empty">Todavía no hay cambios de estado.</li>}</ol></details>
  </div>;
}
