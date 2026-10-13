// "Gota rota": la gota de Aguas partida. Símbolo de las fallas del equipo (lo que no se
// pudo guardar). Mismo trazo que los iconos de la app y currentColor para el tono.
export default function GotaRota({ size, width, height, strokeWidth = 1.8, ...props }) {
  return (
    <svg width={width ?? size ?? 24} height={height ?? size ?? 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 2.8c-2.6 3.3-6.5 7.9-6.5 11.6a6.5 6.5 0 0 0 13 0c0-3.7-3.9-8.3-6.5-11.6z" />
      <path d="M12.6 7.5l-2.1 3.6 3 1.7-2.3 4.2" />
    </svg>
  );
}
