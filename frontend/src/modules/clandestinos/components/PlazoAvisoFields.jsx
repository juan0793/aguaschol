import { computeFechaLimite, describeAvisoPlazo } from "../avisoPlazo";
import { formatSpanishDate } from "../../../utils/datesAndBusiness";
import { radioKeys, radioTabIndex } from "./radioKeys";

// Plazos de uso diario. "Otra fecha" abre un calendario.
export const PLAZO_PRESETS = [
  { key: "h24", label: "24 horas", tipo: "horas", valor: 24 },
  { key: "h48", label: "48 horas", tipo: "horas", valor: 48 },
  { key: "d2", label: "2 días hábiles", tipo: "dias", valor: 2 },
  { key: "d3", label: "3 días hábiles", tipo: "dias", valor: 3 },
  { key: "d5", label: "5 días hábiles", tipo: "dias", valor: 5 },
  { key: "fecha", label: "Otra fecha", tipo: "fecha", valor: null }
];

export const PLAZO_INICIAL = { tipo: "horas", valor: 24, fecha: "" };

// Fecha límite válida (no antes del aviso) o null.
export const fechaLimiteValida = (fechaAviso, plazo) => {
  const fecha = computeFechaLimite(fechaAviso, plazo);
  return fecha && fecha >= String(fechaAviso).slice(0, 10) ? fecha : null;
};

const presetActivo = (plazo) => PLAZO_PRESETS.find((preset) => preset.tipo === plazo.tipo && (preset.tipo === "fecha" || preset.valor === Number(plazo.valor)))?.key || "";

// "lunes 5 de octubre de 2026", en hora local (sin pasar por UTC).
export const fechaLarga = (iso) => {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  return new Intl.DateTimeFormat("es-HN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
};

// Plazo del aviso: elección rápida, fecha de vencimiento calculada y la frase tal
// como saldrá impresa. idPrefix evita ids repetidos si hay dos en la página.
export default function PlazoAvisoFields({ fechaAviso, plazo, onChange, idPrefix = "plazo", disabled = false, announce = true }) {
  const activo = presetActivo(plazo);
  const keys = PLAZO_PRESETS.map((preset) => preset.key);
  const elegir = (key) => {
    const preset = PLAZO_PRESETS.find((item) => item.key === key);
    onChange(preset.tipo === "fecha" ? { tipo: "fecha", valor: null, fecha: plazo.fecha || fechaLimiteValida(fechaAviso, plazo) || fechaAviso } : { tipo: preset.tipo, valor: preset.valor, fecha: "" });
  };
  const fechaLimite = fechaLimiteValida(fechaAviso, plazo);
  const frase = fechaLimite
    ? describeAvisoPlazo({ aviso_plazo_tipo: plazo.tipo, aviso_plazo_valor: plazo.valor, fecha_limite_aviso: fechaLimite }, formatSpanishDate)
    : "";
  return (
    <div className="cl-plazo">
      <div className="cl-plazo-presets" role="radiogroup" aria-label="Plazo para presentarse">
        {PLAZO_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            role="radio"
            aria-checked={activo === preset.key}
            tabIndex={radioTabIndex(keys, activo, preset.key)}
            className={activo === preset.key ? "is-active" : ""}
            disabled={disabled}
            onClick={() => elegir(preset.key)}
            onKeyDown={(event) => radioKeys(event, keys, activo, elegir)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {plazo.tipo === "fecha" ? (
        <label className="cl-plazo-fecha" htmlFor={`${idPrefix}-fecha`}>
          <span>Presentarse a más tardar el</span>
          <input id={`${idPrefix}-fecha`} type="date" min={fechaAviso} value={plazo.fecha || ""} onChange={(event) => onChange({ ...plazo, fecha: event.target.value })} disabled={disabled} />
        </label>
      ) : null}
      <p className={`cl-plazo-resultado ${fechaLimite ? "" : "is-error"}`.trim()} aria-live={announce ? "polite" : undefined}>
        {fechaLimite ? (
          <>
            <strong>Vence el {fechaLarga(fechaLimite)}</strong>
            <span>El aviso dirá: «…presentarse al Departamento de Comercialización {frase}…»</span>
          </>
        ) : (
          <strong>{plazo.tipo === "fecha" ? "Elige una fecha igual o posterior a la del aviso." : "Revisa la fecha del aviso."}</strong>
        )}
      </p>
    </div>
  );
}
