import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";

// Buscador de la barra superior, el mismo en todas las pantallas. La clave
// catastral es el hilo de la app (PRODUCT.md): desde cualquier lado se llega a
// ella. Abre "Buscar clave" con el texto escrito; esa pantalla ya distingue
// clave, abonado y nombre.
// Atajos: "/" o Ctrl+K enfocan la caja; Esc la vacía y la suelta.
export default function BuscadorGlobal({ onBuscar }) {
  const [texto, setTexto] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const enfocar = (event) => {
      const enCampo = /^(input|textarea|select)$/i.test(event.target?.tagName || "") || event.target?.isContentEditable;
      const atajo = (event.key === "k" || event.key === "K") && (event.ctrlKey || event.metaKey);
      if (atajo || (event.key === "/" && !enCampo)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", enfocar);
    return () => document.removeEventListener("keydown", enfocar);
  }, []);

  const buscar = (event) => {
    event.preventDefault();
    const valor = texto.trim();
    if (!valor) return;
    onBuscar(valor);
    setTexto("");
    inputRef.current?.blur();
  };

  return (
    <form className="app-search" role="search" onSubmit={buscar}>
      <label htmlFor="app-search-input" className="app-search-label">
        <Icon name="search" />
        <span className="app-search-sr">Buscar clave catastral, abonado o nombre</span>
      </label>
      <input
        id="app-search-input"
        ref={inputRef}
        type="search"
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Escape") { setTexto(""); event.currentTarget.blur(); } }}
        placeholder="Clave catastral, abonado o nombre"
        autoComplete="off"
        spellCheck={false}
      />
      <kbd aria-hidden="true">/</kbd>
    </form>
  );
}
