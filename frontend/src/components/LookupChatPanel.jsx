import { useEffect, useMemo, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { Icon } from "./Icon";
import { isLookupQueryReady } from "../utils/claveAndLookup";
import {
  buildLookupChatResponse,
  buildLookupErrorResponse,
  buildLookupPrintMarkup,
  parseLookupChatMessage
} from "../utils/lookupChat";
import { printDocument } from "../utils/printDocument";

const suggestions = [
  { label: "Buscar una clave", example: "10-10-10-10", query: "buscar clave 10-10-10-10" },
  { label: "Consultar abonado", example: "Abonado 16523", query: "abonado 16523" },
  { label: "Revisar un saldo", example: "Nombre o abonado", query: "saldo de Juan Perez" },
  {
    label: "Comparar padrones",
    example: "Alcaldía vs. Aguas",
    query: "esta clave esta en alcaldia pero no en aguas 10-10-10-10"
  }
];

const buildId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const modeLabel = {
  clave: "clave catastral",
  abonado: "número de abonado",
  nombre: "nombre"
};

const intentLabel = {
  balance: "saldo y servicios",
  services: "servicios disponibles",
  municipal_check: "comparación con Alcaldía",
  missing_in_aguas: "Alcaldía vs. Aguas",
  general: "consulta general"
};

function LookupChatPanel({ apiFetch, padronMeta }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

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
        text: "Todavía necesito detectar si buscas por clave, abonado o nombre."
      };
    }
    const ready = isLookupQueryReady(liveMeta.query, liveMeta.mode);
    return {
      tone: ready ? "ready" : "thinking",
      title: ready ? "Listo para consultar" : "Falta un poco más de información",
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
      throw new Error(aguas.message || "No fue posible consultar el padrón de Aguas.");
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
            "No pude identificar la búsqueda. Escribe una clave, un número de abonado o el nombre completo de una persona."
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
    const abonado = card?.fields?.find((field) => field.label === "Número de abonado")?.value;
    const value = action === "Copiar clave" ? clave : abonado;
    if (!value) return;
    await navigator.clipboard.writeText(String(value));
    setCopyStatus(action === "Copiar clave" ? "Clave copiada" : "Número de abonado copiado");
  };

  const handlePrintResults = async (message) => {
    const cards = message.cards || [];
    if (!cards.length) return;

    await printDocument(
      message.title || "Resultados de búsqueda",
      buildLookupPrintMarkup(message),
      { bodyClassName: "lookup-chat-print-body", pageSize: "Letter portrait", pageMargin: "10mm" }
    );
  };

  const startNewLookup = () => {
    setMessages([]);
    setInput("");
    setCopyStatus("");
    inputRef.current?.focus();
  };

  return (
    <section className={`lookup-chat ${messages.length ? "has-messages" : ""}`}>
      <div className="lookup-chat-shell">
        <div className="lookup-chat-hero">
          <span className="lookup-chat-hero-icon"><Icon name="search" /></span>
          <div>
            <span className="lookup-chat-kicker">Consulta inteligente</span>
            <h3>¿Qué deseas consultar?</h3>
            <p>Busca por clave, abonado o nombre y compara Catastro con el padrón de Aguas.</p>
          </div>
        </div>

        {messages.length ? (
          <div ref={messagesRef} className="lookup-chat-messages" role="log" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`lookup-chat-message is-${message.role}`}>
                <div className={`lookup-chat-bubble ${message.tone ? `is-${message.tone}` : ""}`}>
                  {message.title ? (
                    <div className="lookup-chat-message-head">
                      <strong className="lookup-chat-message-title">{message.title}</strong>
                      {message.cards?.length ? (
                        <button type="button" className="lookup-chat-print" onClick={() => handlePrintResults(message)}>
                          <Icon name="print" /> Imprimir resultados
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <p>{message.text}</p>
                  {message.tone === "loading" ? (
                    <span className="lookup-chat-loading">
                      <ThinkingOrb state="searching" size={20} theme="light" aria-label="Consultando" />
                      Consultando…
                    </span>
                  ) : null}
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
                                  <Icon name="copy" /> {action}
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
        ) : (
          <div className="lookup-chat-suggestions" aria-label="Consultas de ejemplo">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                className="lookup-chat-suggestion-button"
                onClick={() => submitMessage(suggestion.query)}
                disabled={loading}
              >
                <Icon name="search" />
                <span><strong>{suggestion.label}</strong><small>{suggestion.example}</small></span>
                <Icon name="arrowRight" />
              </button>
            ))}
          </div>
        )}

        {livePreview ? (
          <div className={`lookup-chat-live is-${livePreview.tone}`} aria-live="polite">
            <Icon name={livePreview.tone === "ready" ? "success" : "activity"} />
            <span><strong>{livePreview.title}</strong>{livePreview.text}</span>
          </div>
        ) : null}

        <form className="lookup-chat-input-row" onSubmit={handleSubmit}>
          <button type="button" className="lookup-chat-plus" aria-label="Nueva consulta" title="Nueva consulta" onClick={startNewLookup} disabled={loading}>
            <Icon name="plus" />
          </button>
          <input
            ref={inputRef}
            className="lookup-chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Escribe una clave, abonado o nombre…"
            aria-label="Consulta de clave, abonado o nombre"
            autoComplete="off"
            disabled={loading}
          />
          <span className="lookup-chat-mode">Padrón + Catastro</span>
          <button type="submit" className="lookup-chat-send" disabled={loading || !input.trim()} aria-label="Consultar">
            <Icon name="search" />
          </button>
        </form>
        <span className="lookup-chat-feedback" aria-live="polite">{copyStatus}</span>
      </div>
    </section>
  );
}

export default LookupChatPanel;
