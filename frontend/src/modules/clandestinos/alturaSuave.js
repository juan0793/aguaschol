// Cambiar de vista (pestaña del módulo, etapa de las fichas) cambia el alto del
// contenido. Si se achica de golpe, el navegador sube la página sola; si crece
// arriba de lo que se está viendo, la empuja hacia abajo. Para evitarlo:
// 1. congelarAltura: antes del cambio, fija el alto actual como piso;
// 2. soltarAltura: con el contenido nuevo listo, lleva el alto al nuevo con una transición.
const DURACION_MS = 320;
const reducirMovimiento = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const congelarAltura = (el) => {
  if (!el) return;
  el.style.transition = "none";
  el.style.minHeight = `${el.offsetHeight}px`;
  el.dataset.alturaSuave = "congelada";
};

// Alto que tendría el contenedor sin el piso, medido por el borde inferior de sus
// hijos. No se quita el piso para medir: al encogerse, aunque sea un instante, el
// navegador ya subiría la página.
const alturaNatural = (el) => {
  const estilo = getComputedStyle(el);
  const arriba = el.getBoundingClientRect().top;
  let abajo = arriba + parseFloat(estilo.paddingTop) + parseFloat(estilo.borderTopWidth);
  for (const hijo of el.children) {
    const posicion = getComputedStyle(hijo).position;
    if (posicion === "fixed" || posicion === "absolute") continue;
    abajo = Math.max(abajo, hijo.getBoundingClientRect().bottom + parseFloat(getComputedStyle(hijo).marginBottom || 0));
  }
  return Math.ceil(abajo - arriba + parseFloat(estilo.paddingBottom) + parseFloat(estilo.borderBottomWidth));
};

export const soltarAltura = (el) => {
  if (!el || el.dataset.alturaSuave !== "congelada") return;
  const piso = el.offsetHeight;
  const natural = alturaNatural(el);
  const terminar = () => {
    el.removeEventListener("transitionend", terminar);
    if (el.dataset.alturaSuave !== "soltando") return;
    el.style.minHeight = "";
    el.style.transition = "";
    delete el.dataset.alturaSuave;
  };
  // Si el contenido nuevo es igual o más alto, no hay nada que suavizar.
  if (natural >= piso || reducirMovimiento()) { el.style.minHeight = ""; el.style.transition = ""; delete el.dataset.alturaSuave; return; }
  el.dataset.alturaSuave = "soltando";
  el.style.transition = `min-height ${DURACION_MS}ms cubic-bezier(.16, 1, .3, 1)`;
  el.style.minHeight = `${natural}px`;
  el.addEventListener("transitionend", terminar);
  setTimeout(terminar, DURACION_MS + 80);
};
