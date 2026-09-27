const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";
const DAY_MS = 24 * 60 * 60 * 1000;

const projectQuery = `query RailwayProject($projectId: String!) {
  project(id: $projectId) {
    workspaceId
    services { edges { node { id name } } }
  }
}`;

const usageQuery = `query RailwayUsage(
  $projectId: String!
  $environmentId: String!
  $startDate: DateTime!
  $endDate: DateTime!
  $metricMeasurements: [MetricMeasurement!]!
) {
  metrics(
    projectId: $projectId
    environmentId: $environmentId
    startDate: $startDate
    endDate: $endDate
    sampleRateSeconds: 3600
    groupBy: [SERVICE_ID]
    measurements: $metricMeasurements
  ) {
    measurement
    tags { serviceId }
    values { ts value }
  }
}`;

const requiredSettings = ["RAILWAY_API_TOKEN", "RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID"];

const railwayGraphql = async (query, variables) => {
  const response = await fetch(RAILWAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const error = new Error("Railway no pudo devolver las métricas solicitadas.");
    error.status = response.status === 401 || response.status === 403 ? 502 : 503;
    throw error;
  }
  return payload.data;
};

export const getRailwayUsage = async () => {
  const missing = requiredSettings.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    const error = new Error("Falta configurar la conexión de Railway en el backend.");
    error.status = 503;
    throw error;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 30 * DAY_MS);
  const projectId = process.env.RAILWAY_PROJECT_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
  const projectData = await railwayGraphql(projectQuery, { projectId });
  if (!projectData.project?.workspaceId) {
    const error = new Error("No se encontró el espacio de trabajo de Railway para este proyecto.");
    error.status = 502;
    throw error;
  }
  const [usageData, metricData] = await Promise.all([
    railwayGraphql(`query RailwayProjectUsage($workspaceId: String!, $startDate: DateTime!, $endDate: DateTime!, $usageProperties: [ProjectUsageProperty!]!) {
      projectServiceUsage(workspaceId: $workspaceId, startDate: $startDate, endDate: $endDate, first: 500, measurements: $usageProperties) {
        usage { measurement value tags { projectId serviceId environmentId } }
      }
    }`, {
      workspaceId: projectData.project.workspaceId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      usageProperties: ["CURRENT_USAGE", "ESTIMATED_USAGE", "CPU_USAGE", "MEMORY_USAGE", "NETWORK_USAGE", "DISK_USAGE", "BACKUP_USAGE"]
    }),
    railwayGraphql(usageQuery, {
      projectId,
      environmentId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      metricMeasurements: ["CPU_USAGE", "MEMORY_USAGE_GB"]
    })
  ]);
  const serviceNames = Object.fromEntries(
    (projectData.project.services?.edges ?? []).map(({ node }) => [node.id, node.name])
  );
  const usage = (usageData.projectServiceUsage?.usage ?? []).filter(
    (row) => row.tags?.projectId === process.env.RAILWAY_PROJECT_ID
  );
  const sum = (measurement) => usage
    .filter((row) => row.measurement === measurement)
    .reduce((total, row) => total + Number(row.value || 0), 0);
  const metrics = metricData.metrics ?? [];
  const peaks = Object.fromEntries(["CPU_USAGE", "MEMORY_USAGE_GB"].map((measurement) => {
    const samples = metrics
      .filter((series) => series.measurement === measurement)
      .flatMap((series) => (series.values ?? []).map((sample) => ({
        serviceId: series.tags?.serviceId,
        service: serviceNames[series.tags?.serviceId] || "Servicio",
        value: Number(sample.value),
        timestamp: new Date(Number(sample.ts) * 1000).toISOString()
      })))
      .filter((sample) => Number.isFinite(sample.value));
    samples.sort((a, b) => b.value - a.value);
    return [measurement, samples.slice(0, 5)];
  }));

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    currentUsage: sum("CURRENT_USAGE"),
    estimatedUsage: sum("ESTIMATED_USAGE"),
    resourceUsage: Object.fromEntries(["CPU_USAGE", "MEMORY_USAGE", "NETWORK_USAGE", "DISK_USAGE", "BACKUP_USAGE"].map((key) => [key, sum(key)])),
    peaks
  };
};
