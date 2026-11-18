// Reglas puras de los accesos adicionales por usuario: abren a una persona una
// pantalla que su perfil no tiene, sin dársela a todos los de su perfil.

const clean = (value) => String(value ?? "").trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS_VIGENCIA = 366;

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const sumarDias = (iso, dias) => {
  const fecha = new Date(`${iso}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

// Catálogo cerrado: un acceso que no está aquí no se puede dar. `perfiles` son los
// que lo pueden recibir (quien ya lo tiene por su perfil no lo necesita).
export const ACCESOS = Object.freeze([
  {
    clave: "entregas.prioridad",
    modulo: "Control de entregas",
    titulo: "Barrios por prioridad",
    descripcion: "Ver la pestaña Prioridad con lo que falta del ciclo, imprimirla y guardarla en PDF. Nunca ve montos.",
    alcances: [
      { valor: "todos", titulo: "Todos los barrios del reparto" },
      { valor: "propios", titulo: "Solo sus barrios" }
    ],
    perfiles: ["validadora_campo", "transport"]
  }
]);

export const accesoDelCatalogo = (clave) => ACCESOS.find((item) => item.clave === clean(clave)) || null;

// Valida lo que manda Usuarios antes de guardar. La fecha de vencimiento es opcional
// y va de hoy a un año.
export const normalizarAcceso = ({ clave, alcance, vence, role } = {}, { hoy } = {}) => {
  const acceso = accesoDelCatalogo(clave);
  if (!acceso) throw fail("Ese acceso no existe.");
  if (!acceso.perfiles.includes(role)) throw fail("Ese perfil ya tiene esta pantalla o no la puede recibir.");
  const alcanceLimpio = clean(alcance) || acceso.alcances[0].valor;
  if (!acceso.alcances.some((item) => item.valor === alcanceLimpio)) throw fail("El alcance elegido no es válido.");
  const venceLimpio = clean(vence);
  if (venceLimpio) {
    if (!ISO.test(venceLimpio) || Number.isNaN(Date.parse(`${venceLimpio}T12:00:00Z`))) throw fail("La fecha de vencimiento no es válida.");
    if (hoy && venceLimpio < hoy) throw fail("La fecha de vencimiento ya pasó.");
    if (hoy && venceLimpio > sumarDias(hoy, MAX_DIAS_VIGENCIA)) throw fail("La fecha de vencimiento puede ser, como mucho, dentro de un año.");
  }
  return { clave: acceso.clave, alcance: alcanceLimpio, vence: venceLimpio || null };
};

// Un acceso vale si su perfil todavía lo puede recibir y no venció (vale hasta el
// final del día de `vence`).
export const accesoVigente = (fila, { hoy, role } = {}) => {
  if (!fila) return false;
  const acceso = accesoDelCatalogo(fila.acceso);
  if (!acceso || (role && !acceso.perfiles.includes(role))) return false;
  const vence = fila.vence ? String(fila.vence).slice(0, 10) : "";
  return !vence || !hoy || vence >= hoy;
};
