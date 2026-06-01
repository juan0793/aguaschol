import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { isLookupQueryReady } from "../utils/claveAndLookup";
import {
  buildLookupChatResponse,
  buildLookupErrorResponse,
  parseLookupChatMessage
} from "../utils/lookupChat";

const suggestions = [
  "buscar clave 10-10-10-10",
  "abonado 16523",
  "saldo de Juan Perez",
  "esta clave esta en alcaldia pero no en aguas 10-10-10-10"
];

const buildId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const modeLabel = {
  clave: "clave catastral",
  abonado: "numero de abonado",
  nombre: "nombre"
};

const intentLabel = {
  balance: "saldo y servicios",
  services: "servicios disponibles",
  municipal_check: "comparacion con Alcaldia",
  missing_in_aguas: "Alcaldia vs Aguas",
  general: "consulta general"
};

function LookupChatPanel({ apiFetch, padronMeta }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, loading]);

  const padronCacheKey = useMemo(() => encodeURIComponent(padronMeta?.updated_at || Date.now()), [padronMeta?.updated_at]);
  const liveMeta = useMemo(() => parseLookupChatMessage(input), [input]);
  const livePreview = useMemo(() => {
    const text = input.trim();
    if (!text) return null;
    if (!liveMeta.mode || !liveMeta.query) {
      return {
        tone: "thinking",
        title: "Interpretando en tiempo real",
        text: "Todavia necesito detectar si buscas por clave, abonado o nombre."
      };
    }
    const ready = isLookupQueryReady(liveMeta.query, liveMeta.mode);
    return {
      tone: ready ? "ready" : "thinking",
      title: ready ? "Listo para consultar" : "Falta un poco mas de dato",
      text: `Entiendo: buscar por ${modeLabel[liveMeta.mode] || liveMeta.mode} "${liveMeta.query}" para ${
        intentLabel[liveMeta.intent] || "consulta general"
      }.`
    };
  }, [input, liveMeta]);

  const runLookup = async (queryMeta) => {
    const field = queryMeta.mode === "nombre" ? "nombre" : queryMeta.mode === "abonado" ? "abonado" : "clave";
    const aguasResponse = await apiFetch(
      `/claves/search?clave=${encodeURIComponent(queryMeta.query)}&field=${encodeURIComponent(field)}&_padron=${padronCacheKey}`
    );
    const aguas = await aguasResponse.json();

    if (!aguasResponse.ok) {
      throw new Error(aguas.message || "No fue posible consultar el padron de Aguas.");
    }

    let alcaldia = null;
    if (queryMeta.mode === "clave" || ["municipal_check", "missing_in_aguas"].includes(queryMeta.intent)) {
      const alcaldiaField = queryMeta.mode === "clave" ? "clave" : "texto";
      const alcaldiaResponse = await apiFetch(
        `/claves/alcaldia/search?field=${encodeURIComponent(alcaldiaField)}&clave=${encodeURIComponent(
          queryMeta.query
        )}&_padron=${padronCacheKey}`
      );
      alcaldia = await alcaldiaResponse.json();
      if (!alcaldiaResponse.ok) {
        alcaldia = { ok: false, exists: false, matches: [] };
      }
    }

    return { aguas, alcaldia };
  };

  const submitMessage = async (rawText = input) => {
    const text = String(rawText || "").trim();
    if (!text || loading) return;

    const queryMeta = parseLookupChatMessage(text);
    const userMessage = { id: buildId(), role: "user", text };
    setMessages((current) => [...current, userMessage]);
    setInput("");

    if (!queryMeta.mode || !queryMeta.query || !isLookupQueryReady(queryMeta.query, queryMeta.mode)) {
      setMessages((current) => [
        ...current,
        {
          id: buildId(),
          role: "assistant",
          tone: "warning",
          text:
            "No pude identificar si queres buscar por clave, abonado o nombre. Escribi por ejemplo: clave 10-10-10-10, abonado 16523 o nombre Juan Perez."
        }
      ]);
      return;
    }

    const loadingId = buildId();
    setLoading(true);
    setMessages((current) => [
      ...current,
      {
        id: loadingId,
        role: "assistant",
        tone: "loading",
        text: `Voy a buscar ${queryMeta.query}.`
      }
    ]);

    try {
      const result = await runLookup(queryMeta);
      const response = buildLookupChatResponse(result, queryMeta);
      setMessages((current) =>
        current.map((message) =>
          message.id === loadingId
            ? {
                ...message,
                tone: response.tone,
                title: response.title,
                text: response.text,
                cards: response.cards,
                actions: response.actions
              }
            : message
        )
      );
    } catch (error) {
      const response = buildLookupErrorResponse(error, queryMeta);
      setMessages((current) =>
        current.map((message) =>
          message.id === loadingId
            ? { ...message, tone: response.tone, title: response.title, text: response.text }
            : message
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submitMessage();
  };

  const handleAction = async (action, card) => {
    if (!navigator.clipboard) return;
    const clave = card?.fields?.find((field) => field.label === "Clave catastral")?.value;
    const abonado = card?.fields?.find((field) => field.label === "Numero de abonado")?.value;
    if (action === "Copiar clave" && clave) await navigator.clipboard.writeText(String(clave));
    if (action === "Copiar abonado" && abonado) await navigator.clipboard.writeText(String(abonado));
  };

  return (
    <section className="lookup-chat">
      <div className="lookup-chat-shell">
        <div className="lookup-chat-hero">
          <span className="lookup-chat-kicker">Consulta inteligente sin IA</span>
          <h3>Que deseas verificar hoy?</h3>
          <p>Escribe una clave, abonado, nombre o una pregunta sobre Aguas y Alcaldia.</p>
        </div>

        <form className="lookup-chat-input-row" onSubmit={handleSubmit}>
          <button type="button" className="lookup-chat-plus" aria-label="Nueva consulta" onClick={() => setInput("")} disabled={loading}>
            <Icon name="plus" />
          </button>
          <input
            className="lookup-chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Pregunta lo que quieras del padron"
            disabled={loading}
          />
          <span className="lookup-chat-mode">Reglas + padron</span>
          <button type="submit" className="lookup-chat-send" disabled={loading || !input.trim()} aria-label="Consultar">
            <Icon name="search" />
          </button>
        </form>

        {livePreview ? (
          <div className={`lookup-chat-live is-${livePreview.tone}`} aria-live="polite">
            <strong>{livePreview.title}</strong>
            <span>{livePreview.text}</span>
          </div>
        ) : null}

        <div className="lookup-chat-suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="lookup-chat-suggestion-button"
              onClick={() => submitMessage(suggestion)}
              disabled={loading}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {messages.length ? (
          <div ref={messagesRef} className="lookup-chat-messages" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`lookup-chat-message is-${message.role}`}>
                <div className={`lookup-chat-bubble ${message.tone ? `is-${message.tone}` : ""}`}>
                  {message.title ? <strong className="lookup-chat-message-title">{message.title}</strong> : null}
                  <p>{message.text}</p>
                  {message.tone === "loading" ? <span className="lookup-chat-loading">Consultando...</span> : null}
                  {message.cards?.length ? (
                    <div className="lookup-chat-result-list">
                      {message.cards.map((card, index) => (
                        <div key={`${card.status}-${index}`} className={`lookup-chat-result-card is-${card.tone || "neutral"}`}>
                          <span className="lookup-chat-status-badge">{card.status}</span>
                          <div className="lookup-chat-result-grid">
                            {card.fields.map((field) => (
                              <div key={`${field.label}-${field.value}`}>
                                <span>{field.label}</span>
                                <strong>{field.value || "--"}</strong>
                              </div>
                            ))}
                          </div>
                          {message.actions?.length ? (
                            <div className="lookup-chat-actions">
                              {message.actions.map((action) => (
                                <button key={action} type="button" onClick={() => handleAction(action, card)}>
                                  {action}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default LookupChatPanel;
