// Grupos de opciones hechos con botones (role="radio"): un solo Tab entra al grupo
// y las flechas, Inicio y Fin cambian la opción, como en un grupo de radios nativo.
export const radioTabIndex = (keys, current, key) => (key === (keys.includes(current) ? current : keys[0]) ? 0 : -1);

export const radioKeys = (event, keys, current, select) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step && event.key !== "Home" && event.key !== "End") return;
  event.preventDefault();
  const index = Math.max(keys.indexOf(current), 0);
  const next = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 : (index + step + keys.length) % keys.length;
  select(keys[next]);
  event.currentTarget.parentElement?.children[next]?.focus();
};
