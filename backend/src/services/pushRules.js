// Reglas puras de los avisos Web Push: qué mensaje de la campana sale también como
// notificación del sistema, con qué título y a qué pantalla lleva al tocarlo.
// Lo usa pushService.js; no toca la base ni la red.

const entero = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : 0;
};

const recortar = (texto, largo) => {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  return limpio.length > largo ? `${limpio.slice(0, largo - 1).trimEnd()}…` : limpio;
};

// Mismas rutas que abre la campana (AppHeader.jsx): la vista va en la ruta y el detalle
// de Entregas o del banco en el hash, que cada módulo lee al abrir.
export const enlaceDeAviso = (mensaje = {}) => {
  if (entero(mensaje.entrega_documento_id)) return `/entregas#entregas/pendientes?documento=${entero(mensaje.entrega_documento_id)}`;
  if (entero(mensaje.entrega_lote_id)) return `/entregas#entregas/lotes?lote=${entero(mensaje.entrega_lote_id)}`;
  if (entero(mensaje.entrega_reclamo_id)) return "/reclamos";
  if (mensaje.banco_asignacion) return "/clandestinos#clandestinos/banco";
  return "/perfil";
};

const tituloDeAviso = (mensaje = {}) => {
  if (entero(mensaje.entrega_documento_id)) return "Aviso de Control de entregas";
  if (entero(mensaje.entrega_lote_id)) return "Control de entregas";
  if (entero(mensaje.entrega_reclamo_id)) return "Reclamo de entrega";
  if (mensaje.banco_asignacion) return "Banco de clandestinos";
  const remitente = recortar(mensaje.sender_name, 60);
  return remitente ? `Mensaje de ${remitente}` : "Control Aguas";
};

// Devuelve el aviso a enviar o null. Solo los mensajes con un destinatario: el chat
// general, los recibos de lectura, las fijaciones y los borrados no salen como push.
// Tampoco se avisa a quien escribió el mensaje.
export const avisoPushDe = (mensaje) => {
  if (!mensaje || typeof mensaje !== "object") return null;
  if (mensaje.is_general || mensaje.deleted_id || mensaje.read_receipt || mensaje.read_at) return null;
  const destinatario = entero(mensaje.recipient_user_id);
  if (!destinatario || destinatario === entero(mensaje.sender_user_id)) return null;
  const cuerpo = recortar(mensaje.body, 240);
  if (!cuerpo) return null;
  const id = entero(mensaje.id);
  return {
    userId: destinatario,
    payload: {
      title: tituloDeAviso(mensaje),
      body: cuerpo,
      url: enlaceDeAviso(mensaje),
      // Un aviso nuevo del mismo mensaje reemplaza al anterior en vez de apilarse.
      tag: id ? `aviso-${id}` : `aviso-${Date.now()}`,
      message_id: id || null
    }
  };
};

// Suscripción que manda el navegador (PushSubscription.toJSON()). Se valida la forma
// para no guardar basura; el endpoint debe ser https.
export const normalizarSuscripcion = (entrada = {}) => {
  const endpoint = String(entrada?.endpoint ?? "").trim();
  const p256dh = String(entrada?.keys?.p256dh ?? "").trim();
  const auth = String(entrada?.keys?.auth ?? "").trim();
  if (!/^https:\/\/[^\s]+$/i.test(endpoint) || endpoint.length > 1000) return null;
  if (!/^[A-Za-z0-9_-]{40,200}={0,2}$/.test(p256dh) || !/^[A-Za-z0-9_-]{10,60}={0,2}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
};

// El servicio de push responde 404 o 410 cuando la suscripción ya no existe (permiso
// quitado, app desinstalada): esa fila se borra.
export const suscripcionVencida = (statusCode) => statusCode === 404 || statusCode === 410;
