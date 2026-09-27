export const formatPercent = (value, total) => {
  if (!total) return "0%";
  return `${Math.round((Number(value || 0) / Number(total)) * 100)}%`;
};

export const formatRelativeTime = (value, now = Date.now()) => {
  const date = value ? new Date(value) : null;
  const timestamp = date?.getTime();
  if (!Number.isFinite(timestamp)) return "hace un momento";

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 10) return "hace unos segundos";
  if (seconds < 60) return `hace ${seconds} segundos`;

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "hace 1 minuto";
  if (minutes < 60) return `hace ${minutes} minutos`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "hace 1 hora";
  if (hours < 24) return `hace ${hours} horas`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "hace 1 dia";
  return `hace ${days} dias`;
};

export const formatDashboardSyncRelativeTime = (value, now = Date.now()) => {
  const date = value ? new Date(value) : null;
  const timestamp = date?.getTime();
  if (!Number.isFinite(timestamp)) return "hace segundos";

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 10) return "hace un momento";
  if (seconds < 60) return `hace ${seconds} segundos`;

  return formatRelativeTime(value, now);
};

export const formatDashboardSyncDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return "sin sincronizacion";

  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};
