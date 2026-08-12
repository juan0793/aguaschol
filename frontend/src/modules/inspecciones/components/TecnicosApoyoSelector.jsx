import { Icon } from "../../../components/Icon";

const roleLabel = { operator: "Operador", validadora_campo: "Validadora de campo" };

export default function TecnicosApoyoSelector({ tecnicos = [], responsableId, selected = [], onToggle }) {
  const disponibles = tecnicos.filter((tecnico) => tecnico.id !== Number(responsableId));
  if (!disponibles.length) return <p className="cl-muted">No hay técnicos disponibles para apoyo.</p>;
  return (
    <div className="ins-apoyo-grid">
      {disponibles.map((tecnico) => {
        const isChecked = selected.includes(tecnico.id);
        return (
          <label key={tecnico.id} className={`ins-apoyo-chip ${isChecked ? "is-active" : ""}`}>
            <input type="checkbox" checked={isChecked} onChange={() => onToggle(tecnico.id)} />
            <span>
              <strong>{tecnico.full_name}</strong>
              <small>
                {roleLabel[tecnico.role] || tecnico.role} · {tecnico.inspecciones_activas} activas
              </small>
            </span>
            {isChecked ? <Icon name="success" /> : null}
          </label>
        );
      })}
    </div>
  );
}
