const DAY_MS = 24 * 60 * 60 * 1000;

// Lo que cuesta la app en Railway en el ciclo de facturación actual, con la misma lectura
// de "Uso en Railway": gastado del estimado contra el día del ciclo.
export function readCycle(summary) {
  const start = new Date(summary.period.start).getTime();
  const end = new Date(summary.period.end).getTime();
  const updated = new Date(summary.period.updatedAt).getTime();
  const cycleDays = Math.round((end - start) / DAY_MS);
  return {
    cycleDays,
    cycleDay: Math.min(Math.ceil((updated - start) / DAY_MS), cycleDays),
    dailyAverage: summary.currentUsage / Math.max((updated - start) / DAY_MS, 0.04),
    elapsedShare: Math.min(Math.max((updated - start) / (end - start), 0), 1),
    spentShare: summary.estimatedUsage > 0 ? Math.min(summary.currentUsage / summary.estimatedUsage, 1) : 0
  };
}
