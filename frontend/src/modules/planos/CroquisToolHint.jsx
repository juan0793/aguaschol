const toolHelp = {
  select: "Toca un elemento para editarlo.",
  pan: "Arrastra el plano para desplazarte.",
  linea: "Toca para agregar vertices. Pulsa Finalizar cuando termines.",
  poligono: "Agrega al menos tres vertices y cierra el poligono.",
  punto: "Toca el lugar donde deseas colocar el punto.",
  texto: "Toca el lugar donde deseas colocar el texto.",
  codigo: "Toca el lote o calle donde deseas colocar el numero.",
  tapado: "Toca el area que deseas tapar.",
  borrar: "Toca un objeto agregado para eliminarlo."
};

export function CroquisToolHint({ tool, label, detail = "" }) {
  return (
    <div className="planos-tool-hint">
      <strong>{label || tool}</strong>
      <span>{detail || toolHelp[tool] || "Selecciona una herramienta."}</span>
    </div>
  );
}
