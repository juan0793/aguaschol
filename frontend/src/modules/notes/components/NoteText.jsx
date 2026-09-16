import { Fragment, useMemo, useSyncExternalStore } from "react";
import { tokenizeNoteContent } from "../utils/noteContent";

const COARSE_QUERY = "(pointer: coarse)";
const subscribeCoarse = (callback) => {
  const media = window.matchMedia(COARSE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const isCoarse = () => window.matchMedia(COARSE_QUERY).matches;

/**
 * Texto de un apunte con enlaces y telefonos detectados. Cada segmento es texto de React (se
 * escapa); nunca se inyecta HTML. En pantallas tactiles un telefono abre el marcador; con
 * mouse, un clic lo copia.
 */
export default function NoteText({ text, className = "", onCopyPhone }) {
  const segments = useMemo(() => tokenizeNoteContent(text), [text]);
  const coarse = useSyncExternalStore(subscribeCoarse, isCoarse, () => false);
  const stop = (event) => event.stopPropagation();

  return (
    <div className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "url") {
          return <a key={index} href={segment.href} target="_blank" rel="noopener noreferrer" onClick={stop}>{segment.value}</a>;
        }
        if (segment.type === "phone") {
          return coarse ? (
            <a key={index} className="note-phone" href={segment.href} onClick={stop}>{segment.value}</a>
          ) : (
            <button
              key={index}
              type="button"
              className="note-phone"
              title="Copiar teléfono"
              onClick={(event) => {
                stop(event);
                onCopyPhone?.(segment);
              }}
            >
              {segment.value}
            </button>
          );
        }
        return <Fragment key={index}>{segment.value}</Fragment>;
      })}
    </div>
  );
}
